"""
Tests for the new features in HENZA DIGITECH backend:
  1) Transactions sort options (sort=date_desc|date_asc|amount_desc|amount_asc|category_asc)
  2) Export bundle at GET /api/export
  3) Import bundle at POST /api/import in merge and replace modes
  4) Round-trip export -> import(merge) idempotency
  5) Round-trip export -> delete some -> import(merge) restores missing
  6) Malformed items are handled without crashing the server
"""
import os
import uuid
import copy
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://henza-rupiah-manager.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

TAG = f"TEST_SORTBAK_{uuid.uuid4().hex[:6]}"


# ---------------------- FIXTURES ----------------------
@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def seeded_transactions(s):
    """Seed 5 deterministic transactions for sort tests. Cleaned up at module teardown."""
    base = datetime(2025, 6, 1, tzinfo=timezone.utc)
    seeds = [
        # (offset_days, type, category, amount)
        (0,  "expense", "konsumsi",       50000.0),
        (2,  "expense", "transportasi",   25000.0),
        (5,  "income",  "pendapatan",   9000000.0),
        (10, "expense", "hiburan",       100000.0),
        (20, "expense", "konsumsi",       10000.0),
    ]
    created_ids = []
    for i, (off, ttype, cat, amt) in enumerate(seeds):
        date_iso = (base + timedelta(days=off)).isoformat()
        payload = {
            "type": ttype,
            "scope": "personal",
            "category": cat,
            "amount": amt,
            "description": f"{TAG} seed {i}",
            "date": date_iso,
        }
        r = s.post(f"{API}/transactions", json=payload)
        assert r.status_code == 200, r.text
        created_ids.append(r.json()["id"])

    yield created_ids

    # cleanup
    for tid in created_ids:
        s.delete(f"{API}/transactions/{tid}")


# ---------------------- SORT TESTS ----------------------
class TestTransactionSort:
    def _tag_only(self, arr):
        return [t for t in arr if TAG in t.get("description", "")]

    def test_default_sort_is_date_desc(self, s, seeded_transactions):
        r = s.get(f"{API}/transactions")
        assert r.status_code == 200
        ours = self._tag_only(r.json())
        assert len(ours) == 5
        dates = [t["date"] for t in ours]
        assert dates == sorted(dates, reverse=True), f"Default sort not date_desc: {dates}"

    def test_sort_date_desc(self, s, seeded_transactions):
        r = s.get(f"{API}/transactions", params={"sort": "date_desc", "q": TAG})
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 5
        dates = [t["date"] for t in arr]
        assert dates == sorted(dates, reverse=True)

    def test_sort_date_asc(self, s, seeded_transactions):
        r = s.get(f"{API}/transactions", params={"sort": "date_asc", "q": TAG})
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 5
        dates = [t["date"] for t in arr]
        assert dates == sorted(dates)

    def test_sort_amount_desc(self, s, seeded_transactions):
        r = s.get(f"{API}/transactions", params={"sort": "amount_desc", "q": TAG})
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 5
        amounts = [t["amount"] for t in arr]
        assert amounts == sorted(amounts, reverse=True)
        assert amounts[0] == 9000000.0
        assert amounts[-1] == 10000.0

    def test_sort_amount_asc(self, s, seeded_transactions):
        r = s.get(f"{API}/transactions", params={"sort": "amount_asc", "q": TAG})
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 5
        amounts = [t["amount"] for t in arr]
        assert amounts == sorted(amounts)
        assert amounts[0] == 10000.0
        assert amounts[-1] == 9000000.0

    def test_sort_category_asc(self, s, seeded_transactions):
        r = s.get(f"{API}/transactions", params={"sort": "category_asc", "q": TAG})
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 5
        cats = [t["category"] for t in arr]
        assert cats == sorted(cats), f"Categories not alphabetical: {cats}"
        # two konsumsi -> should be grouped together, and within group date_desc
        konsumsi_dates = [t["date"] for t in arr if t["category"] == "konsumsi"]
        assert konsumsi_dates == sorted(konsumsi_dates, reverse=True)

    def test_unknown_sort_falls_back_to_date_desc(self, s, seeded_transactions):
        r = s.get(f"{API}/transactions", params={"sort": "bogus_key", "q": TAG})
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 5
        dates = [t["date"] for t in arr]
        assert dates == sorted(dates, reverse=True)


