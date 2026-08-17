"""Tests for new features: Employees CRUD + search, Assets search (typeahead),
Deliveries/Returns with employee ref, Reports preview + export xlsx/pdf.

Runs against the public ingress URL via REACT_APP_BACKEND_URL.
"""
import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path("/app/frontend/.env"))
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@cesariglesias.com"
ADMIN_PASSWORD = "Admin2026!"

UA = {"User-Agent": "pytest-new-features"}


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      headers=UA, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json",
                      "Authorization": f"Bearer {token}", **UA})
    return s


# ---------- state shared through the test session ----------
STATE = {}


# ============ DEPARTMENTS ============
class TestDepartments:
    def test_create_department(self, client):
        name = f"TEST_Dept_{uuid.uuid4().hex[:6]}"
        r = client.post(f"{API}/departments", json={"name": name})
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("name") == name
        assert "id" in data
        STATE["dept_id"] = data["id"]
        STATE["dept_name"] = name

    def test_list_departments_contains_created(self, client):
        r = client.get(f"{API}/departments")
        assert r.status_code == 200
        payload = r.json()
        items = payload.get("items", payload if isinstance(payload, list) else [])
        assert any(i.get("id") == STATE["dept_id"] for i in items)


# ============ EMPLOYEES ============
class TestEmployees:
    def test_create_employee(self, client):
        code = f"TEST-EMP-{uuid.uuid4().hex[:5].upper()}"
        payload = {"code": code, "name": "TEST Empleado Uno",
                   "department_id": STATE["dept_id"], "supervisor": "TEST Supervisor",
                   "email": "test.emp@example.com", "position": "Analista"}
        r = client.post(f"{API}/employees", json=payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["code"] == code
        assert data["name"] == "TEST Empleado Uno"
        assert data["department_id"] == STATE["dept_id"]
        assert "id" in data
        STATE["emp_id"] = data["id"]
        STATE["emp_code"] = code

    def test_duplicate_code_rejected(self, client):
        r = client.post(f"{API}/employees", json={"code": STATE["emp_code"],
                                                   "name": "Otro"})
        assert r.status_code == 400

    def test_get_employee_has_department_name(self, client):
        r = client.get(f"{API}/employees/{STATE['emp_id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["department_name"] == STATE["dept_name"]

    def test_search_by_code(self, client):
        r = client.get(f"{API}/employees/search", params={"q": STATE["emp_code"][:6]})
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(i["id"] == STATE["emp_id"] for i in items)

    def test_search_by_name(self, client):
        r = client.get(f"{API}/employees/search", params={"q": "TEST Empleado"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(i["id"] == STATE["emp_id"] for i in items)

    def test_filter_by_department(self, client):
        r = client.get(f"{API}/employees",
                       params={"department_id": STATE["dept_id"]})
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        assert all(i["department_id"] == STATE["dept_id"] for i in items)

    def test_update_employee(self, client):
        r = client.put(f"{API}/employees/{STATE['emp_id']}",
                       json={"code": STATE["emp_code"],
                             "name": "TEST Empleado Editado",
                             "department_id": STATE["dept_id"],
                             "supervisor": "Nuevo Sup"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST Empleado Editado"


# ============ ASSETS + typeahead ============
class TestAssetsSearch:
    def test_create_asset(self, client):
        payload = {"name": "TEST Laptop Dell",
                   "serial_number": f"SN-{uuid.uuid4().hex[:8].upper()}",
                   "mac_address": "AA:BB:CC:11:22:33",
                   "status": "disponible", "condition": "nuevo"}
        r = client.post(f"{API}/assets", json=payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["status"] == "disponible"
        assert "asset_tag" in data
        STATE["asset_id"] = data["id"]
        STATE["asset_serial"] = data["serial_number"]
        STATE["asset_tag"] = data["asset_tag"]

    def test_search_by_serial(self, client):
        r = client.get(f"{API}/assets/search",
                       params={"q": STATE["asset_serial"][:6],
                               "available_only": "true"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(i["id"] == STATE["asset_id"] for i in items)

    def test_search_by_mac(self, client):
        r = client.get(f"{API}/assets/search", params={"q": "AA:BB"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(i["id"] == STATE["asset_id"] for i in items)

    def test_search_by_name(self, client):
        r = client.get(f"{API}/assets/search", params={"q": "TEST Laptop"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(i["id"] == STATE["asset_id"] for i in items)


# ============ DELIVERIES / RETURNS ============
class TestDeliveries:
    def test_create_delivery_with_employee(self, client):
        payload = {"asset_id": STATE["asset_id"],
                   "assigned_to_name": "TEST Empleado Editado",
                   "employee_id": STATE["emp_id"]}
        r = client.post(f"{API}/deliveries", json=payload)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d["asset_id"] == STATE["asset_id"]
        assert d["employee_id"] == STATE["emp_id"]
        assert d["employee_code"] == STATE["emp_code"]
        assert d["asset_tag"] == STATE["asset_tag"]
        STATE["delivery_id"] = d["id"]

    def test_asset_status_is_assigned(self, client):
        r = client.get(f"{API}/assets/{STATE['asset_id']}")
        assert r.status_code == 200
        assert r.json()["status"] == "asignado"

    def test_list_deliveries_search_by_employee_code(self, client):
        r = client.get(f"{API}/deliveries",
                       params={"q": STATE["emp_code"][:5], "active_only": "true"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(i["id"] == STATE["delivery_id"] for i in items)

    def test_create_return_and_asset_freed(self, client):
        r = client.post(f"{API}/returns",
                        json={"delivery_id": STATE["delivery_id"],
                              "condition": "bueno"})
        assert r.status_code in (200, 201), r.text
        # verify asset back to disponible
        r2 = client.get(f"{API}/assets/{STATE['asset_id']}")
        assert r2.json()["status"] == "disponible"

    def test_cannot_delete_employee_when_no_active_delivery(self, client):
        # After return, delete should succeed (idempotent for our TEST_ prefix)
        # Just ensure no active deliveries remain
        r = client.get(f"{API}/deliveries",
                       params={"employee_id": STATE["emp_id"], "active_only": "true"})
        assert r.status_code == 200
        assert r.json()["total"] == 0


# ============ REPORTS ============
class TestReports:
    def test_categories_endpoint(self, client):
        r = client.get(f"{API}/reports/categories")
        assert r.status_code == 200
        keys = {c["key"] for c in r.json()["items"]}
        assert {"deliveries_by_employee_date", "returns_by_period",
                "assets_by_status", "assets_by_department",
                "assignment_history"} <= keys

    def test_preview_deliveries_by_employee_date_requires_date(self, client):
        r = client.get(f"{API}/reports/preview",
                       params={"category": "deliveries_by_employee_date"})
        assert r.status_code == 400

    def test_preview_assets_by_status(self, client):
        r = client.get(f"{API}/reports/preview",
                       params={"category": "assets_by_status",
                               "status": "disponible"})
        assert r.status_code == 200
        data = r.json()
        assert "columns" in data and "rows" in data
        assert data["title"] == "Equipos por estado"

    def test_preview_assignment_history(self, client):
        r = client.get(f"{API}/reports/preview",
                       params={"category": "assignment_history",
                               "employee_id": STATE["emp_id"]})
        assert r.status_code == 200
        # Should contain our delivery
        assert r.json()["total"] >= 1

    def test_export_xlsx(self, client):
        r = client.get(f"{API}/reports/export",
                       params={"category": "assets_by_status", "format": "xlsx"})
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("Content-Type", "")
        assert len(r.content) > 100

    def test_export_pdf(self, client):
        r = client.get(f"{API}/reports/export",
                       params={"category": "assets_by_status", "format": "pdf"})
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    def test_export_invalid_category(self, client):
        r = client.get(f"{API}/reports/export",
                       params={"category": "nope", "format": "pdf"})
        assert r.status_code == 400

    def test_export_invalid_format(self, client):
        r = client.get(f"{API}/reports/export",
                       params={"category": "assets_by_status", "format": "csv"})
        assert r.status_code in (400, 422)


# ============ CLEANUP ============
class TestZCleanup:
    def test_cleanup(self, client):
        # delete employee
        eid = STATE.get("emp_id")
        if eid:
            r = client.delete(f"{API}/employees/{eid}")
            assert r.status_code in (200, 204)
        # delete asset
        aid = STATE.get("asset_id")
        if aid:
            r = client.delete(f"{API}/assets/{aid}")
            assert r.status_code in (200, 204)
