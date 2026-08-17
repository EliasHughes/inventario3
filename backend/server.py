from core.config import settings  # loads .env first
import logging
from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.cors import CORSMiddleware
from routers.remote_control import router as remote_control_router
from datetime import datetime
import uuid
from core.database import create_indexes, client
from seed import seed
from routers import (auth, users, catalog, assets, purchases, assignments,
                     maintenance, inventory, tickets, audit, dashboard,
                     employees, reports, settings as settings_router)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("cisa_ti")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    try:
        await create_indexes()
        await seed()
        logger.info("✅ Cisa TI ITAM API iniciada correctamente")
    except Exception:
        logger.exception("❌ ERROR EN STARTUP")
        import traceback; traceback.print_exc()   # fuerza mostrar el traceback
        raise
    yield
    # --- SHUTDOWN ---
    client.close()

app = FastAPI(
    title="Cisa TI · Plataforma ITAM",
    version="1.0.0",
    description="Gestión integral de activos tecnológicos - César Iglesias S.A.",
    lifespan=lifespan,
)

app.include_router(remote_control_router, prefix="/api")
#app.include_router(remote_control_router)
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Cisa TI ITAM API", "status": "ok", "version": "1.0.0"}

from fastapi import FastAPI, Request
from fastapi.responses import Response

import base64

@api_router.get("/agent/download-script")
async def generate_agent_bat():
    server_url = "http://172.21.20.14:8006/api/agent/report"

    # Script PowerShell limpio
    ps_script = f'''$SERVER_URL = "{server_url}"

try {{
    $cs   = Get-CimInstance -ClassName Win32_ComputerSystem
    $bios = Get-CimInstance -ClassName Win32_BIOS
    $os   = Get-CimInstance -ClassName Win32_OperatingSystem
    $cpu  = Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1

    $ramBytes = (Get-CimInstance -ClassName Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum
    $ramGB    = [math]::Round($ramBytes / 1GB, 2)

    $disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'"
    $diskTotal = if ($disk) {{ [math]::Round($disk.Size / 1GB, 2) }} else {{ 0 }}
    $diskFree  = if ($disk) {{ [math]::Round($disk.FreeSpace / 1GB, 2) }} else {{ 0 }}

    $net = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration |
           Where-Object {{ $_.IPEnabled -eq $true -and $_.DefaultIPGateway -ne $null }} |
           Select-Object -First 1

    $serial = if ($bios.SerialNumber) {{ $bios.SerialNumber.Trim() }} else {{ "" }}
    if ([string]::IsNullOrWhiteSpace($serial) -or $serial -eq "To Be Filled By O.E.M.") {{
        $serial = "SN-" + $env:COMPUTERNAME
    }}

    $payload = @{{
        hostname      = $env:COMPUTERNAME
        serial_number = $serial
        manufacturer  = $cs.Manufacturer
        model         = $cs.Model
        os_name       = $os.Caption
        processor     = if ($cpu) {{ $cpu.Name.Trim() }} else {{ "N/A" }}
        ram_gb        = $ramGB
        disk_total_gb = $diskTotal
        disk_free_gb  = $diskFree
        ip_address    = if ($net -and $net.IPAddress) {{ $net.IPAddress[0] }} else {{ "N/A" }}
        mac_address   = if ($net) {{ $net.MACAddress }} else {{ "N/A" }}
        last_user     = $cs.UserName
    }} | ConvertTo-Json -Depth 3

    $response = Invoke-RestMethod -Uri $SERVER_URL -Method Post -Body $payload -ContentType "application/json" -TimeoutSec 15

    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host " INVENTARIO ENVIADO CORRECTAMENTE" -ForegroundColor Green
    Write-Host "========================================="
    Write-Host "Equipo  : $($env:COMPUTERNAME)"
    Write-Host "Servidor: $SERVER_URL"
    Write-Host "Estado  : $($response.status)"
    Write-Host "Mensaje : $($response.message)"
    Write-Host "Accion  : $($response.action)"
    Write-Host "========================================="
}}
catch {{
    Write-Host ""
    Write-Host "ERROR AL ENVIAR INVENTARIO" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "URL: $SERVER_URL" -ForegroundColor Yellow
}}

Write-Host ""
Write-Host "Presione Enter para cerrar..."
Read-Host
'''

    # Codificar en Base64 (UTF-16LE es lo que espera -EncodedCommand)
    ps_bytes = ps_script.encode("utf-16le")
    ps_b64 = base64.b64encode(ps_bytes).decode("ascii")

    bat_content = f'''@echo off
title Cisa TI - Agente de Inventario
echo.
echo  Ejecutando agente de inventario Cisa TI...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand {ps_b64}
'''

    return Response(
        content=bat_content,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": 'attachment; filename="CisaTI_Agente_Inventario.bat"'
        }
    )

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
from fastapi.responses import JSONResponse

class AgentReport(BaseModel):
    hostname: str
    serial_number: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    os_name: Optional[str] = None
    processor: Optional[str] = None
    ram_gb: Optional[float] = None
    disk_total_gb: Optional[float] = None
    disk_free_gb: Optional[float] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    last_user: Optional[str] = None

