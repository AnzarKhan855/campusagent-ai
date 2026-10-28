import io
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from app.main import app
from app.rag.vector_store import ping_vector_store


def create_sample_academic_pdf(text_content: str) -> bytes:
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    p.setFont("Helvetica", 12)
    y = 750
    for line in text_content.strip().split("\n"):
        p.drawString(50, y, line.strip())
        y -= 20
    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer.getvalue()


@pytest.mark.asyncio
async def test_rag_upload_query_and_delete_lifecycle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Signup a fresh user
        email = f"rag_tester_{uuid.uuid4().hex[:8]}@example.com"
        res_signup = await client.post("/api/auth/signup", json={
            "name": "RAG Research Student",
            "email": email,
            "password": "Password123!",
            "role": "student"
        })
        assert res_signup.status_code == 200
        token = res_signup.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Verify vector store health
        health = ping_vector_store()
        assert "mode" in health

        # 3. Create a synthetic academic PDF with specific testable facts
        syllabus_text = """Distributed Operating Systems Course Syllabus
Unit 1: Lamport Logical Clocks and Vector Clocks
Lamport timestamps provide a partial order of events using monotonic counters.
Vector clocks provide a causal order of events by maintaining a vector of counters for every node in the distributed cluster.
Unit 2: Distributed Mutual Exclusion
Ricart-Agrawala algorithm requires 2*(N-1) messages per critical section entry.
Maekawa voting algorithm requires O(sqrt(N)) messages per critical section entry."""
        
        pdf_bytes = create_sample_academic_pdf(syllabus_text)
        assert len(pdf_bytes) > 200

        # 4. Upload PDF to /api/rag/upload
        files = {
            "file": ("distributed_systems_syllabus.pdf", pdf_bytes, "application/pdf")
        }
        res_upload = await client.post("/api/rag/upload", files=files, headers=headers)
        assert res_upload.status_code == 200
        upload_data = res_upload.json()
        assert upload_data["success"] is True
        doc_id = upload_data["document"]["id"]
        assert upload_data["chunks_created"] >= 1

        # 5. List user RAG documents
        res_docs = await client.get("/api/rag/documents", headers=headers)
        assert res_docs.status_code == 200
        docs_list = res_docs.json()["documents"]
        assert any(d["id"] == doc_id for d in docs_list)

        # 6. Query RAG engine: "How many messages does Ricart-Agrawala algorithm require?"
        res_ask = await client.post("/api/rag/ask", json={
            "question": "How many messages does Ricart-Agrawala algorithm require?",
            "document_id": doc_id
        }, headers=headers)
        assert res_ask.status_code == 200
        ask_data = res_ask.json()
        assert ask_data["success"] is True
        # Check source points to this document and matches syllabus
        assert any(s["document_id"] == doc_id for s in ask_data["sources"])
        # Check LLM generated grounded answer referencing 2*(N-1) messages
        assert "2*(N-1)" in ask_data["answer"] or "Ricart-Agrawala" in ask_data["answer"]

        # 7. Delete RAG document
        res_del = await client.delete(f"/api/rag/documents/{doc_id}", headers=headers)
        assert res_del.status_code == 200

        # 8. Confirm document is removed from list
        res_docs2 = await client.get("/api/rag/documents", headers=headers)
        assert res_docs2.status_code == 200
        assert not any(d["id"] == doc_id for d in res_docs2.json()["documents"])
