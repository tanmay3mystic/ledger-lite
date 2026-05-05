"""
Core parsing logic. Handles CSV and Excel files and normalises them into the
standard LedgerLite transaction schema.

Heuristics used:
  - Auto-detect the header row by scanning the first 30 rows for known keywords
    (handles Indian bank statements with metadata headers before the table)
  - Prefix-based column matching ("Withdrawal Amt." → matches alias "withdrawal")
  - Separate Debit/Credit columns OR signed single Amount column
  - Separator rows (all * or ---) filtered out after load
  - Default category "Other" — user edits in the UI
"""

import io
import re
from datetime import datetime, date
from typing import IO, Any

import pandas as pd


# ── Column name aliases ────────────────────────────────────────────────────────
# Lower-case, single-space normalised. Prefix matching is used as fallback,
# so shorter aliases like "withdrawal" will match "Withdrawal Amt." too.

DATE_ALIASES = [
    "date", "txn date", "transaction date", "value date", "posting date",
    "trans date", "tran date", "valuedate", "txndate", "transactiondate",
    "book date", "entry date",
]
DESC_ALIASES = [
    "narration", "description", "particulars", "remarks", "details",
    "transaction details", "txn remarks", "transaction narration",
    "transaction remarks", "trans description", "trans particulars",
    "transaction particulars", "merchant name",
]
DEBIT_ALIASES = [
    "withdrawal", "debit", "dr",
    "withdrawal amount", "debit amount", "dr amount",
    "withdrawals", "debit(inr)", "withdrawal(inr)", "debit(rs)", "dr(inr)",
    "paid out",
]
CREDIT_ALIASES = [
    "deposit", "credit", "cr",
    "deposit amount", "credit amount", "cr amount",
    "deposits", "credit(inr)", "deposit(inr)", "credit(rs)", "cr(inr)",
    "paid in",
]
AMOUNT_ALIASES = [
    "amount", "transaction amount", "txn amount", "net amount",
    "amount(inr)", "amount(rs)", "transaction amount(inr)",
]
REF_ALIASES = [
    "chq./ref.no.", "chq/ref.no.", "chq. / ref.no.", "chq/ref no",
    "reference", "ref no", "reference no", "chq no", "cheque no",
    "cheque number", "transaction id", "txn id", "utr", "utr no",
    "ref number", "chq/ref number", "instrument id",
]

# Union of all known header terms — used by the header-row detector
_HEADER_KEYWORDS = set(
    DATE_ALIASES + DESC_ALIASES + DEBIT_ALIASES
    + CREDIT_ALIASES + AMOUNT_ALIASES + REF_ALIASES
)

# Regex that identifies separator / filler rows (e.g. "****", "----", "====")
_SEPARATOR_RE = re.compile(r"^[*\-=\s]+$")


# ── Column helpers ─────────────────────────────────────────────────────────────

def _normalise_col(name: str) -> str:
    return re.sub(r"\s+", " ", str(name).strip().lower())


def _find_col(cols: list[str], aliases: list[str]) -> str | None:
    normed = {_normalise_col(c): c for c in cols}

    # Pass 1: exact match
    for alias in aliases:
        if alias in normed:
            return normed[alias]

    # Pass 2: column name starts with alias
    # (e.g. "Withdrawal Amt." starts with "withdrawal", len guard avoids "dr"→"draft")
    for alias in aliases:
        if len(alias) < 4:
            continue
        for norm_col, orig_col in normed.items():
            if norm_col.startswith(alias):
                return orig_col

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
    return ""  # unparseable → caller will skip the row


# ── Amount parsing ─────────────────────────────────────────────────────────────

def _parse_amount(val: Any) -> float:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return 0.0
    s = re.sub(r"[₹,\s]", "", str(val))
    try:
        return float(s)
    except ValueError:
        return 0.0


# ── Main entry point ───────────────────────────────────────────────────────────

def parse_file(stream: IO[bytes], filename: str) -> list[dict]:
    ext = filename.rsplit(".", 1)[-1].lower()

    if ext == "csv":
        df = _load_csv(stream)
    elif ext in ("xlsx", "xls"):
        df = _load_excel(stream, ext)
    else:
        raise ValueError(f"Unsupported file type: .{ext}")

    return _normalise(df, filename)


# ── Loaders ────────────────────────────────────────────────────────────────────

def _load_csv(stream: IO[bytes]) -> pd.DataFrame:
    raw = stream.read()
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            skip = _detect_header_row_csv(raw, enc)
            df = pd.read_csv(
                io.BytesIO(raw), encoding=enc,
                skiprows=skip, skip_blank_lines=True,
            )
            df = _drop_junk_rows(df)
            if len(df) > 0:
                return df
        except Exception:
            continue
    raise ValueError("Could not read CSV file")


