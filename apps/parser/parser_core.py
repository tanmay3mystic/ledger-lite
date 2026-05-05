"""
Core parsing logic. Handles CSV and Excel files and normalises them into the
standard LedgerLite transaction schema.

Heuristics used:
  - Detect header row automatically
  - Map common column names from Indian banks (SBI, HDFC, ICICI, Axis, Kotak)
  - Infer debit/credit from signed amounts or separate Debit/Credit columns
  - Default category to "Other" – users edit in the UI
"""

import io
import re
from datetime import datetime, date
from typing import IO, Any

import pandas as pd


# ── Column name aliases ────────────────────────────────────────────────────────

DATE_ALIASES = [
    "date", "txn date", "transaction date", "value date", "posting date",
    "trans date", "tran date",
]
DESC_ALIASES = [
    "description", "narration", "particulars", "remarks", "details",
    "transaction details", "txn remarks", "transaction narration",
]
DEBIT_ALIASES = [
    "debit", "debit amount", "withdrawal", "withdrawal amount",
    "dr amount", "dr", "withdrawals",
]
CREDIT_ALIASES = [
    "credit", "credit amount", "deposit", "deposit amount",
    "cr amount", "cr", "deposits",
]
AMOUNT_ALIASES = [
    "amount", "transaction amount", "txn amount", "net amount",
]
REF_ALIASES = [
    "reference", "ref no", "reference no", "chq no", "cheque no",
    "cheque number", "transaction id", "txn id", "utr",
]


def _normalise_col(name: str) -> str:
    return re.sub(r"\s+", " ", str(name).strip().lower())


def _find_col(cols: list[str], aliases: list[str]) -> str | None:
    normed = {_normalise_col(c): c for c in cols}
    for alias in aliases:
        if alias in normed:
            return normed[alias]
    return None


# ── Date parsing ───────────────────────────────────────────────────────────────

_DATE_FORMATS = [
    "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y",
    "%d-%b-%Y", "%d %b %Y", "%d-%B-%Y",
    "%d-%m-%y", "%d/%m/%y",
]


def _parse_date(val: Any) -> str:
    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return s  # return raw if unparseable


# ── Amount parsing ─────────────────────────────────────────────────────────────

def _parse_amount(val: Any) -> float:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return 0.0
    s = re.sub(r"[₹,\s]", "", str(val))
    try:
        return float(s)
    except ValueError:
        return 0.0


# ── Main parser ────────────────────────────────────────────────────────────────

def parse_file(stream: IO[bytes], filename: str) -> list[dict]:
    ext = filename.rsplit(".", 1)[-1].lower()

    if ext == "csv":
        df = _load_csv(stream)
    elif ext in ("xlsx", "xls"):
        df = _load_excel(stream, ext)
    else:
        raise ValueError(f"Unsupported file type: .{ext}")

    return _normalise(df, filename)


def _load_csv(stream: IO[bytes]) -> pd.DataFrame:
    raw = stream.read()
    # Try UTF-8 first, fall back to latin-1 (common in Indian bank exports)
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            df = pd.read_csv(io.BytesIO(raw), encoding=enc, skip_blank_lines=True)
            df = _drop_junk_rows(df)
            return df
        except Exception:
            continue
    raise ValueError("Could not read CSV file")


def _load_excel(stream: IO[bytes], ext: str) -> pd.DataFrame:
    engine = "openpyxl" if ext == "xlsx" else "xlrd"
    try:
        df = pd.read_excel(stream, engine=engine, skip_blank_lines=True)
    except Exception:
        # Some banks export .xlsx with xlrd-compatible format
        df = pd.read_excel(stream, skip_blank_lines=True)
    return _drop_junk_rows(df)


def _drop_junk_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Remove rows that are entirely NaN or look like bank statement metadata."""
    df = df.dropna(how="all")
    # Drop rows where more than 70% of cells are NaN
    threshold = int(len(df.columns) * 0.7)
    df = df.dropna(thresh=max(threshold, 2))
    return df.reset_index(drop=True)


def _normalise(df: pd.DataFrame, source_name: str) -> list[dict]:
    cols = list(df.columns)

    date_col = _find_col(cols, DATE_ALIASES)
    desc_col = _find_col(cols, DESC_ALIASES)
    debit_col = _find_col(cols, DEBIT_ALIASES)
    credit_col = _find_col(cols, CREDIT_ALIASES)
    amount_col = _find_col(cols, AMOUNT_ALIASES)
    ref_col = _find_col(cols, REF_ALIASES)

    if not date_col:
        raise ValueError(
            "Could not find a date column. "
            "Expected column names: date, txn date, transaction date, value date, etc."
        )
    if not desc_col:
        raise ValueError(
            "Could not find a description column. "
            "Expected: description, narration, particulars, remarks, etc."
        )

    transactions = []

    for _, row in df.iterrows():
        date_val = _parse_date(row[date_col])

        # Skip rows that don't look like transactions (e.g. totals rows)
        if not date_val or date_val in ("nan", "NaT", ""):
            continue

        desc = str(row[desc_col]).strip() if desc_col else ""

        ref = str(row[ref_col]).strip() if ref_col else ""
        if ref in ("nan", "NaN", ""):
            ref = ""

        # Resolve amount and type
        if debit_col and credit_col:
            debit_amt = _parse_amount(row[debit_col])
            credit_amt = _parse_amount(row[credit_col])

            if debit_amt > 0:
                amount = debit_amt
                txn_type = "debit"
            elif credit_amt > 0:
                amount = credit_amt
                txn_type = "credit"
            else:
                # Both zero — skip
                continue

        elif amount_col:
            raw_amt = _parse_amount(row[amount_col])
            if raw_amt < 0:
                amount = abs(raw_amt)
                txn_type = "debit"
            else:
                amount = raw_amt
                txn_type = "credit"
        else:
            # Try to use any numeric column as amount
            numeric_cols = df.select_dtypes(include="number").columns.tolist()
            if numeric_cols:
                raw_amt = _parse_amount(row[numeric_cols[0]])
                amount = abs(raw_amt)
                txn_type = "debit" if raw_amt < 0 else "credit"
            else:
                continue

        if amount == 0:
            continue

        transactions.append(
            {
                "date": date_val,
                "description": desc,
                "amount": round(amount, 2),
                "type": txn_type,
                "account": source_name,
                "category": "Other",
                "reference": ref,
            }
        )

    return transactions