# ---------------------- EXPORT TESTS ----------------------
class TestExport:
    def test_export_shape(self, s, seeded_transactions):
        r = s.get(f"{API}/export")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("app") == "HENZA_DIGITECH"
        assert d.get("version") == 1
        assert "exported_at" in d
        assert "counts" in d
        for col in ["transactions", "assets", "bills", "contacts", "folders", "files"]:
            assert col in d, f"Missing collection: {col}"
            assert isinstance(d[col], list)
            assert d["counts"][col] == len(d[col])
        # transactions must include our seeded ones
        seeded_set = set(seeded_transactions)
        exported_ids = {t["id"] for t in d["transactions"]}
        assert seeded_set.issubset(exported_ids)

    def test_export_excludes_mongo_id(self, s):
        r = s.get(f"{API}/export")
        assert r.status_code == 200
        d = r.json()
        for col in ["transactions", "assets", "bills", "contacts", "folders", "files"]:
            for item in d[col]:
                assert "_id" not in item, f"_id leaked in {col}: {item}"


# ---------------------- IMPORT MERGE ROUND TRIP ----------------------
class TestImportMergeRoundTrip:
    def test_export_import_merge_idempotent(self, s, seeded_transactions):
        # 1. Export current DB
        r1 = s.get(f"{API}/export")
        assert r1.status_code == 200
        bundle = r1.json()
        counts_before = bundle["counts"]

        # 2. Re-import in merge mode -> everything should be skipped as duplicates
        import_body = {
            "transactions": bundle["transactions"],
            "assets": bundle["assets"],
            "bills": bundle["bills"],
            "contacts": bundle["contacts"],
            "folders": bundle["folders"],
            "files": bundle["files"],
            "mode": "merge",
        }
        r2 = s.post(f"{API}/import", json=import_body)
        assert r2.status_code == 200, r2.text
        res = r2.json()
        assert res["ok"] is True
        assert res["mode"] == "merge"
        for col, cnt in counts_before.items():
            assert res["results"][col]["inserted"] == 0, f"Expected 0 inserts for {col}, got {res['results'][col]}"
            assert res["results"][col]["skipped"] == cnt, f"Expected {cnt} skipped for {col}, got {res['results'][col]}"

        # 3. Counts unchanged after merge
        r3 = s.get(f"{API}/export")
        counts_after = r3.json()["counts"]
        assert counts_after == counts_before

    def test_delete_then_merge_restores(self, s, seeded_transactions):
        # 1. Export
        exp = s.get(f"{API}/export").json()

        # 2. Pick two of our tagged transactions and delete them
        our_tx = [t for t in exp["transactions"] if TAG in t.get("description", "")]
        assert len(our_tx) >= 2
        victims = our_tx[:2]
        for v in victims:
            dr = s.delete(f"{API}/transactions/{v['id']}")
            assert dr.status_code == 200
        # verify gone
        list_after = s.get(f"{API}/transactions", params={"q": TAG}).json()
        remaining_ids = {t["id"] for t in list_after}
        for v in victims:
            assert v["id"] not in remaining_ids

        # 3. Merge-import the previously exported bundle
        body = {
            "transactions": exp["transactions"],
            "assets": exp["assets"],
            "bills": exp["bills"],
            "contacts": exp["contacts"],
            "folders": exp["folders"],
            "files": exp["files"],
            "mode": "merge",
        }
        r = s.post(f"{API}/import", json=body)
        assert r.status_code == 200, r.text
        res = r.json()["results"]
        # exactly 2 transactions inserted (the 2 we deleted)
        assert res["transactions"]["inserted"] == 2, res
        # rest skipped
        assert res["transactions"]["skipped"] == len(exp["transactions"]) - 2

        # 4. Verify our victims came back
        after = s.get(f"{API}/transactions", params={"q": TAG}).json()
        after_ids = {t["id"] for t in after}
        for v in victims:
            assert v["id"] in after_ids


