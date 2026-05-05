"""
LedgerLite Parser Service
Accepts a bank statement file (CSV/Excel) and returns normalized transactions.
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import io

from parser_core import parse_file

app = FastAPI(title="LedgerLite Parser", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/parse")
async def parse(file: UploadFile = File(...)):
    content = await file.read()
    filename = file.filename or "upload"

    try:
        transactions = parse_file(io.BytesIO(content), filename)
        return {"transactions": transactions, "count": len(transactions)}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse error: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
