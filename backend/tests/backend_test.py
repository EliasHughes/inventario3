"""End-to-end backend tests for Cisa TI ITAM platform.

Covers auth, RBAC, dashboard, assets CRUD, catalogs, assignments, tickets,
inventory, audit, users, roles and settings.

Uses public ingress URL via REACT_APP_BACKEND_URL. Runs with pytest.
"""

import os
import time
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get REACT_APP_BACKEND_URL
load_dotenv(Path("/app/frontend/.env"))

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "http://localhost:8001"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@cesariglesias.com"
ADMIN_PASSWORD = "Admin2026!"
TECH_EMAIL = "tecnico@cesariglesias.com"
TECH_PASSWORD = "Tecnico2026!"

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", **UA})
    return s


@pytest.fixture(scope="session")
def admin_token(http):
    r = http.post(f"{API}/auth/login",
                  json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    return data["access_token"]


@pytest.fixture(scope="session")
def tech_token():
    # Fresh session for tech login (do not pollute admin session)
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", **UA})
    r = s.post(f"{API}/auth/login",
               json={"email": TECH_EMAIL, "password": TECH_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Tech login failed: {r.status_code} {r.text}")
    return r.json()["access_token"]


@pytest.fixture()
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}",
        **UA,
    })
    return s


@pytest.fixture()
def tech_client(tech_token):
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {tech_token}",
        **UA,
    })
    return s


# ---------- Health ----------
class TestHealth:
    def test_health(self, http):
        r = http.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json().get("status") == "healthy"

    def test_root(self, http):
        r = http.get(f"{API}/")
        assert r.status_code == 200
        assert "Cisa TI" in r.json().get("message", "")


# ---------- Auth ----------
class TestAuth:
    def test_login_admin_success(self, http):
        r = http.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert "permissions" in data["user"]
        assert "*" in data["user"]["permissions"] or len(data["user"]["permissions"]) > 0

    def test_login_invalid_password_spanish_error(self, http):
        r = http.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401
        detail = r.json().get("detail", "")
        # Spanish error
        assert ("contraseña" in detail.lower()) or ("incorrect" in detail.lower())

    def test_auth_me_returns_permissions(self, admin_client):
        r = admin_client.get(f"{API}/auth/me")
        assert r.status_code == 200
        me = r.json()
        assert me["email"] == ADMIN_EMAIL
        assert "permissions" in me
        assert isinstance(me["permissions"], list)

    def test_login_lockout_after_5_attempts(self):
        # Use unique email so lockout counter is isolated
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json", **UA})
        fake = f"TEST_lockout_{uuid.uuid4().hex[:6]}@x.com"
        # First register user - not needed. Lockout tracks by ip:email even for unknown users.
        codes = []
        for _ in range(5):
            r = s.post(f"{API}/auth/login", json={"email": fake, "password": "bad"})
            codes.append(r.status_code)
        # After 5 fails, next attempt should return 429 (blocked)
        r = s.post(f"{API}/auth/login", json={"email": fake, "password": "bad"})
        assert r.status_code == 429, f"expected 429 after 5 fails, got {r.status_code} - {codes} - {r.text}"
        detail = r.json().get("detail", "")
        assert "bloqueada" in detail.lower() or "block" in detail.lower()


# ---------- Dashboard ----------
class TestDashboard:
    def test_summary(self, admin_client):
        r = admin_client.get(f"{API}/dashboard/summary")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_assets", "disponibles", "asignados", "utilizacion"]:
            assert k in d
        assert d["total_assets"] >= 12, f"Expected >=12 seeded assets, got {d['total_assets']}"

    def test_charts(self, admin_client):
        r = admin_client.get(f"{API}/dashboard/charts")
        assert r.status_code == 200
        d = r.json()
        assert "by_status" in d and "by_category" in d and "by_branch" in d

    def test_recent_activity(self, admin_client):
        r = admin_client.get(f"{API}/dashboard/recent-activity")
        assert r.status_code == 200
        assert "items" in r.json()

    def test_alerts(self, admin_client):
        r = admin_client.get(f"{API}/dashboard/alerts")
        assert r.status_code == 200
        d = r.json()
        assert "warranties" in d and "licenses" in d


