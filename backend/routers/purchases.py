"""Compras: órdenes de compra, facturas, garantías."""
from fastapi import APIRouter
from core.crud import make_crud_router

router = APIRouter()

router.include_router(make_crud_router(
    prefix="/purchase-orders", collection="purchase_orders", permission="purchases",
    entity_label="Orden de Compra", search_fields=["po_number", "supplier_name", "status"]))

router.include_router(make_crud_router(
    prefix="/invoices", collection="invoices", permission="purchases",
    entity_label="Factura", search_fields=["invoice_number", "supplier_name", "ncf"]))

router.include_router(make_crud_router(
    prefix="/warranties", collection="warranties", permission="purchases",
    entity_label="Garantía", search_fields=["asset_tag", "provider", "type"]))
