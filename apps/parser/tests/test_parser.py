"""Basic smoke tests for the parser core."""

import io
import pytest
from parser_core import parse_file


SAMPLE_CSV = b"""Date,Description,Debit,Credit,Reference
01-04-2024,Opening Balance,,,
02-04-2024,NEFT Transfer to XYZ,5000.00,,REF001
05-04-2024,Salary Credit,,50000.00,SAL2024
10-04-2024,Electricity Bill,1200.50,,EB-APR
15-04-2024,GST Payment,18000.00,,GST-Q4
20-04-2024,Customer Payment,,25000.00,INV-042
"""


def test_parse_csv_basic():
    txns = parse_file(io.BytesIO(SAMPLE_CSV), "test.csv")
    assert len(txns) == 5
    assert all("date" in t for t in txns)
    assert all("amount" in t for t in txns)
    assert all(t["amount"] > 0 for t in txns)


def test_debit_credit_types():
    txns = parse_file(io.BytesIO(SAMPLE_CSV), "test.csv")
    debits = [t for t in txns if t["type"] == "debit"]
    credits = [t for t in txns if t["type"] == "credit"]
    assert len(debits) == 3
    assert len(credits) == 2


def test_date_normalised():
    txns = parse_file(io.BytesIO(SAMPLE_CSV), "test.csv")
    assert txns[0]["date"] == "2024-04-02"


def test_default_category():
    txns = parse_file(io.BytesIO(SAMPLE_CSV), "test.csv")
    assert all(t["category"] == "Other" for t in txns)


def test_unsupported_format():
    with pytest.raises(ValueError, match="Unsupported"):
        parse_file(io.BytesIO(b""), "file.pdf")
