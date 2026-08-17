"""Catálogos maestros: departamentos, sucursales, ubicaciones, fabricantes,
modelos, categorías, proveedores. Usan la fábrica CRUD genérica."""
from fastapi import APIRouter
from core.crud import make_crud_router

router = APIRouter()

router.include_router(make_crud_router(
    prefix="/departments", collection="departments", permission="catalog",
    entity_label="Departamento", search_fields=["name", "code"]))

router.include_router(make_crud_router(
    prefix="/branches", collection="branches", permission="catalog",
    entity_label="Sucursal", search_fields=["name", "code", "city", "address"]))

router.include_router(make_crud_router(
    prefix="/locations", collection="locations", permission="catalog",
    entity_label="Ubicación", search_fields=["name", "area", "floor"]))

router.include_router(make_crud_router(
    prefix="/manufacturers", collection="manufacturers", permission="catalog",
    entity_label="Fabricante", search_fields=["name", "support_phone"]))

router.include_router(make_crud_router(
    prefix="/models", collection="asset_models", permission="catalog",
    entity_label="Modelo", search_fields=["name", "model_number"]))

router.include_router(make_crud_router(
    prefix="/categories", collection="categories", permission="catalog",
    entity_label="Categoría", search_fields=["name", "type"]))

router.include_router(make_crud_router(
    prefix="/suppliers", collection="suppliers", permission="catalog",
    entity_label="Proveedor", search_fields=["name", "rnc", "contact_name", "email"]))
