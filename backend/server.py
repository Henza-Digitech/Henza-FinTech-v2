from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============ MODELS ============
class TransactionIn(BaseModel):
    type: str  # "income" | "expense"
    scope: str = "personal"  # "personal" | "business"
    category: str  # e.g. konsumsi, transportasi, gaji, kesehatan, hiburan, cicilan, keluarga, lainnya, pendapatan
    amount: float
    description: str = ""
    date: Optional[str] = None
    receipt_photo: Optional[str] = None  # base64 data URI (small, optional)


class Transaction(TransactionIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)


class AssetIn(BaseModel):
    name: str  # e.g. "BCA", "GoPay", "Piutang Budi"
    kind: str  # "bank" | "ewallet" | "receivable" | "company" | "cash" | "other"
    balance: float
    notes: str = ""


class Asset(AssetIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)


class BillIn(BaseModel):
    name: str
    amount: float
    due_day: int  # day of month 1..31
    category: str = "lainnya"
    notes: str = ""
    active: bool = True


class Bill(BillIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)


class ContactIn(BaseModel):
    name: str
    address: str = ""
    phone: str = ""
    notes: str = ""


class Contact(ContactIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)


class ScheduleIn(BaseModel):
    name: str  # recipient / penerima
    amount: float
    date: str  # planned transfer date (ISO / YYYY-MM-DD)
    account: str = ""  # no rekening / bank
    notes: str = ""
    done: bool = False
    order: Optional[int] = None


class Schedule(ScheduleIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)


