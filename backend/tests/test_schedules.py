"""Backend tests for Transfer Schedule (Jadwal Transfer) endpoints."""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent.parent / "frontend" / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"

TAG = "TEST_SCHED_"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s
    # cleanup
    r = s.get(f"{BASE_URL}/schedules")
    if r.status_code == 200:
        for x in r.json():
            if x.get("name", "").startswith(TAG):
                s.delete(f"{BASE_URL}/schedules/{x['id']}")


def _mkpayload(name_suffix, days_from_now=5, done=False):
    d = (datetime.now(timezone.utc) + timedelta(days=days_from_now)).date().isoformat()
    return {
        "name": f"{TAG}{name_suffix}",
        "amount": 1500000.0,
        "date": d,
        "account": "BCA 1234567890",
        "notes": "test note",
        "done": done,
    }


class TestScheduleCRUD:
    def test_create_schedule(self, api_client):
        r = api_client.post(f"{BASE_URL}/schedules", json=_mkpayload("Alice", 5))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == f"{TAG}Alice"
        assert d["amount"] == 1500000.0
        assert "id" in d and d["id"]
        assert d["done"] is False
        assert d.get("order") is not None

    def test_list_schedules_has_days_left(self, api_client):
        # ensure at least one exists
        api_client.post(f"{BASE_URL}/schedules", json=_mkpayload("Bob", 2))
        r = api_client.get(f"{BASE_URL}/schedules")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        ours = [x for x in items if x["name"].startswith(TAG)]
        assert len(ours) >= 1
        for x in ours:
            assert "days_left" in x
            assert "_id" not in x
        # sorted by order asc
        orders = [x.get("order", 0) for x in items]
        assert orders == sorted(orders)

    def test_update_schedule_edit_and_toggle_done(self, api_client):
        r = api_client.post(f"{BASE_URL}/schedules", json=_mkpayload("Carol", 4))
        sid = r.json()["id"]

        upd = _mkpayload("Carol-edited", 4)
        upd["amount"] = 2500000.0
        upd["done"] = True
        r2 = api_client.put(f"{BASE_URL}/schedules/{sid}", json=upd)
        assert r2.status_code == 200
        assert r2.json()["done"] is True
        assert r2.json()["amount"] == 2500000.0

        # verify persisted via GET
        r3 = api_client.get(f"{BASE_URL}/schedules")
        found = next(x for x in r3.json() if x["id"] == sid)
        assert found["done"] is True
        assert found["name"] == f"{TAG}Carol-edited"

    def test_delete_schedule(self, api_client):
        r = api_client.post(f"{BASE_URL}/schedules", json=_mkpayload("DelMe", 6))
        sid = r.json()["id"]
        rd = api_client.delete(f"{BASE_URL}/schedules/{sid}")
        assert rd.status_code == 200
        # verify gone
        r3 = api_client.get(f"{BASE_URL}/schedules")
        assert not any(x["id"] == sid for x in r3.json())
        # deleting again -> 404
        r4 = api_client.delete(f"{BASE_URL}/schedules/{sid}")
        assert r4.status_code == 404


class TestScheduleReorder:
    def test_reorder(self, api_client):
        ids = []
        for i, name in enumerate(["R1", "R2", "R3"]):
            r = api_client.post(f"{BASE_URL}/schedules", json=_mkpayload(name, 10 + i))
            ids.append(r.json()["id"])
        # reverse the order
        reversed_ids = list(reversed(ids))
        r = api_client.post(
            f"{BASE_URL}/schedules/reorder", json={"ids": reversed_ids}
        )
        assert r.status_code == 200
        assert r.json()["count"] == 3

        # verify order applied
        items = api_client.get(f"{BASE_URL}/schedules").json()
        by_id = {x["id"]: x for x in items}
        assert by_id[reversed_ids[0]]["order"] == 0
        assert by_id[reversed_ids[1]]["order"] == 1
        assert by_id[reversed_ids[2]]["order"] == 2


class TestDaysLeftComputation:
    def test_days_left_values(self, api_client):
        today_r = api_client.post(f"{BASE_URL}/schedules", json=_mkpayload("Today", 0))
        soon_r = api_client.post(f"{BASE_URL}/schedules", json=_mkpayload("Soon", 2))
        past_r = api_client.post(f"{BASE_URL}/schedules", json=_mkpayload("Past", -3))
        items = api_client.get(f"{BASE_URL}/schedules").json()
        by_id = {x["id"]: x for x in items}
        assert by_id[today_r.json()["id"]]["days_left"] == 0
        assert by_id[soon_r.json()["id"]]["days_left"] == 2
        assert by_id[past_r.json()["id"]]["days_left"] == -3


class TestScheduleErrors:
    def test_update_missing_returns_404(self, api_client):
        r = api_client.put(
            f"{BASE_URL}/schedules/nonexistent-xyz", json=_mkpayload("X", 1)
        )
        assert r.status_code == 404

    def test_create_missing_required_fields(self, api_client):
        r = api_client.post(f"{BASE_URL}/schedules", json={"name": "no-amount"})
        assert r.status_code == 422