def _load_excel(stream: IO[bytes], ext: str) -> pd.DataFrame:
    raw = stream.read()
    engine = "openpyxl" if ext == "xlsx" else "xlrd"
    skip = _detect_header_row_excel(raw, engine)
    try:
        df = pd.read_excel(io.BytesIO(raw), engine=engine, skiprows=skip)
    except Exception:
        df = pd.read_excel(io.BytesIO(raw), skiprows=skip)
    return _drop_junk_rows(df)


# ── Header-row detection ───────────────────────────────────────────────────────

def _score_row(row: "pd.Series") -> int:
    """Count how many cells in a row match a known header keyword."""
    return sum(
        1 for cell in row
        if _normalise_col(str(cell)) in _HEADER_KEYWORDS
    )


def _detect_header_row_csv(raw: bytes, encoding: str) -> int:
    try:
        probe = pd.read_csv(
            io.BytesIO(raw), encoding=encoding, header=None,
            nrows=30, on_bad_lines="skip",
        )
    except Exception:
        return 0
    return _best_header_row(probe)


def _detect_header_row_excel(raw: bytes, engine: str) -> int:
    try:
        probe = pd.read_excel(
            io.BytesIO(raw), engine=engine, header=None, nrows=30
        )
    except Exception:
        return 0
    return _best_header_row(probe)


def _best_header_row(probe: "pd.DataFrame") -> int:
    best_row, best_score = 0, 0
    for idx, row in probe.iterrows():
        score = _score_row(row)
        if score > best_score:
            best_score, best_row = score, int(str(idx))
    return best_row if best_score >= 1 else 0


# ── Row cleaning ───────────────────────────────────────────────────────────────

def _is_separator_row(row: "pd.Series") -> bool:
    """True if every non-NaN cell looks like a separator (all * or - or =)."""
    non_null = [v for v in row if not (isinstance(v, float) and pd.isna(v))]
    if not non_null:
        return True
    return all(_SEPARATOR_RE.match(str(v).strip()) for v in non_null)


def _drop_junk_rows(df: pd.DataFrame) -> pd.DataFrame:
    df = df.dropna(how="all")
    threshold = int(len(df.columns) * 0.7)
    df = df.dropna(thresh=max(threshold, 2))
    df = df[~df.apply(_is_separator_row, axis=1)]
    return df.reset_index(drop=True)


# ── Normalisation ──────────────────────────────────────────────────────────────

def _normalise(df: pd.DataFrame, source_name: str) -> list[dict]:
    cols = list(df.columns)

    date_col   = _find_col(cols, DATE_ALIASES)
    desc_col   = _find_col(cols, DESC_ALIASES)
    debit_col  = _find_col(cols, DEBIT_ALIASES)
    credit_col = _find_col(cols, CREDIT_ALIASES)
    amount_col = _find_col(cols, AMOUNT_ALIASES)
    ref_col    = _find_col(cols, REF_ALIASES)

    if not date_col:
        raise ValueError(
            f"Could not find a date column in: {cols}. "
            "Expected headers like: Date, Txn Date, Value Date, etc."
        )
    if not desc_col:
        raise ValueError(
            f"Could not find a description column in: {cols}. "
            "Expected headers like: Narration, Description, Particulars, etc."
        )

    transactions = []

    for _, row in df.iterrows():
        date_val = _parse_date(row[date_col])
        if not date_val:
            # Unparseable date = separator / summary row — skip
            continue

        desc = str(row[desc_col]).strip() if desc_col else ""
        if desc in ("nan", "NaN", ""):
            desc = ""

        ref = str(row[ref_col]).strip() if ref_col else ""
        if ref in ("nan", "NaN", ""):
            ref = ""

        # ── Resolve amount + type ──────────────────────────────────────────
        if debit_col and credit_col:
            debit_amt  = _parse_amount(row[debit_col])
            credit_amt = _parse_amount(row[credit_col])

            if debit_amt > 0:
                amount, txn_type = debit_amt, "debit"
            elif credit_amt > 0:
                amount, txn_type = credit_amt, "credit"
            else:
                continue  # both zero → skip (e.g. opening balance row)

        elif amount_col:
            raw_amt = _parse_amount(row[amount_col])
            if raw_amt < 0:
                amount, txn_type = abs(raw_amt), "debit"
            else:
                amount, txn_type = raw_amt, "credit"

        else:
            # Last resort: first numeric column
            numeric_cols = df.select_dtypes(include="number").columns.tolist()
            if not numeric_cols:
                continue
            raw_amt = _parse_amount(row[numeric_cols[0]])
            amount  = abs(raw_amt)
            txn_type = "debit" if raw_amt < 0 else "credit"

        if amount == 0:
            continue

        transactions.append({
            "date":        date_val,
            "description": desc,
            "amount":      round(amount, 2),
            "type":        txn_type,
            "account":     source_name,
            "category":    "Other",
            "reference":   ref,
        })

    return transactions
