# ==============================================================================
# SCRIPT DE REINICIO DE SERVICIO BACKEND (FASTAPI / NSSM)
# Requiere ejecutar PowerShell como Administrador
# ==============================================================================

$NSSM_PATH = "C:\nssm-2.24\nssm-2.24\win64\nssm.exe"
$SERVICE_NAME = "Inventario-API"

Write-Host "🔄 Reiniciando el servicio $SERVICE_NAME..." -ForegroundColor Yellow

if (Test-Path $NSSM_PATH) {
    # Ejecutar reinicio a través de NSSM
    & $NSSM_PATH restart $SERVICE_NAME

    Start-Sleep -Seconds 2

    # Verificar el estado del servicio
    $status = (Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue).Status
    if ($status -eq "Running") {
        Write-Host "✅ El servicio $SERVICE_NAME se ha reiniciado y está EJECUTÁNDOSE correctamente." -ForegroundColor Green
    } else {
        Write-Host "⚠️ El servicio $SERVICE_NAME se reinició pero su estado actual es: $status" -ForegroundColor Red
    }
} else {
    Write-Host "❌ No se encontró la herramienta NSSM en la ruta: $NSSM_PATH" -ForegroundColor Red
}