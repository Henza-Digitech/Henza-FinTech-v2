"""
HENZA DIGITECH backend API test suite.
Covers: transactions, assets, bills, contacts, summary, upcoming bills, AI tips.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://henza-rupiah-manager.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

TAG = f"TEST_{uuid.uuid4().hex[:6]}"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------------- ROOT ----------------
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert "HENZA" in r.json().get("message", "")


# ---------------- TRANSACTIONS ----------------
class TestTransactions:
    created_ids = []

    def test_create_income(self, s):
        payload = {
            "type": "income",
            "scope": "personal",
            "category": "pendapatan",
            "amount": 5000000.0,
            "description": f"{TAG} salary income",
        }
        r = s.post(f"{API}/transactions", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["type"] == "income"
        assert d["amount"] == 5000000.0
        assert "_id" not in d
        assert d.get("date")  # auto-filled
        TestTransactions.created_ids.append(d["id"])

    def test_create_expense_business(self, s):
        payload = {
            "type": "expense",
            "scope": "business",
            "category": "operasional",
            "amount": 250000.0,
            "description": f"{TAG} office supplies",
            "date": datetime.now(timezone.utc).isoformat(),
        }
        r = s.post(f"{API}/transactions", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["scope"] == "business"
        assert d["category"] == "operasional"
        assert isinstance(d["amount"], float)
        TestTransactions.created_ids.append(d["id"])

    def test_create_expense_personal_consumption(self, s):
        payload = {
            "type": "expense",
            "scope": "personal",
            "category": "konsumsi",
            "amount": 75000.0,
            "description": f"{TAG} groceries",
        }
        r = s.post(f"{API}/transactions", json=payload)
        assert r.status_code == 200, r.text
        TestTransactions.created_ids.append(r.json()["id"])

    def test_list_all(self, s):
        r = s.get(f"{API}/transactions")
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        for it in arr:
            assert "_id" not in it

    def test_filter_by_type(self, s):
        r = s.get(f"{API}/transactions", params={"type": "expense"})
        assert r.status_code == 200
        arr = r.json()
        assert all(t["type"] == "expense" for t in arr)

    def test_filter_by_scope(self, s):
        r = s.get(f"{API}/transactions", params={"scope": "business"})
        assert r.status_code == 200
        arr = r.json()
        assert all(t["scope"] == "business" for t in arr)

    def test_filter_by_category(self, s):
        r = s.get(f"{API}/transactions", params={"category": "konsumsi"})
        assert r.status_code == 200
        arr = r.json()
        assert all(t["category"] == "konsumsi" for t in arr)

    def test_search_q(self, s):
        r = s.get(f"{API}/transactions", params={"q": TAG})
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 3
        assert all(TAG in t["description"] for t in arr)

    def test_delete_transaction(self, s):
        # delete last created
        tid = TestTransactions.created_ids.pop()
        r = s.delete(f"{API}/transactions/{tid}")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_delete_missing(self, s):
        r = s.delete(f"{API}/transactions/{uuid.uuid4()}")
        assert r.status_code == 404


# ---------------- ASSETS ----------------
class TestAssets:
    aid = None

    def test_create_asset(self, s):
        payload = {"name": f"{TAG} BCA", "kind": "bank", "balance": 10000000.0, "notes": "primary"}
        r = s.post(f"{API}/assets", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["balance"] == 10000000.0
        assert d["kind"] == "bank"
        assert "_id" not in d
        TestAssets.aid = d["id"]

    def test_list_assets(self, s):
        r = s.get(f"{API}/assets")
        assert r.status_code == 200
        arr = r.json()
        assert any(a["id"] == TestAssets.aid for a in arr)

    def test_update_asset(self, s):
        payload = {"name": f"{TAG} BCA Updated", "kind": "bank", "balance": 12500000.0, "notes": "updated"}
        r = s.put(f"{API}/assets/{TestAssets.aid}", json=payload)
        assert r.status_code == 200, r.text
        # verify via GET
        r2 = s.get(f"{API}/assets")
        found = [a for a in r2.json() if a["id"] == TestAssets.aid][0]
        assert found["balance"] == 12500000.0
        assert found["name"].endswith("Updated")

    def test_update_missing_asset(self, s):
        payload = {"name": "x", "kind": "bank", "balance": 0.0}
        r = s.put(f"{API}/assets/{uuid.uuid4()}", json=payload)
        assert r.status_code == 404

    def test_delete_asset_deferred(self, s):
        # We keep this asset for summary test; will delete at end via a separate fixture-less test
        pass


# ---------------- BILLS ----------------
class TestBills:
    bid_upcoming = None
    bid_far = None

    def test_create_bill_upcoming(self, s):
        # due day = today (upcoming, days_left small)
        today = datetime.now(timezone.utc)
        due_day = min(today.day, 28)
        payload = {
            "name": f"{TAG} Listrik",
            "amount": 500000.0,
            "due_day": due_day,
            "category": "operasional",
            "notes": "PLN",
            "active": True,
        }
        r = s.post(f"{API}/bills", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["due_day"] == due_day
        assert "_id" not in d
        TestBills.bid_upcoming = d["id"]

    def test_create_bill_far(self, s):
        # due day far away -> pick a day 15 days from today (mod 28)
        today = datetime.now(timezone.utc)
        far_day = ((today.day + 15 - 1) % 28) + 1
        payload = {
            "name": f"{TAG} Internet",
            "amount": 350000.0,
            "due_day": far_day,
            "category": "operasional",
            "active": True,
        }
        r = s.post(f"{API}/bills", json=payload)
        assert r.status_code == 200
        TestBills.bid_far = r.json()["id"]

    def test_list_bills(self, s):
        r = s.get(f"{API}/bills")
        assert r.status_code == 200
        arr = r.json()
        ids = [b["id"] for b in arr]
        assert TestBills.bid_upcoming in ids
        assert TestBills.bid_far in ids

    def test_update_bill(self, s):
        payload = {
            "name": f"{TAG} Listrik Baru",
            "amount": 550000.0,
            "due_day": 5,
            "category": "operasional",
            "active": True,
        }
        r = s.put(f"{API}/bills/{TestBills.bid_upcoming}", json=payload)
        assert r.status_code == 200
        assert r.json()["amount"] == 550000.0

    def test_upcoming_bills_days_left(self, s):
        r = s.get(f"{API}/bills/upcoming", params={"days": 7})
        assert r.status_code == 200, r.text
        arr = r.json()
        assert isinstance(arr, list)
        for b in arr:
            assert "days_left" in b
            assert "due_date" in b
            assert isinstance(b["days_left"], int)
            assert b["days_left"] <= 7

    def test_upcoming_bills_days_31(self, s):
        # broader window should return more items (including our far bill)
        r = s.get(f"{API}/bills/upcoming", params={"days": 40})
        assert r.status_code == 200
        arr = r.json()
        ids = [b["id"] for b in arr]
        # Our far bill (15 days away) should appear
        assert TestBills.bid_far in ids

    def test_delete_bill(self, s):
        r = s.delete(f"{API}/bills/{TestBills.bid_upcoming}")
        assert r.status_code == 200
        r2 = s.delete(f"{API}/bills/{TestBills.bid_far}")
        assert r2.status_code == 200

    def test_delete_missing_bill(self, s):
        r = s.delete(f"{API}/bills/{uuid.uuid4()}")
        assert r.status_code == 404


# ---------------- CONTACTS ----------------
class TestContacts:
    cid = None

    def test_create_contact(self, s):
        payload = {
            "name": f"{TAG} Budi Santoso",
            "address": "Jl. Merdeka 1, Jakarta",
            "phone": "081234567890",
            "notes": "Piutang",
        }
        r = s.post(f"{API}/contacts", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"].endswith("Budi Santoso")
        assert "_id" not in d
        TestContacts.cid = d["id"]

    def test_list_contacts(self, s):
        r = s.get(f"{API}/contacts")
        assert r.status_code == 200
        arr = r.json()
        assert any(c["id"] == TestContacts.cid for c in arr)

    def test_search_contact_by_name(self, s):
        r = s.get(f"{API}/contacts", params={"q": "Budi"})
        assert r.status_code == 200
        arr = r.json()
        assert any(c["id"] == TestContacts.cid for c in arr)

    def test_search_contact_by_phone(self, s):
        r = s.get(f"{API}/contacts", params={"q": "0812345"})
        assert r.status_code == 200
        arr = r.json()
        assert any(c["id"] == TestContacts.cid for c in arr)

    def test_update_contact(self, s):
        payload = {
            "name": f"{TAG} Budi Updated",
            "address": "Jl. Baru 2",
            "phone": "081234567890",
            "notes": "lunas",
        }
        r = s.put(f"{API}/contacts/{TestContacts.cid}", json=payload)
        assert r.status_code == 200
        assert r.json()["notes"] == "lunas"

    def test_delete_contact(self, s):
        r = s.delete(f"{API}/contacts/{TestContacts.cid}")
        assert r.status_code == 200

    def test_delete_missing_contact(self, s):
        r = s.delete(f"{API}/contacts/{uuid.uuid4()}")
        assert r.status_code == 404


# ---------------- SUMMARY ----------------
class TestSummary:
    def test_summary_all(self, s):
        r = s.get(f"{API}/summary")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in [
            "total_income", "total_expense", "net_cash",
            "total_assets", "total_wealth", "expense_ratio",
            "by_category", "series", "transactions_count",
        ]:
            assert k in d, f"missing field: {k}"
        # series must have 6 months
        assert isinstance(d["series"], list)
        assert len(d["series"]) == 6
        for pt in d["series"]:
            assert "label" in pt and "income" in pt and "expense" in pt
        # total_wealth == net_cash + total_assets
        assert abs(d["total_wealth"] - (d["net_cash"] + d["total_assets"])) < 1e-6
        # total_assets should reflect our created asset (>= 12.5M)
        assert d["total_assets"] >= 12500000.0

    def test_summary_business_scope(self, s):
        r = s.get(f"{API}/summary", params={"scope": "business"})
        assert r.status_code == 200
        d = r.json()
        # business-scope filters transactions but assets are global
        rp = s.get(f"{API}/summary", params={"scope": "personal"}).json()
        # Business expense should include our operasional 250k, but not personal 75k konsumsi
        assert d["total_expense"] != rp["total_expense"] or d["total_income"] != rp["total_income"]


# ---------------- AI TIPS ----------------
class TestAI:
    def test_ai_tips(self, s):
        r = s.post(f"{API}/ai/tips", json={"force": False}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "tips" in d
        assert isinstance(d["tips"], str)
        assert len(d["tips"]) > 0
        # Should not be the pure fallback (we have transactions seeded)
        # But if AI errors, endpoint still returns 200 with 'error' key
        if "error" in d:
            pytest.fail(f"AI tips returned error: {d['error']}")


# ---------------- CLEANUP ----------------
def test_zzz_cleanup(s):
    # delete asset created earlier
    if TestAssets.aid:
        r = s.delete(f"{API}/assets/{TestAssets.aid}")
        assert r.status_code in (200, 404)
    # delete remaining tagged transactions
    r = s.get(f"{API}/transactions", params={"q": TAG})
    for t in r.json():
        s.delete(f"{API}/transactions/{t['id']}")
    # verify cleanup
    r2 = s.get(f"{API}/transactions", params={"q": TAG})
    assert r2.json() == []
