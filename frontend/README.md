# 🎓 CampusAgent AI

> **AI-Powered Student Productivity Platform built with Next.js,
> FastAPI, Groq LLM, Hugging Face Embeddings, Qdrant Vector Database and
> Retrieval-Augmented Generation (RAG).**

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.138-009688?logo=fastapi)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Python](https://img.shields.io/badge/Python-3-yellow?logo=python)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)
![Groq](https://img.shields.io/badge/Groq-LLM-orange)
![Qdrant](https://img.shields.io/badge/Qdrant-VectorDB-red)
![RAG](https://img.shields.io/badge/RAG-Enabled-success)

------------------------------------------------------------------------

# 🌐 Live Demo

**Frontend:** https://campusagent-ai.vercel.app

**Login:** https://campusagent-ai.vercel.app/login

**Backend API:** https://campusagent-ai-backend.onrender.com

**Swagger:** https://campusagent-ai-backend.onrender.com/docs

**GitHub:** https://github.com/AnzarKhan855/campusagent-ai

------------------------------------------------------------------------

# 📖 Overview

CampusAgent AI is a production-style full-stack academic platform that
combines modern web technologies with AI to help students manage their
complete study workflow.

It enables students to manage subjects, assignments, attendance, AI
workspaces, practice tests, analytics, PDF libraries, and
Retrieval-Augmented Generation (RAG) based document chat in one unified
application.

------------------------------------------------------------------------

# ✨ Features

## Authentication

-   JWT Login & Signup
-   Protected Routes
-   Secure Sessions

## Dashboard

-   Academic overview
-   Quick statistics
-   Navigation hub

## Subjects

-   Create / Update / Delete
-   Organize courses

## Assignments

-   CRUD operations
-   Priority & due dates
-   Assignment workspace
-   PDF upload

## Attendance

-   Subject-wise tracking
-   Attendance analytics
-   Risk monitoring

## AI Command Center

-   AI productivity assistant
-   Academic planning
-   Study guidance

## AI Workspace

-   AI answer generation
-   Rich answer editor
-   Regeneration

## Practice Tests

-   Generate tests
-   Save answers
-   AI evaluation
-   Performance analysis

## Analytics

-   Charts
-   Progress tracking
-   Weak topic visualization

## PDF Library

-   Upload PDFs
-   Rename
-   Delete
-   Manage documents

## AI PDF Chat (RAG)

-   Chat with a selected PDF
-   Semantic search
-   Context-aware responses
-   Source references

------------------------------------------------------------------------

# 🤖 AI Stack

-   Groq LLM
-   Hugging Face Embeddings API
-   Qdrant Vector Database
-   Retrieval-Augmented Generation (RAG)
-   Semantic Search

------------------------------------------------------------------------

# 🏗 RAG Pipeline

``` text
Upload PDF
      │
PDF Parsing
      │
Chunking
      │
Embedding Generation
(Hugging Face)
      │
Qdrant Vector Storage
      │
Semantic Search
      │
Groq LLM
      │
Grounded AI Response
```

------------------------------------------------------------------------

# 🛠 Tech Stack

  Category      Technologies
  ------------- ------------------------------------------
  Frontend      Next.js, React, TypeScript, Tailwind CSS
  Backend       FastAPI, Python
  Database      MongoDB Atlas
  AI            Groq
  Embeddings    Hugging Face API
  Vector DB     Qdrant
  Charts        Recharts
  PDF Parsing   pdfminer.six, PyMuPDF
  Deployment    Vercel, Render

------------------------------------------------------------------------

# 📸 Screenshots

## Login

![Login](screenshots/login.png)

## Dashboard

![Dashboard](screenshots/dashboard.png)

## Assignments

![Assignments](screenshots/assignment.png)

## Attendance

![Attendance](screenshots/attendance.png)

## AI Command

![AI Command](screenshots/ai-command.png)

## AI Workspace

![AI Workspace](screenshots/ai-workspace.png)

## Answer Workspace

![Answer Workspace](screenshots/answer-workspace.png)

## Practice Test

![Practice Test](screenshots/ai-practice-test.png)

## Analytics

![Analytics](screenshots/analytics.png)

## PDF Library

![PDF Library](screenshots/PDF-library.png)

## AI PDF RAG Chat

![RAG Chat](screenshots/ai-pdf-RAG.png)

------------------------------------------------------------------------

# 📁 Folder Structure

``` text
campusagent-ai/
├── backend/
├── frontend/
├── screenshots/
├── README.md
└── .gitignore
```

------------------------------------------------------------------------

# ⚙️ Local Setup

## Clone

``` bash
git clone https://github.com/AnzarKhan855/campusagent-ai.git
cd campusagent-ai
```

## Backend

``` bash
cd backend
python -m venv venv
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Create `.env`

``` env
MONGODB_URL=
DATABASE_NAME=
JWT_SECRET_KEY=
GROQ_API_KEY=
HF_TOKEN=
```

## Frontend

``` bash
cd frontend
npm install
npm run dev
```

Create `.env.local`

``` env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

------------------------------------------------------------------------

# 🚀 Deployment

-   Frontend: Vercel
-   Backend: Render
-   Database: MongoDB Atlas
-   Vector Database: Qdrant

------------------------------------------------------------------------

# 🔮 Roadmap

-   Streaming AI responses
-   PDF page citations
-   Chat history
-   Flashcards
-   AI study planner
-   Mobile application

------------------------------------------------------------------------

# 👨‍💻 Author

**Anzar Khan**

B.Tech Artificial Intelligence & Machine Learning

GitHub: https://github.com/AnzarKhan855

LinkedIn: (Add your LinkedIn profile URL)

------------------------------------------------------------------------

# ⭐ Why This Project

CampusAgent AI demonstrates:

-   Full-stack development
-   REST API design
-   Authentication
-   MongoDB data modeling
-   Retrieval-Augmented Generation (RAG)
-   Vector databases
-   LLM integration
-   AI-powered academic workflows
-   Production deployment

It is designed as a recruiter-ready portfolio project showcasing
practical AI and software engineering skills.