# ---------- Assets ----------
class TestAssets:
    created_ids = []

    def test_list_seeded(self, admin_client):
        r = admin_client.get(f"{API}/assets")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 12
        assert isinstance(data["items"], list)
        # depreciation calculated
        for it in data["items"]:
            assert "depreciation" in it

    def test_list_filter_status(self, admin_client):
        r = admin_client.get(f"{API}/assets", params={"status": "disponible"})
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["status"] == "disponible"

    def test_statuses_endpoint(self, admin_client):
        r = admin_client.get(f"{API}/assets/statuses")
        assert r.status_code == 200
        assert "disponible" in r.json()["statuses"]

    def test_create_asset_autogenerate_tag(self, admin_client):
        payload = {
            "name": "TEST_Laptop_" + uuid.uuid4().hex[:6],
            "status": "disponible",
            "purchase_cost": 60000,
            "purchase_date": "2024-01-15T00:00:00+00:00",
            "depreciation_years": 4,
        }
        r = admin_client.post(f"{API}/assets", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["asset_tag"].startswith("CISA-")
        assert "id" in d
        TestAssets.created_ids.append(d["id"])

    def test_get_asset_with_depreciation(self, admin_client):
        assert TestAssets.created_ids
        asset_id = TestAssets.created_ids[-1]
        r = admin_client.get(f"{API}/assets/{asset_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == asset_id
        assert d.get("depreciation") is not None
        assert "book_value" in d["depreciation"]

    def test_asset_history(self, admin_client):
        asset_id = TestAssets.created_ids[-1]
        r = admin_client.get(f"{API}/assets/{asset_id}/history")
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(h["action"] == "create" for h in items)

    def test_asset_qr(self, admin_client):
        asset_id = TestAssets.created_ids[-1]
        r = admin_client.get(f"{API}/assets/{asset_id}/qr")
        assert r.status_code == 200
        d = r.json()
        assert d["qr"].startswith("data:image/png;base64,")

    def test_update_asset(self, admin_client):
        asset_id = TestAssets.created_ids[-1]
        r = admin_client.put(f"{API}/assets/{asset_id}",
                             json={"name": "TEST_updated", "status": "disponible"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_updated"

    def test_soft_delete_asset(self, admin_client):
        asset_id = TestAssets.created_ids[-1]
        r = admin_client.delete(f"{API}/assets/{asset_id}")
        assert r.status_code == 200
        # verify
        r = admin_client.get(f"{API}/assets/{asset_id}")
        assert r.status_code == 200
        d = r.json()
        assert d.get("deleted") is True
        assert d.get("status") == "baja"


# ---------- Catalogs ----------
class TestCatalogs:
    @pytest.mark.parametrize("path", ["departments", "branches", "locations",
                                      "manufacturers", "models", "categories", "suppliers"])
    def test_list(self, admin_client, path):
        r = admin_client.get(f"{API}/{path}")
        assert r.status_code == 200
        assert "items" in r.json()

    def test_catalog_crud_department(self, admin_client):
        payload = {"name": f"TEST_Dep_{uuid.uuid4().hex[:5]}", "code": "TST"}
        r = admin_client.post(f"{API}/departments", json=payload)
        assert r.status_code == 200
        d = r.json()
        did = d["id"]
        # update
        r = admin_client.put(f"{API}/departments/{did}",
                             json={"name": "TEST_Updated", "code": "UPD"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Updated"
        # get
        r = admin_client.get(f"{API}/departments/{did}")
        assert r.status_code == 200
        # delete soft
        r = admin_client.delete(f"{API}/departments/{did}")
        assert r.status_code == 200
        # subsequent get should still work (returns doc with deleted=true)
        r = admin_client.get(f"{API}/departments/{did}")
        assert r.status_code == 200
        assert r.json().get("deleted") is True


# ---------- Purchases ----------
class TestPurchases:
    def test_list_purchase_orders(self, admin_client):
        r = admin_client.get(f"{API}/purchase-orders")
        assert r.status_code == 200

    def test_crud_invoice(self, admin_client):
        payload = {"invoice_number": f"TEST_INV_{uuid.uuid4().hex[:5]}",
                   "supplier_name": "TEST_Sup", "amount": 1000}
        r = admin_client.post(f"{API}/invoices", json=payload)
        assert r.status_code == 200
        iid = r.json()["id"]
        r = admin_client.delete(f"{API}/invoices/{iid}")
        assert r.status_code == 200


# ---------- Assignments ----------
class TestAssignments:
    delivery_id = None
    asset_id = None

    def test_create_delivery_changes_asset_status(self, admin_client):
        # Get an available asset
        r = admin_client.get(f"{API}/assets", params={"status": "disponible"})
        items = r.json()["items"]
        assert items, "No available assets to test delivery"
        asset = items[0]
        TestAssignments.asset_id = asset["id"]

        payload = {"asset_id": asset["id"], "assigned_to_name": "TEST_Empleado",
                   "employee_code": "TST-001", "condition": "bueno",
                   "signature": "data:image/png;base64,iVBORw0KGgo="}
        r = admin_client.post(f"{API}/deliveries", json=payload)
        assert r.status_code == 200, r.text
        TestAssignments.delivery_id = r.json()["id"]

        r = admin_client.get(f"{API}/assets/{asset['id']}")
        assert r.json()["status"] == "asignado"

    def test_return_changes_asset_to_available(self, admin_client):
        assert TestAssignments.delivery_id
        payload = {"delivery_id": TestAssignments.delivery_id, "condition": "bueno"}
        r = admin_client.post(f"{API}/returns", json=payload)
        assert r.status_code == 200
        # asset should be disponible again
        r = admin_client.get(f"{API}/assets/{TestAssignments.asset_id}")
        assert r.json()["status"] == "disponible"

    def test_reception(self, admin_client):
        payload = {"description": "TEST_Reception", "condition": "bueno"}
        r = admin_client.post(f"{API}/receptions", json=payload)
        assert r.status_code == 200


# ---------- Maintenance / Software / Licenses ----------
class TestMaintenanceSoftware:
    def test_list_maintenance(self, admin_client):
        r = admin_client.get(f"{API}/maintenance")
        assert r.status_code == 200

    def test_crud_software(self, admin_client):
        r = admin_client.post(f"{API}/software",
                              json={"name": f"TEST_SW_{uuid.uuid4().hex[:5]}", "publisher": "TEST"})
        assert r.status_code == 200
        sid = r.json()["id"]
        r = admin_client.delete(f"{API}/software/{sid}")
        assert r.status_code == 200

    def test_list_licenses(self, admin_client):
        r = admin_client.get(f"{API}/licenses")
        assert r.status_code == 200


# ---------- Inventory ----------
class TestInventory:
    def test_full_inventory_flow(self, admin_client):
        # create session
        r = admin_client.post(f"{API}/inventory/sessions",
                              json={"name": f"TEST_Inv_{uuid.uuid4().hex[:5]}"})
        assert r.status_code == 200, r.text
        session_id = r.json()["id"]

        # pick an existing asset tag
        r = admin_client.get(f"{API}/assets")
        assets = r.json()["items"]
        tag = assets[0]["asset_tag"]

        # count real
        r = admin_client.post(f"{API}/inventory/sessions/{session_id}/count",
                              json={"code": tag, "condition": "bueno"})
        assert r.status_code == 200
        assert r.json()["found"] is True

        # count unknown
        r = admin_client.post(f"{API}/inventory/sessions/{session_id}/count",
                              json={"code": "GHOST-9999", "condition": "bueno"})
        assert r.status_code == 200
        assert r.json()["found"] is False

        # reconcile
        r = admin_client.post(f"{API}/inventory/sessions/{session_id}/reconcile")
        assert r.status_code == 200
        rep = r.json()
        assert "missing" in rep and "unexpected" in rep and "matched" in rep


# ---------- Tickets ----------
class TestTickets:
    def test_create_ticket_autogenerates_number(self, admin_client):
        r = admin_client.post(f"{API}/tickets",
                              json={"title": f"TEST_Ticket_{uuid.uuid4().hex[:5]}",
                                    "priority": "media"})
        assert r.status_code == 200
        d = r.json()
        assert d["ticket_number"].startswith("TK-")
        assert d["status"] == "abierto"
        TestTickets.tid = d["id"]

    def test_update_ticket_status_and_comment(self, admin_client):
        r = admin_client.put(f"{API}/tickets/{TestTickets.tid}",
                             json={"status": "en_progreso", "comment": "TEST_comment"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "en_progreso"
        assert any(c["text"] == "TEST_comment" for c in d.get("comments", []))

    def test_soft_delete_ticket(self, admin_client):
        r = admin_client.delete(f"{API}/tickets/{TestTickets.tid}")
        assert r.status_code == 200


# ---------- Audit ----------
class TestAudit:
    def test_list_audit_admin(self, admin_client):
        r = admin_client.get(f"{API}/audit")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        # Should have some events
        assert d["total"] > 0

    def test_audit_filter_action(self, admin_client):
        r = admin_client.get(f"{API}/audit", params={"action": "login"})
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["action"] == "login"


# ---------- Users & Roles ----------
class TestUsersRoles:
    def test_list_users(self, admin_client):
        r = admin_client.get(f"{API}/users")
        assert r.status_code == 200
        emails = [u["email"] for u in r.json()["items"]]
        assert ADMIN_EMAIL in emails

    def test_permissions_catalog(self, admin_client):
        r = admin_client.get(f"{API}/permissions/catalog")
        assert r.status_code == 200
        d = r.json()
        assert "modules" in d and "all" in d
        assert len(d["all"]) > 0

    def test_list_roles(self, admin_client):
        r = admin_client.get(f"{API}/roles")
        assert r.status_code == 200
        names = [r["name"] for r in r.json()["items"]]
        assert "admin" in names and "tecnico" in names

    def test_create_and_update_role(self, admin_client):
        rn = f"TEST_role_{uuid.uuid4().hex[:5]}"
        r = admin_client.post(f"{API}/roles", json={"name": rn, "description": "test",
                                                     "permissions": ["dashboard:read"]})
        assert r.status_code == 200
        rid = r.json()["id"]
        r = admin_client.put(f"{API}/roles/{rid}",
                             json={"name": rn, "description": "updated",
                                   "permissions": ["dashboard:read", "assets:read"]})
        assert r.status_code == 200
        r = admin_client.delete(f"{API}/roles/{rid}")
        assert r.status_code == 200

    def test_create_user(self, admin_client):
        email = f"TEST_user_{uuid.uuid4().hex[:5]}@x.com"
        r = admin_client.post(f"{API}/users",
                              json={"email": email, "name": "TEST", "password": "Passw0rd!",
                                    "role": "consulta"})
        assert r.status_code == 200
        uid = r.json()["id"]
        r = admin_client.delete(f"{API}/users/{uid}")
        assert r.status_code == 200


# ---------- RBAC ----------
class TestRBAC:
    def test_tech_can_read_assets(self, tech_client):
        r = tech_client.get(f"{API}/assets")
        assert r.status_code == 200

    def test_tech_cannot_write_assets(self, tech_client):
        r = tech_client.post(f"{API}/assets", json={"name": "TEST_forbidden"})
        assert r.status_code == 403

    def test_tech_cannot_access_users(self, tech_client):
        r = tech_client.get(f"{API}/users")
        assert r.status_code == 403

    def test_tech_cannot_access_audit(self, tech_client):
        r = tech_client.get(f"{API}/audit")
        assert r.status_code == 403

    def test_tech_cannot_access_settings(self, tech_client):
        r = tech_client.get(f"{API}/settings")
        assert r.status_code == 403

    def test_tech_can_write_tickets(self, tech_client):
        r = tech_client.post(f"{API}/tickets",
                             json={"title": f"TEST_TechTicket_{uuid.uuid4().hex[:5]}"})
        assert r.status_code == 200


# ---------- Settings ----------
class TestSettings:
    def test_get_settings(self, admin_client):
        r = admin_client.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        assert d["company_name"]

    def test_update_settings(self, admin_client):
        r = admin_client.put(f"{API}/settings",
                             json={"company_name": "César Iglesias S.A.", "app_name": "Cisa TI"})
        assert r.status_code == 200


# ---------- Notifications ----------
class TestNotifications:
    def test_list_notifications(self, admin_client):
        r = admin_client.get(f"{API}/notifications")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        assert "unread" in d
