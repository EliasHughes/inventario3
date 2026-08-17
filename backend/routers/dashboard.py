from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from core.database import db
from core.deps import require_permission

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def now():
    return datetime.now(timezone.utc)


@router.get("/summary")
async def summary(user: dict = Depends(require_permission("dashboard:read"))):
    base = {"deleted": {"$ne": True}}
    total = await db.assets.count_documents(base)

    async def by_status(s):
        return await db.assets.count_documents({**base, "status": s})

    disponibles = await by_status("disponible")
    asignados = await by_status("asignado")
    mantenimiento = await by_status("mantenimiento")
    danados = await by_status("danado")

    # sin responsable
    sin_responsable = await db.assets.count_documents(
        {**base, "$or": [{"assigned_to": None}, {"assigned_to": ""}]})

    # valor total del inventario
    pipeline = [{"$match": base}, {"$group": {"_id": None, "total": {"$sum": "$purchase_cost"}}}]
    val = await db.assets.aggregate(pipeline).to_list(1)
    valor_inventario = round(val[0]["total"], 2) if val and val[0].get("total") else 0

    # garantías por vencer (60 dias)
    soon = (now() + timedelta(days=60)).isoformat()
    today = now().isoformat()
    garantias_por_vencer = await db.assets.count_documents(
        {**base, "warranty_end": {"$gte": today, "$lte": soon}})

    # licencias por expirar (60 dias)
    licencias_por_expirar = await db.licenses.count_documents(
        {"deleted": {"$ne": True}, "expiry_date": {"$gte": today, "$lte": soon}})

    # mantenimientos programados
    mant_programados = await db.maintenance.count_documents(
        {"deleted": {"$ne": True}, "status": {"$in": ["programado", "pendiente"]}})

    # tickets abiertos
    tickets_abiertos = await db.tickets.count_documents(
        {"deleted": {"$ne": True}, "status": {"$in": ["abierto", "en_progreso", "en_espera"]}})

    return {
        "total_assets": total, "disponibles": disponibles, "asignados": asignados,
        "mantenimiento": mantenimiento, "danados": danados,
        "sin_responsable": sin_responsable, "valor_inventario": valor_inventario,
        "garantias_por_vencer": garantias_por_vencer, "licencias_por_expirar": licencias_por_expirar,
        "mantenimientos_programados": mant_programados, "tickets_abiertos": tickets_abiertos,
        "utilizacion": round((asignados / total * 100), 1) if total else 0,
    }


async def _group_count(field):
    pipeline = [{"$match": {"deleted": {"$ne": True}}},
                {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}]
    return await db.assets.aggregate(pipeline).to_list(100)


@router.get("/charts")
async def charts(user: dict = Depends(require_permission("dashboard:read"))):
    by_status = await _group_count("status")
    by_category = await _group_count("category_id")
    by_branch = await _group_count("branch_id")

    # resolver nombres de categorías y sucursales
    cats = {c["id"]: c["name"] for c in await db.categories.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(500)}
    branches = {b["id"]: b["name"] for b in await db.branches.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(500)}

    def label_cat(rows):
        return [{"name": cats.get(r["_id"], r["_id"] or "Sin categoría"), "value": r["count"]} for r in rows]

    def label_branch(rows):
        return [{"name": branches.get(r["_id"], r["_id"] or "Sin sucursal"), "value": r["count"]} for r in rows]

    return {
        "by_status": [{"name": r["_id"] or "Sin estado", "value": r["count"]} for r in by_status],
        "by_category": label_cat(by_category),
        "by_branch": label_branch(by_branch),
    }


@router.get("/recent-activity")
async def recent_activity(user: dict = Depends(require_permission("dashboard:read"))):
    items = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(15).to_list(15)
    return {"items": items}


@router.get("/alerts")
async def alerts(user: dict = Depends(require_permission("dashboard:read"))):
    today = now().isoformat()
    soon = (now() + timedelta(days=60)).isoformat()
    warranties = await db.assets.find(
        {"deleted": {"$ne": True}, "warranty_end": {"$gte": today, "$lte": soon}},
        {"_id": 0, "asset_tag": 1, "name": 1, "warranty_end": 1}).sort("warranty_end", 1).limit(20).to_list(20)
    licenses = await db.licenses.find(
        {"deleted": {"$ne": True}, "expiry_date": {"$gte": today, "$lte": soon}},
        {"_id": 0, "software_name": 1, "expiry_date": 1, "seats": 1}).sort("expiry_date", 1).limit(20).to_list(20)
    return {"warranties": warranties, "licenses": licenses}
