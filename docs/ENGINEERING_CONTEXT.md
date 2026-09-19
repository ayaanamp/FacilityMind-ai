# Engineering Context & Workspace Memory

## 1. Architecture Overview
This workspace is an enterprise-grade agentic software platform foundation prepared for building complex Agentic AI applications.

### Core Stack:
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide icons, Vitest, Testing Library.
- **Backend**: Python 3.13+, FastAPI, Pydantic v2, Pydantic Settings, SQLAlchemy 2.0 (async), aiosqlite (SQLite dev / Postgres migration ready), LangGraph, LangChain Core, Pytest, Ruff.
- **Data & Persistence**: SQLite async (`./data/app.db`) for development; Chroma vector store (`./data/chroma`) ready for RAG pipelines.

---

## 2. Directory Ownership & Responsibilities
- `frontend/src/components/` & `frontend/src/` -> Frontend Engineer / UX Engineer
- `backend/app/api/` -> Backend / API Engineer
- `backend/app/agents/` -> Agent Orchestrator & AI Engineer
- `backend/app/rag/` -> Retrieval / AI Engineer
- `backend/app/database/` & `backend/app/models/` -> Backend / Database Persistence
- `backend/app/core/` & `backend/app/schemas/` -> Solution Architect & Backend
- `backend/tests/` & `frontend/tests/` -> QA Engineer
- `scripts/` -> DevOps & Quality Gate

---

## 3. Verified Development Commands (Windows PowerShell)

### Backend:
- Activate venv: `backend\.venv\Scripts\Activate.ps1`
- Run Server: `backend\.venv\Scripts\python -m uvicorn backend.app.main:app --reload --port 8000`
- Run Tests: `backend\.venv\Scripts\pytest backend/tests`
- Run Linter: `backend\.venv\Scripts\ruff check backend`

### Frontend:
- Run Dev Server: `npm.cmd --prefix frontend run dev`
- Run Build: `npm.cmd --prefix frontend run build`
- Run Tests: `npm.cmd --prefix frontend run test`
- Run Linter: `npm.cmd --prefix frontend run lint`

### Unified Quality Gate:
- Run verification script: `backend\.venv\Scripts\python scripts/verify.py`

---

## 4. Engineering Principles & Invariants
1. **Zero Fake State**: Never simulate fake completions, fake metrics, or fake agent traces.
2. **Single Source of Truth**: All configurations reside in `.env` / `backend/app/core/config.py`.
3. **Structured AI Outputs**: All LLM and Agent steps must use validated Pydantic schemas.
4. **Deterministic First**: Ordinary business logic must use deterministic code; AI is reserved for semantic analysis, reasoning, and synthesis.
