# Contributing to CampusAgent AI

Thank you for your interest in contributing to **CampusAgent AI**! We welcome bug fixes, performance optimizations, documentation improvements, and architectural enhancements.

---

## Code of Conduct & Ground Rules

1. **Verify Before Submitting**: Always test your changes locally across both the Next.js frontend and the FastAPI backend before opening a pull request.
2. **Preserve Multi-Tenant Isolation**: Never modify database queries or vector search filters in a way that removes or weakens `user_id` isolation.
3. **No Leaked Secrets**: Never commit real credentials, API tokens, or `.env` / `.env.local` files.
4. **Clean Code**: Follow TypeScript strict typing in the frontend and Pydantic validation schemas in the backend.

---

## Development Setup

### 1. Fork and Clone
```bash
git clone https://github.com/<your-username>/campusagent-ai.git
cd campusagent-ai
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
cp ../.env.example .env
# Fill in MONGODB_URL, JWT_SECRET_KEY, GROQ_API_KEY, HF_TOKEN, QDRANT_URL, etc.
uvicorn app.main:app --reload
```
The backend will be available at `http://127.0.0.1:8000` with interactive Swagger docs at `http://127.0.0.1:8000/docs`.

### 3. Frontend Setup
```bash
cd ../frontend
npm install
cp ../.env.example .env.local
npm run dev
```
The frontend will be available at `http://localhost:3000`.

---

## Branching Conventions

Name your branches descriptively with appropriate prefixes:
- `feat/feature-name`: New features or capabilities
- `fix/bug-description`: Bug fixes and error remediations
- `docs/documentation-topic`: Documentation updates
- `refactor/scope`: Code refactoring without behavioral changes
- `perf/optimization-area`: Performance and latency improvements

---

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

**Common Types:**
- `feat`: A new feature (e.g., `feat(rag): add streaming answer support`)
- `fix`: A bug fix (e.g., `fix(attendance): handle zero total classes gracefully`)
- `docs`: Documentation updates (e.g., `docs(api): document practice test submit endpoint`)
- `refactor`: Code restructuring without adding features or fixing bugs
- `chore`: Dependency updates, tooling, or repository maintenance

---

## Pull Request Checklist

Before submitting a pull request, ensure you have completed the following:

- [ ] Tested locally:
  - Frontend builds cleanly: `cd frontend && npm run build`
  - Backend modules import without errors: `cd backend && python -c "import app.main; print('Clean')"`
- [ ] Multi-tenant isolation verified (`user_id` enforced on queries and vector lookups).
- [ ] No extraneous console logs, debug statements, or hardcoded secrets.
- [ ] Documented any new environment variables in `.env.example`.
- [ ] PR description explains the **problem solved**, **implementation details**, and **how to verify**.
