"""Mantenimientos preventivos y correctivos, Software y Licencias (CRUD genérico)."""
from fastapi import APIRouter
from core.crud import make_crud_router

router = APIRouter()

router.include_router(make_crud_router(
    prefix="/maintenance", collection="maintenance", permission="maintenance",
    entity_label="Mantenimiento", search_fields=["asset_tag", "type", "status", "technician"]))

router.include_router(make_crud_router(
    prefix="/software", collection="software", permission="software",
    entity_label="Software", search_fields=["name", "publisher", "version"]))

router.include_router(make_crud_router(
    prefix="/licenses", collection="licenses", permission="software",
    entity_label="Licencia", search_fields=["software_name", "license_key", "type"]))