# ============ HELPERS ============
def to_public(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


# ============ TRANSACTIONS ============
@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(payload: TransactionIn):
    obj = Transaction(**payload.dict())
    if not obj.date:
        obj.date = now_iso()
    await db.transactions.insert_one(obj.dict())
    return obj


@api_router.get("/transactions", response_model=List[Transaction])
async def list_transactions(
    scope: Optional[str] = None,
    type: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    sort: str = "date_desc",
    limit: int = 500,
):
    query = {}
    if scope:
        query["scope"] = scope
    if type:
        query["type"] = type
    if category:
        query["category"] = category
    if q:
        query["description"] = {"$regex": q, "$options": "i"}
    sort_map = {
        "date_desc": [("date", -1)],
        "date_asc": [("date", 1)],
        "amount_desc": [("amount", -1)],
        "amount_asc": [("amount", 1)],
        "category_asc": [("category", 1), ("date", -1)],
    }
    sort_spec = sort_map.get(sort, sort_map["date_desc"])
    docs = await db.transactions.find(query, {"_id": 0}).sort(sort_spec).to_list(limit)
    return docs


@api_router.delete("/transactions/{tid}")
async def delete_transaction(tid: str):
    res = await db.transactions.delete_one({"id": tid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api_router.put("/transactions/{tid}", response_model=Transaction)
async def update_transaction(tid: str, payload: TransactionIn):
    existing = await db.transactions.find_one({"id": tid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    updates = payload.dict()
    if not updates.get("date"):
        updates["date"] = existing.get("date") or now_iso()
    await db.transactions.update_one({"id": tid}, {"$set": updates})
    existing.update(updates)
    return existing


# ============ ASSETS ============
@api_router.post("/assets", response_model=Asset)
async def create_asset(payload: AssetIn):
    obj = Asset(**payload.dict())
    await db.assets.insert_one(obj.dict())
    return obj


@api_router.get("/assets", response_model=List[Asset])
async def list_assets():
    docs = await db.assets.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.put("/assets/{aid}", response_model=Asset)
async def update_asset(aid: str, payload: AssetIn):
    existing = await db.assets.find_one({"id": aid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    existing.update(payload.dict())
    await db.assets.update_one({"id": aid}, {"$set": payload.dict()})
    return existing


@api_router.delete("/assets/{aid}")
async def delete_asset(aid: str):
    res = await db.assets.delete_one({"id": aid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ============ BILLS ============
@api_router.post("/bills", response_model=Bill)
async def create_bill(payload: BillIn):
    obj = Bill(**payload.dict())
    await db.bills.insert_one(obj.dict())
    return obj


@api_router.get("/bills", response_model=List[Bill])
async def list_bills():
    docs = await db.bills.find({}, {"_id": 0}).sort("due_day", 1).to_list(500)
    return docs


@api_router.put("/bills/{bid}", response_model=Bill)
async def update_bill(bid: str, payload: BillIn):
    existing = await db.bills.find_one({"id": bid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    await db.bills.update_one({"id": bid}, {"$set": payload.dict()})
    existing.update(payload.dict())
    return existing


@api_router.delete("/bills/{bid}")
async def delete_bill(bid: str):
    res = await db.bills.delete_one({"id": bid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ============ CONTACTS ============
@api_router.post("/contacts", response_model=Contact)
async def create_contact(payload: ContactIn):
    obj = Contact(**payload.dict())
    await db.contacts.insert_one(obj.dict())
    return obj


@api_router.get("/contacts", response_model=List[Contact])
async def list_contacts(q: Optional[str] = None):
    query = {}
    if q:
        query = {
            "$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"phone": {"$regex": q, "$options": "i"}},
                {"address": {"$regex": q, "$options": "i"}},
                {"notes": {"$regex": q, "$options": "i"}},
            ]
        }
    docs = await db.contacts.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    return docs


@api_router.put("/contacts/{cid}", response_model=Contact)
async def update_contact(cid: str, payload: ContactIn):
    existing = await db.contacts.find_one({"id": cid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    await db.contacts.update_one({"id": cid}, {"$set": payload.dict()})
    existing.update(payload.dict())
    return existing


@api_router.delete("/contacts/{cid}")
async def delete_contact(cid: str):
    res = await db.contacts.delete_one({"id": cid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ============ TRANSFER SCHEDULES ============
def _with_days_left(doc: dict) -> dict:
    today = datetime.now(timezone.utc).date()
    try:
        raw = doc.get("date") or ""
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
        doc["days_left"] = (dt - today).days
    except Exception:
        doc["days_left"] = None
    return doc


@api_router.post("/schedules", response_model=Schedule)
async def create_schedule(payload: ScheduleIn):
    obj = Schedule(**payload.dict())
    if obj.order is None:
        obj.order = await db.schedules.count_documents({})
    await db.schedules.insert_one(obj.dict())
    return obj


@api_router.get("/schedules")
async def list_schedules():
    docs = await db.schedules.find({}, {"_id": 0}).sort("order", 1).to_list(2000)
    return [_with_days_left(d) for d in docs]


@api_router.put("/schedules/{sid}", response_model=Schedule)
async def update_schedule(sid: str, payload: ScheduleIn):
    existing = await db.schedules.find_one({"id": sid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    updates = payload.dict()
    if updates.get("order") is None:
        updates["order"] = existing.get("order", 0)
    await db.schedules.update_one({"id": sid}, {"$set": updates})
    existing.update(updates)
    return existing


@api_router.delete("/schedules/{sid}")
async def delete_schedule(sid: str):
    res = await db.schedules.delete_one({"id": sid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


class ReorderPayload(BaseModel):
    ids: List[str] = []


@api_router.post("/schedules/reorder")
async def reorder_schedules(payload: ReorderPayload):
    for i, sid in enumerate(payload.ids):
        await db.schedules.update_one({"id": sid}, {"$set": {"order": i}})
    return {"ok": True, "count": len(payload.ids)}


# ============ SUMMARY / DASHBOARD ============
@api_router.get("/summary")
async def summary(scope: Optional[str] = None):
    query = {}
    if scope:
        query["scope"] = scope
    txs = await db.transactions.find(query, {"_id": 0}).to_list(5000)
    total_income = sum(t["amount"] for t in txs if t["type"] == "income")
    total_expense = sum(t["amount"] for t in txs if t["type"] == "expense")

    assets = await db.assets.find({}, {"_id": 0}).to_list(500)
    total_assets = sum(a["balance"] for a in assets)

    # Net = income - expense + cash assets held elsewhere
    net_cash = total_income - total_expense
    total_wealth = net_cash + total_assets
    expense_ratio = (total_expense / total_income) if total_income > 0 else 0.0

    # Category breakdown of expenses
    by_category: dict = {}
    for t in txs:
        if t["type"] == "expense":
            by_category[t["category"]] = by_category.get(t["category"], 0) + t["amount"]

    # Per-scope cash flow (personal vs business "rekening")
    def _scope_of(t: dict) -> str:
        return "business" if t.get("scope") == "business" else "personal"

    scope_agg = {
        "personal": {"income": 0.0, "expense": 0.0},
        "business": {"income": 0.0, "expense": 0.0},
    }
    for t in txs:
        sc = _scope_of(t)
        if t["type"] == "income":
            scope_agg[sc]["income"] += t["amount"]
        else:
            scope_agg[sc]["expense"] += t["amount"]
    by_scope = {
        sc: {
            "income": v["income"],
            "expense": v["expense"],
            "net": v["income"] - v["expense"],
        }
        for sc, v in scope_agg.items()
    }

    # Monthly series: last 6 months
    series = []
    today = datetime.now(timezone.utc)
    for i in range(5, -1, -1):
        # get first day of the target month
        month_ref = today.replace(day=1)
        for _ in range(i):
            month_ref = (month_ref - timedelta(days=1)).replace(day=1)
        y, m = month_ref.year, month_ref.month
        mi = 0.0
        me = 0.0
        for t in txs:
            try:
                d = datetime.fromisoformat(t["date"].replace("Z", "+00:00"))
                if d.year == y and d.month == m:
                    if t["type"] == "income":
                        mi += t["amount"]
                    else:
                        me += t["amount"]
            except Exception:
                pass
        series.append({
            "label": f"{month_ref.strftime('%b')}",
            "income": mi,
            "expense": me,
        })

    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "net_cash": net_cash,
        "total_assets": total_assets,
        "total_wealth": total_wealth,
        "expense_ratio": expense_ratio,
        "by_category": by_category,
        "by_scope": by_scope,
        "series": series,
        "transactions_count": len(txs),
    }


# ============ ANALYTICS ============
@api_router.get("/analytics")
async def analytics(months: int = 6, scope: Optional[str] = None):
    """Rich monthly breakdown for charting."""
    months = max(1, min(months, 24))
    query = {}
    if scope and scope != "all":
        query["scope"] = scope
    txs = await db.transactions.find(query, {"_id": 0}).to_list(20000)

    today = datetime.now(timezone.utc)
    series = []
    for i in range(months - 1, -1, -1):
        month_ref = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        for _ in range(i):
            month_ref = (month_ref - timedelta(days=1)).replace(day=1)
        y, m = month_ref.year, month_ref.month
        income = 0.0
        expense = 0.0
        cat_expense: dict = {}
        cat_income: dict = {}
        count = 0
        for t in txs:
            try:
                raw = t.get("date") or t.get("created_at")
                d = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                if d.year != y or d.month != m:
                    continue
                count += 1
                if t["type"] == "income":
                    income += t["amount"]
                    cat_income[t["category"]] = cat_income.get(t["category"], 0.0) + t["amount"]
                else:
                    expense += t["amount"]
                    cat_expense[t["category"]] = cat_expense.get(t["category"], 0.0) + t["amount"]
            except Exception:
                continue
        series.append({
            "label": month_ref.strftime("%b"),
            "month": m,
            "year": y,
            "key": f"{y}-{m:02d}",
            "income": income,
            "expense": expense,
            "net": income - expense,
            "count": count,
            "by_category_expense": cat_expense,
            "by_category_income": cat_income,
        })

    total_income = sum(s["income"] for s in series)
    total_expense = sum(s["expense"] for s in series)

    # Compare vs previous same-length window
    prev_income = 0.0
    prev_expense = 0.0
    ref = today.replace(day=1)
    for _ in range(months):
        ref = (ref - timedelta(days=1)).replace(day=1)
    # ref now points to month "months" before earliest displayed; go back "months" more
    start = ref
    for i in range(months):
        this_ref = start.replace(day=1)
        for _ in range(i):
            this_ref = (this_ref + timedelta(days=32)).replace(day=1)
        y, m = this_ref.year, this_ref.month
        for t in txs:
            try:
                raw = t.get("date") or t.get("created_at")
                d = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                if d.year == y and d.month == m:
                    if t["type"] == "income":
                        prev_income += t["amount"]
                    else:
                        prev_expense += t["amount"]
            except Exception:
                continue

    def pct(a: float, b: float) -> float:
        if b <= 0:
            return 0.0
        return (a - b) / b * 100

    return {
        "months": months,
        "scope": scope or "all",
        "series": series,
        "total_income": total_income,
        "total_expense": total_expense,
        "avg_income": total_income / months,
        "avg_expense": total_expense / months,
        "income_change_pct": pct(total_income, prev_income),
        "expense_change_pct": pct(total_expense, prev_expense),
    }


# ============ UPCOMING BILLS ============
@api_router.get("/bills/upcoming")
async def upcoming_bills(days: int = 7):
    bills = await db.bills.find({"active": True}, {"_id": 0}).to_list(500)
    today = datetime.now(timezone.utc)
    result = []
    for b in bills:
        # compute next due date
        due_day = min(max(int(b.get("due_day", 1)), 1), 28)
        this_month = today.replace(day=due_day, hour=0, minute=0, second=0, microsecond=0)
        if this_month < today.replace(hour=0, minute=0, second=0, microsecond=0):
            # move to next month
            next_month = (this_month.replace(day=1) + timedelta(days=32)).replace(day=due_day)
            due_date = next_month
        else:
            due_date = this_month
        days_left = (due_date.date() - today.date()).days
        b["due_date"] = due_date.isoformat()
        b["days_left"] = days_left
        if days_left <= days:
            result.append(b)
    result.sort(key=lambda x: x["days_left"])
    return result


# ============ AI SAVINGS TIPS ============
class TipsRequest(BaseModel):
    force: bool = False


@api_router.post("/ai/tips")
async def ai_savings_tips(payload: TipsRequest = TipsRequest()):
    """Generate Indonesian saving tips based on the user's spending pattern."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    txs = await db.transactions.find({}, {"_id": 0}).to_list(1000)
    if not txs:
        return {
            "tips": "Belum ada transaksi. Mulai catat pemasukan dan pengeluaran Anda untuk mendapatkan saran hemat berbasis AI.",
        }

    total_income = sum(t["amount"] for t in txs if t["type"] == "income")
    total_expense = sum(t["amount"] for t in txs if t["type"] == "expense")
    by_cat: dict = {}
    for t in txs:
        if t["type"] == "expense":
            by_cat[t["category"]] = by_cat.get(t["category"], 0) + t["amount"]

    top_cats = sorted(by_cat.items(), key=lambda x: -x[1])[:5]
    summary_text = (
        f"Total pemasukan: Rp {total_income:,.0f}. "
        f"Total pengeluaran: Rp {total_expense:,.0f}. "
        f"Kategori pengeluaran terbesar: "
        + ", ".join([f"{k}: Rp {v:,.0f}" for k, v in top_cats])
        + "."
    )

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    chat = LlmChat(
        api_key=api_key,
        session_id=f"tips-{uuid.uuid4()}",
        system_message=(
            "Anda adalah penasihat keuangan pribadi dan bisnis untuk pengguna Indonesia. "
            "Berikan saran singkat, praktis, dan spesifik dalam Bahasa Indonesia untuk membantu "
            "mengurangi rasio pengeluaran. Gunakan format: 3 poin bullet singkat (maks 20 kata per poin). "
            "Fokus pada kategori pengeluaran terbesar. Nada ramah dan profesional."
        ),
    ).with_model("openai", "gpt-5.4-mini")

    try:
        resp = await chat.send_message(UserMessage(text=summary_text))
        return {"tips": resp, "summary": summary_text}
    except Exception as e:
        logger.exception("AI tips failed")
        return {"tips": "Gagal memuat saran AI. Coba lagi nanti.", "error": str(e)}


# ============ FOLDERS & FILES (Company Documents) ============
class FolderIn(BaseModel):
    name: str
    notes: str = ""


class Folder(FolderIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)


class FileIn(BaseModel):
    name: str
    mime: str = "application/octet-stream"
    size: int = 0
    data: str  # base64 (no data URI prefix)


class FileMeta(BaseModel):
    id: str
    folder_id: str
    name: str
    mime: str
    size: int
    created_at: str


@api_router.post("/folders", response_model=Folder)
async def create_folder(payload: FolderIn):
    obj = Folder(**payload.dict())
    await db.folders.insert_one(obj.dict())
    return obj


@api_router.get("/folders")
async def list_folders(q: Optional[str] = None):
    query = {}
    if q:
        query = {
            "$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"notes": {"$regex": q, "$options": "i"}},
            ]
        }
    docs = await db.folders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    for d in docs:
        d["file_count"] = await db.files.count_documents({"folder_id": d["id"]})
    return docs


@api_router.put("/folders/{fid}", response_model=Folder)
async def update_folder(fid: str, payload: FolderIn):
    existing = await db.folders.find_one({"id": fid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    await db.folders.update_one({"id": fid}, {"$set": payload.dict()})
    existing.update(payload.dict())
    return existing


@api_router.delete("/folders/{fid}")
async def delete_folder(fid: str):
    res = await db.folders.delete_one({"id": fid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    await db.files.delete_many({"folder_id": fid})
    return {"ok": True}


@api_router.get("/folders/{fid}/files", response_model=List[FileMeta])
async def list_files(fid: str):
    docs = await db.files.find(
        {"folder_id": fid}, {"_id": 0, "data": 0}
    ).sort("created_at", -1).to_list(500)
    return docs


@api_router.post("/folders/{fid}/files", response_model=FileMeta)
async def upload_file(fid: str, payload: FileIn):
    folder = await db.folders.find_one({"id": fid}, {"_id": 0})
    if not folder:
        raise HTTPException(404, "Folder not found")
    obj = {
        "id": str(uuid.uuid4()),
        "folder_id": fid,
        "name": payload.name,
        "mime": payload.mime,
        "size": payload.size,
        "data": payload.data,
        "created_at": now_iso(),
    }
    await db.files.insert_one(obj)
    return {k: v for k, v in obj.items() if k != "data"}


@api_router.get("/files/{file_id}")
async def get_file(file_id: str):
    doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str):
    res = await db.files.delete_one({"id": file_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ============ EXPORT / IMPORT (Backup) ============
class ImportBundle(BaseModel):
    transactions: List[dict] = []
    assets: List[dict] = []
    bills: List[dict] = []
    contacts: List[dict] = []
    folders: List[dict] = []
    files: List[dict] = []
    schedules: List[dict] = []
    mode: str = "merge"  # "merge" (skip duplicates by id) or "replace" (wipe first)


@api_router.get("/export")
async def export_all(include_files: bool = True):
    """Return all user data as one JSON bundle for backup / migration."""
    txs = await db.transactions.find({}, {"_id": 0}).to_list(100000)
    assets = await db.assets.find({}, {"_id": 0}).to_list(10000)
    bills = await db.bills.find({}, {"_id": 0}).to_list(10000)
    contacts = await db.contacts.find({}, {"_id": 0}).to_list(10000)
    folders = await db.folders.find({}, {"_id": 0}).to_list(10000)
    schedules = await db.schedules.find({}, {"_id": 0}).to_list(10000)
    if include_files:
        files = await db.files.find({}, {"_id": 0}).to_list(10000)
    else:
        files = await db.files.find({}, {"_id": 0, "data": 0}).to_list(10000)
    return {
        "app": "HENZA_FINTECH",
        "version": 1,
        "exported_at": now_iso(),
        "counts": {
            "transactions": len(txs),
            "assets": len(assets),
            "bills": len(bills),
            "contacts": len(contacts),
            "folders": len(folders),
            "files": len(files),
            "schedules": len(schedules),
        },
        "transactions": txs,
        "assets": assets,
        "bills": bills,
        "contacts": contacts,
        "folders": folders,
        "files": files,
        "schedules": schedules,
    }


@api_router.post("/import")
async def import_all(bundle: ImportBundle):
    """Restore data from an export bundle. Merge (default) or replace."""
    if bundle.mode == "replace":
        await db.transactions.delete_many({})
        await db.assets.delete_many({})
        await db.bills.delete_many({})
        await db.contacts.delete_many({})
        await db.folders.delete_many({})
        await db.files.delete_many({})
        await db.schedules.delete_many({})

    def prep(items):
        out = []
        for it in items:
            if not isinstance(it, dict):
                continue
            it.pop("_id", None)
            if not it.get("id"):
                it["id"] = str(uuid.uuid4())
            out.append(it)
        return out

    results = {}
    for name, items in [
        ("transactions", bundle.transactions),
        ("assets", bundle.assets),
        ("bills", bundle.bills),
        ("contacts", bundle.contacts),
        ("folders", bundle.folders),
        ("files", bundle.files),
        ("schedules", bundle.schedules),
    ]:
        cleaned = prep(items)
        inserted = 0
        skipped = 0
        col = getattr(db, name)
        for it in cleaned:
            exists = await col.find_one({"id": it["id"]}, {"_id": 0})
            if exists and bundle.mode == "merge":
                skipped += 1
                continue
            if exists:
                await col.delete_one({"id": it["id"]})
            await col.insert_one(it)
            inserted += 1
        results[name] = {"inserted": inserted, "skipped": skipped}
    return {"ok": True, "mode": bundle.mode, "results": results}


# ============ ROOT ============
@api_router.get("/")
async def root():
    return {"message": "HENZA FINTECH API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