@api_router.post("/agent/report")
async def agent_report(payload: AgentReport):
    """
    Recibe inventario del agente y crea o actualiza el activo.
    """
    from core.database import db

    try:
        now = datetime.utcnow()
        serial = (payload.serial_number or "").strip()
        hostname = (payload.hostname or "").strip()

        if not serial and not hostname:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "serial_number o hostname requerido"},
            )

        query = {"is_deleted": {"$ne": True}}
        if serial and not serial.startswith("SN-"):
            query["serial_number"] = serial
        else:
            query["hostname"] = hostname

        existing = await db.assets.find_one(query)

        asset_data = {
            "hostname": hostname,
            "serial_number": serial or f"SN-{hostname}",
            "manufacturer": payload.manufacturer,
            "model": payload.model,
            "os_name": payload.os_name,
            "processor": payload.processor,
            "ram_gb": payload.ram_gb,
            "disk_total_gb": payload.disk_total_gb,
            "disk_free_gb": payload.disk_free_gb,
            "ip_address": None if payload.ip_address in (None, "N/A") else payload.ip_address,
            "mac_address": None if payload.mac_address in (None, "N/A") else payload.mac_address,
            "last_user": payload.last_user,
            "last_inventory_at": now,
            "last_seen": now,
            "updated_at": now,
            "source": "agent",
        }

        if existing:
            await db.assets.update_one({"_id": existing["_id"]}, {"$set": asset_data})
            return {
                "status": "ok",
                "message": "Activo actualizado por agente",
                "action": "updated",
                "asset_id": str(existing.get("id") or existing["_id"]),
            }

        new_id = str(uuid.uuid4())
        asset_tag = f"AG-{hostname[:8].upper()}-{new_id[:6].upper()}"
        new_asset = {
            "id": new_id,
            "asset_tag": asset_tag,
            "name": f"{payload.manufacturer or ''} {payload.model or hostname}".strip() or hostname,
            "status": "disponible",
            "condition": "bueno",
            "created_at": now,
            "is_deleted": False,
            **asset_data,
        }
        await db.assets.insert_one(new_asset)
        return {
            "status": "ok",
            "message": "Activo registrado automáticamente por agente",
            "action": "created",
            "asset_id": new_id,
            "asset_tag": asset_tag,
        }
    except Exception as e:
        logger.exception("Error en agent_report: %s", e)
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)},
        )
   

@api_router.post("/agent/heartbeat")
async def agent_heartbeat(payload: dict):
    """
    Heartbeat ligero del agente.
    Actualiza last_seen del activo por serial_number o hostname.
    """
    from core.database import db   # ajusta si tu import es distinto

    serial = (payload.get("serial_number") or "").strip()
    hostname = (payload.get("hostname") or "").strip()

    if not serial and not hostname:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "serial_number o hostname requerido"}
        )

    now = datetime.utcnow()

    query = {"is_deleted": {"$ne": True}}
    if serial and not serial.startswith("SN-"):
        query["serial_number"] = serial
    else:
        query["hostname"] = hostname

    result = await db.assets.update_one(
        query,
        {
            "$set": {
                "last_seen": now,
                "ip_address": payload.get("ip_address") or None,
                "updated_at": now,
            }
        }
    )

    if result.matched_count == 0:
        return {
            "status": "ok",
            "message": "Equipo no registrado aún. Ejecute inventario completo.",
            "action": "not_found"
        }

    return {
        "status": "ok",
        "message": "Heartbeat recibido",
        "action": "heartbeat",
        "server_time": now.isoformat() + "Z"
    }

@api_router.get("/health")
async def health():
    return {"status": "healthy"}


api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(catalog.router)
api_router.include_router(assets.router)
api_router.include_router(purchases.router)
api_router.include_router(assignments.router)
api_router.include_router(maintenance.router)
api_router.include_router(inventory.router)
api_router.include_router(tickets.router)
api_router.include_router(audit.router)
api_router.include_router(dashboard.router)
api_router.include_router(employees.router)
api_router.include_router(reports.router)
api_router.include_router(settings_router.router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://172.21.20.14:3000",
        "http://localhost:3003",
        "http://127.0.0.1:3003",
        "http://172.21.20.14:3003",
        "http://localhost:8006",
        "http://127.0.0.1:8006",
        "http://172.21.20.14:8006",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
#app.add_middleware(
#    CORSMiddleware,
#    allow_origins=["*"],
#    allow_credentials=False,  # obligatorio si usas allow_origins=["*"]
#    allow_methods=["*"],
#    allow_headers=["*"],
#)

@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422,
                        content={"detail": exc.errors()[0]["msg"] if exc.errors() else "Datos inválidos"})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Error no controlado: %s", exc)  
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})


#@app.on_event("startup")
#async def startup():
#    await create_indexes()
#    await seed()
#    logger.info("Cisa TI ITAM API iniciada correctamente")


#@app.on_event("shutdown")
#async def shutdown():
#    await client.close()

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# ... tus rutas de API existentes (ej: /api/productos, etc.) ...

# Montar los archivos estáticos de React
frontend_build_path = os.path.join(os.path.dirname(__file__), "frontend", "build")

if os.path.exists(frontend_build_path):
    app.mount("/static", StaticFiles(directory=os.path.join(frontend_build_path, "static")), name="static")

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        file_path = os.path.join(frontend_build_path, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_build_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8006, reload=False)