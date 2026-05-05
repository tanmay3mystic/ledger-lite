# LedgerLite

> Upload bank statements → auto-parse → edit → export Tally-ready Excel.

Built for small business owners who want to reconcile faster without learning accounting software.

---

## Architecture

```
ledger-lite/
├── apps/
│   ├── web/        Next.js 14 (App Router) + Tailwind + TanStack Table
│   ├── api/        Express 4 (TypeScript) – upload, orchestration, Excel export
│   └── parser/     Python (FastAPI + pandas) – CSV/Excel parsing
└── turbo.json
```

**Data flow:**
```
Browser → POST /api/upload → Express API → POST /parse → Python parser
                                        ← JSON transactions ←
         ← transactions (JSON)
Browser edits table (Zustand)
Browser → POST /api/export → Express → Excel buffer → download
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| pnpm | 9+ |
| Python | 3.11+ |

---

## Local Setup

### 1. Install Node dependencies

```bash
npm install -g pnpm
pnpm install
```

### 2. Set up the Python parser

```bash
cd apps/parser
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Start all services

**Terminal 1 — Python parser:**
```bash
cd apps/parser
source .venv/bin/activate
uvicorn main:app --reload --port 8001
```

**Terminal 2 — Express API:**
```bash
cd apps/api
pnpm dev
# Runs on http://localhost:4000
```

**Terminal 3 — Next.js frontend:**
```bash
cd apps/web
pnpm dev
# Opens http://localhost:3000
```

Or run everything with Turborepo (except Python):
```bash
pnpm dev   # starts web + api concurrently
```

---

## Environment Variables

### apps/api/.env
```
PORT=4000
PARSER_URL=http://localhost:8001
NODE_ENV=development
```

### apps/web/.env.local
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## API Reference

### `POST /api/upload`
Upload one or more CSV/Excel files.

**Request:** `multipart/form-data`, field name `files`

**Response:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "date": "2024-04-02",
      "description": "NEFT Transfer",
      "amount": 5000.00,
      "type": "debit",
      "account": "statement.csv",
      "category": "Other",
      "reference": "REF001"
    }
  ],
  "count": 42
}
```

### `POST /api/export`
Export edited transactions as Excel.

**Request:** `{ "transactions": [...] }`

**Response:** Binary `.xlsx` file download.

---

## Supported Bank Formats

The parser recognises common column names from:

| Bank | Format |
|------|--------|
| SBI | CSV export |
| HDFC | CSV / Excel |
| ICICI | CSV |
| Axis Bank | CSV |
| Kotak | CSV |
| Generic | Any CSV with Date + Description + Amount columns |

---

## Running Tests

**Python:**
```bash
cd apps/parser
source .venv/bin/activate
pytest tests/ -v
```

---

## Deployment

### Frontend → Vercel

1. Import the repo in Vercel, set **Root Directory** to `apps/web`
2. Add env var: `NEXT_PUBLIC_API_URL=https://your-api.example.com`
3. Push to `main` — GitHub Actions deploys automatically

### API → Railway / Render / Fly.io

Deploy `apps/api` as a Node.js service. Set:
- `PARSER_URL=<your-python-service-url>`
- `PORT=4000`

### Python Parser → Railway / Render

Deploy `apps/parser` as a Python service:
```
Start command: uvicorn main:app --host 0.0.0.0 --port 8001
```

---

## Roadmap (post-MVP)

- [ ] PDF statement parsing (via OCR)
- [ ] Multi-bank template profiles
- [ ] Draft persistence (IndexedDB)
- [ ] Auto-categorisation (rule-based)