# ---------------------- IMPORT REPLACE ----------------------
class TestImportReplace:
    def test_replace_mode_wipes_and_restores(self, s, seeded_transactions):
        # 1. Snapshot everything
        exp = s.get(f"{API}/export").json()
        counts_before = exp["counts"]

        # 2. Replace-import same bundle -> counts should end up identical
        body = {
            "transactions": exp["transactions"],
            "assets": exp["assets"],
            "bills": exp["bills"],
            "contacts": exp["contacts"],
            "folders": exp["folders"],
            "files": exp["files"],
            "mode": "replace",
        }
        r = s.post(f"{API}/import", json=body)
        assert r.status_code == 200, r.text
        res = r.json()
        assert res["mode"] == "replace"
        # In replace mode, every provided item is inserted (skipped == 0)
        for col, cnt in counts_before.items():
            assert res["results"][col]["inserted"] == cnt, f"{col} inserted mismatch: {res['results'][col]} vs {cnt}"
            assert res["results"][col]["skipped"] == 0

        # 3. Counts identical after replace round-trip
        exp2 = s.get(f"{API}/export").json()
        assert exp2["counts"] == counts_before

        # 4. Seeded transactions must still be present
        after = s.get(f"{API}/transactions", params={"q": TAG}).json()
        assert len(after) == 5


# ---------------------- MALFORMED INPUT ----------------------
class TestImportMalformed:
    def test_malformed_nondict_items_rejected_gracefully(self, s):
        """Non-dict entries are rejected by pydantic (422). Server must stay up.

        Note: server also has a defensive `if not isinstance(it, dict): continue`
        in prep() (server.py line 668) but it is unreachable because
        ImportBundle declares `transactions: List[dict]` — pydantic filters
        first. Either way the server does NOT crash.
        """
        body = {
            "transactions": ["not-a-dict", 12345, None],
            "mode": "merge",
        }
        r = s.post(f"{API}/import", json=body)
        # pydantic validation -> 422, no 5xx
        assert r.status_code == 422, r.text
        # server still alive
        assert s.get(f"{API}/").status_code == 200

    def test_import_dict_without_id_gets_uuid(self, s):
        """Valid dict items without an id must be assigned a uuid and inserted."""
        body = {
            "transactions": [
                {"type": "expense",
                 "scope": "personal",
                 "category": "lainnya",
                 "amount": 1234.0,
                 "description": f"{TAG} malformed-noid",
                 "date": datetime.now(timezone.utc).isoformat()},
            ],
            "assets": [
                {"name": f"{TAG} NoIdAsset", "kind": "cash", "balance": 100.0,
                 "created_at": datetime.now(timezone.utc).isoformat()},
            ],
            "mode": "merge",
        }
        r = s.post(f"{API}/import", json=body)
        assert r.status_code == 200, r.text
        res = r.json()["results"]
        assert res["transactions"]["inserted"] == 1, res
        assert res["assets"]["inserted"] == 1, res

        # cleanup
        got = s.get(f"{API}/transactions", params={"q": "malformed-noid"}).json()
        for t in got:
            s.delete(f"{API}/transactions/{t['id']}")
        assets = s.get(f"{API}/assets").json()
        for a in assets:
            if a.get("name", "").startswith(f"{TAG} NoIdAsset"):
                s.delete(f"{API}/assets/{a['id']}")

    def test_import_wrong_shape_returns_422(self, s):
        """Providing a completely wrong body should be rejected by pydantic, not crash."""
        r = s.post(f"{API}/import", json={"transactions": "not-a-list"})
        # pydantic validation should reject -> 422
        assert r.status_code in (400, 422), r.text
        # server still alive
        assert s.get(f"{API}/").status_code == 200

    def test_empty_bundle_ok(self, s):
        """Empty bundle in merge mode should be a no-op and return ok."""
        r = s.post(f"{API}/import", json={"mode": "merge"})
        assert r.status_code == 200, r.text
        res = r.json()
        assert res["ok"] is True
        for col in ["transactions", "assets", "bills", "contacts", "folders", "files"]:
            assert res["results"][col] == {"inserted": 0, "skipped": 0}
