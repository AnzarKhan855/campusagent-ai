# CampusAgent AI — System Architecture Deep Dive

This document details the architectural design, component interactions, data flows, and security boundaries implemented in **CampusAgent AI**.

---

## 1. High-Level System Architecture

CampusAgent AI is architected as a decoupled client-server application combining an asynchronous REST API backend with a modern React/Next.js frontend, backed by persistent document and vector storage services.

```mermaid
flowchart TB
    subgraph Client ["Client Layer (Vercel)"]
        User(["Student / User"])
        FE["Next.js 16 App Router\n(React 19, TypeScript, Tailwind CSS v4)"]
        Recharts["Recharts Visualizations\n(Attendance & Topic Analytics)"]
        ErrorLib["Safe Error Handler\n(lib/error.ts)"]
        User --> FE
        FE --- Recharts
        FE --- ErrorLib
    end

    subgraph API ["Backend API Layer (Render)"]
        Gateway["FastAPI 0.138 (Async ASGI)"]
        CORS["CORS Middleware\n(Origin Filtering)"]
        AuthMiddleware["JWT Bearer Authentication\n(python-jose + bcrypt)"]
        Validation["Pydantic Schemas\n(Request Validation & 422 Handler)"]
        
        Gateway --> CORS --> AuthMiddleware --> Validation
    end

    subgraph Routers ["Application Modules"]
        R_Auth["routes_auth.py"]
        R_Sub["routes_subjects.py"]
        R_Asg["routes_assignments.py"]
        R_Att["routes_attendance.py"]
        R_Dash["routes_dashboard.py"]
        R_AI["routes_ai.py\n(AI Command Center)"]
        R_Test["routes_practice_tests.py\n(Parallel Grading)"]
        R_RAG["rag_routes.py\n(Document RAG)"]
        
        Validation --> R_Auth
        Validation --> R_Sub
        Validation --> R_Asg
        Validation --> R_Att
        Validation --> R_Dash
        Validation --> R_AI
        Validation --> R_Test
        Validation --> R_RAG
    end

    subgraph Data ["Data & Vector Layer"]
        Mongo[("MongoDB Atlas\n(Users, Subjects, Assignments,\nAttendance, Practice Tests, Docs)")]
        Qdrant[("Qdrant Cloud Vector DB\n(Collection: campusagent_rag\nDim: 384, Cosine Distance)")]
    end

    subgraph AI ["AI & Embedding Engines"]
        GroqPrimary["Groq API: groq/compound-mini\n(Primary LLM)"]
        GroqFallback["Groq API: qwen/qwen3.8-27b\n(Automatic Fallback)"]
        HF_Embeddings["Hugging Face Inference API\n(sentence-transformers/all-MiniLM-L6-v2)"]
    end

    FE -- "HTTPS / JSON / JWT" --> Gateway
    R_Auth & R_Sub & R_Asg & R_Att & R_Dash & R_Test & R_RAG <--> Mongo
    R_RAG <--> Qdrant
    R_RAG <--> HF_Embeddings
    R_AI & R_Asg & R_Test & R_RAG <--> GroqPrimary
    GroqPrimary -. "On Failure / 429" .-> GroqFallback
```

---

## 2. Multi-Tenant Security & Isolation Boundary

Data confidentiality and multi-tenant separation are enforced at the service level across both the document database and the vector store:

```mermaid
sequenceDiagram
    autonumber
    actor User as Authenticated Student
    participant FE as Next.js Client
    participant API as FastAPI Backend
    participant Auth as Auth Module (JWT)
    participant Mongo as MongoDB Atlas
    participant Qdrant as Qdrant Vector Store

    User->>FE: Trigger Action (e.g. Query RAG or View Assignments)
    FE->>API: HTTP Request + Bearer Token
    API->>Auth: Decode & Validate JWT
    alt Invalid / Expired Token
        Auth-->>FE: 401 Unauthorized
    else Valid Token
        Auth-->>API: User Context (user_id: string)
        Note over API,Mongo: All Mongo queries filter strictly by {"user_id": user_id}
        API->>Mongo: find({"user_id": user_id, ...})
        Mongo-->>API: Authorized User Documents
        Note over API,Qdrant: All vector operations enforce FieldCondition(key="user_id", match=user_id)
        API->>Qdrant: query_points(query_vector, filter: user_id == user_id)
        Qdrant-->>API: Tenant-Isolated Vector Points
        API-->>FE: 200 OK (Sanitized Data)
        FE-->>User: Render Dashboard
    end
```

---

## 3. RAG Pipeline & Atomic Rollback Compensation

Document ingestion and question answering follow a strict pipeline designed to handle network partitions and prevent orphaned records in MongoDB:

