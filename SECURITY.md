# Security Policy — CampusAgent AI

CampusAgent AI takes application security, student data privacy, and multi-tenant isolation seriously. This document outlines the security controls currently implemented in the codebase and our responsible disclosure policy.

---

## Implemented Security Controls

CampusAgent AI incorporates defence-in-depth measures across its application and data layers:

### 1. Authentication & Session Security
- **Stateless JWT Tokens**: Authenticated endpoints require standard `Authorization: Bearer <token>` HTTP headers.
- **Cryptographic Password Hashing**: User passwords are encrypted using `bcrypt` via Passlib (`CryptContext(schemes=["bcrypt"])`). Passwords are never stored in plaintext or logged.
- **Payload Sanitization**: User model responses explicitly strip password hashes before serializing JSON payloads.
- **Role Guardrails**: Signup defaults strictly to `student` role to prevent privilege escalation attacks.

### 2. Multi-Tenant Data & Vector Isolation
- **Ownership Verification**: All CRUD operations on MongoDB collections (`subjects`, `assignments`, `attendance`, `practice_tests`, `rag_documents`) require and filter by the caller's verified `user_id` extracted from the decoded JWT.
- **Vector Isolation in Qdrant**: Similarity searches and point deletions require an explicit `FieldCondition(key="user_id", match=MatchValue(value=user_id))`. Users cannot query, retrieve, or delete vectors belonging to another user.
- **Payload Indexing**: The vector collection automatically provisions keyword payload indexes for `user_id` and `document_id` to ensure filtered queries execute securely and reliably.

### 3. Ingestion & RAG Safety Controls
- **In-Memory PDF Parsing**: File bytes are streamed into `io.BytesIO` in memory, avoiding server disk I/O vulnerabilities and temporary file locks on ephemeral hosting instances.
- **File Size & Content Restrictions**: Maximum file upload size is capped at 10 MB. Ingestion enforces a minimum threshold of 50 extracted characters, rejecting empty or unparseable scanned documents.
- **Atomic Compensation Rollback**: If Qdrant vector storage fails during document ingestion, the system automatically triggers a compensation transaction deleting the MongoDB metadata record, preventing orphaned state.
- **Hallucination & Grounding Guardrails**: RAG prompts enforce context boundaries instructing the model to rely exclusively on retrieved PDF text and explicitly state if information is absent.

### 4. AI Guardrails & Input Validation
- **Destructive Command Filters**: The AI Command Agent evaluates prompts against safety guardrails to block mass data deletion commands (e.g., `delete all`, `wipe database`, `drop table`).
- **Pydantic Validation**: All incoming requests undergo strict schema validation (string lengths, type checks, email formatting).
- **Error Serialization**: Both FastAPI backend exception handlers and Next.js frontend utility helpers (`lib/error.ts`) safely parse nested validation errors (such as HTTP 422 arrays) to eliminate runtime unhandled exceptions.

---

## Reporting a Vulnerability

If you discover a potential security vulnerability in CampusAgent AI, please report it responsibly rather than opening a public issue.

1. Submit a private vulnerability report via **GitHub Security Advisories** on this repository:
   `https://github.com/AnzarKhan855/campusagent-ai/security/advisories/new`
2. Alternatively, reach out directly to the repository maintainer through their GitHub profile:
   `https://github.com/AnzarKhan855`

Please include:
- A description of the vulnerability and its potential impact.
- Step-by-step reproduction steps or a minimal proof-of-concept (PoC).
- Any proposed remediation steps or code snippets.

We will review the report, investigate the issue, and release a patch as quickly as possible.