```mermaid
flowchart TD
    Start([User Uploads PDF]) --> MemCheck{Validate File}
    MemCheck -- Size > 10MB or Non-PDF --> Err1[400 Bad Request]
    MemCheck -- Valid --> Parse[In-Memory Text Extraction\npdfminer.six io.BytesIO]
    
    Parse --> TextCheck{Extracted Chars >= 50?}
    TextCheck -- No --> Err2[400 Bad Request: Scanned/Empty PDF]
    TextCheck -- Yes --> Chunk[Sliding Window Chunking\n800 Chars, 150 Overlap, 650 Stride]
    
    Chunk --> Emb[Generate 384-d Embeddings\nHugging Face API / Local Fallback]
    Emb --> MongoMeta[Create Document Metadata\nMongoDB: rag_documents]
    
    MongoMeta --> VectorUpsert{Upsert Points to Qdrant\ncampusagent_rag collection}
    VectorUpsert -- Success --> Success([200 OK: Document Ready])
    VectorUpsert -- Exception / Failure --> Rollback[Atomic Rollback Compensation:\nDelete MongoDB Metadata Record]
    Rollback --> Err3[500 Server Error: Rolled back cleanly]
```

### Retrieval & Grounded Answering

1. **User Query Vectorization**: The query string is embedded into a 384-dimensional dense vector via `get_single_embedding()`.
2. **Filtered Vector Search**: A cosine similarity query is dispatched to Qdrant filtering by `user_id` and optional `document_id`, retrieving the top 5 highest-scoring chunks.
3. **Context Assembly**: The top chunks are formatted with source attribution metadata (`filename`, `chunk_number`, `score`).
4. **Grounded Synthesis**: The context is fed to the Groq LLM with system instructions:
   > *"Answer the student's question using only the provided PDF context. If the answer is not present in the context, say that the answer is not available in the uploaded PDF."*
5. **Payload Response**: The synthesized grounded response is delivered alongside the cited chunk sources.

---

## 4. Practice Test Parallel AI Grading Engine

When a student submits an assignment practice test, evaluating multiple long-form answers sequentially would introduce significant latency. CampusAgent AI employs a bounded asynchronous worker pool:

```python
sem = asyncio.Semaphore(4)  # Limit concurrent LLM evaluation requests

async def eval_single_question(q_idx: int, q_data: dict):
    async with sem:
        # Prompt LLM to evaluate student answer vs assignment context
        # Extract structured score (0-10), strengths, and missing points
        ...

# Execute all evaluations concurrently with bounded concurrency
results = await asyncio.gather(*[eval_single_question(i, q) for i, q in enumerate(questions)])
```

### Analytics Aggregation:
- Computes overall test score (`total_score / max_score * 100`).
- Aggregates accuracy percentages grouped by `topic_tag`.
- Automatically classifies topics below 60% accuracy as **Weak Topics** and feeds them into the analytics dashboard.

---

## 5. Attendance Intelligence & Compliance Recovery Engine

The attendance tracking service mathematically models student compliance against mandatory minimum attendance percentages (default: 75%):

$$\text{Current Percentage} = \text{round}\left(\frac{\text{Attended Classes}}{\text{Total Classes}} \times 100, 2\right)$$

### Risk Classification:
- **Safe**: $\text{Current} \ge \text{Required} + 10\%$
- **Warning**: $\text{Required} \le \text{Current} < \text{Required} + 10\%$
- **Danger**: $\text{Current} < \text{Required}$

### Dynamic Thresholds:
- **Classes Allowed to Miss** (if above threshold):
  $$\text{Classes Can Miss} = \left\lfloor \frac{\text{Attended Classes} \times 100}{\text{Required Percentage}} \right\rfloor - \text{Total Classes}$$
- **Classes Needed to Recover** (if below threshold):
  $$\text{Classes Needed} = \left\lceil \frac{(\text{Required Percentage} \times \text{Total Classes}) - (100 \times \text{Attended Classes})}{100 - \text{Required Percentage}} \right\rceil$$

---

## 6. Production Health & Readiness Verification

CampusAgent AI exposes two specialized lifecycle probes for container orchestrators (Render) and automated monitors:

| Endpoint | Probe Type | Verification Checks | HTTP Success | Degraded / Blocker Condition |
| -------- | ---------- | ------------------- | ------------ | ---------------------------- |
| `GET /health` | Liveness | MongoDB ping, Qdrant cluster ping | 200 OK (`"status": "healthy"`) | DB or Vector unreachable (`"status": "degraded"`) |
| `GET /ready` | Readiness | MongoDB connectivity + Qdrant connectivity + persistent cloud storage verification | 200 OK (`"ready": true`) | Storage is ephemeral container disk or connection down (`"ready": false`) |
