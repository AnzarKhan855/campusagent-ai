# CampusAgent AI 🎓🤖

CampusAgent AI is a full-stack agentic AI student productivity platform built to help students manage their academic workflow using AI.

It allows students to manage subjects, assignments, attendance, uploaded PDFs, extracted questions, AI-generated answers, AI answer evaluation, practice tests, weak topic analysis, and academic analytics from one unified dashboard.

---

## 🚀 Project Overview

CampusAgent AI is designed as an AI-powered academic assistant for students.

Students can upload assignment PDFs, extract questions, generate AI answers, write their own answers, evaluate them using AI, create practice tests, track performance, detect weak topics, and monitor academic progress through analytics dashboards.

This project demonstrates full-stack development, authentication, database design, REST API development, PDF processing, AI/LLM integration, analytics dashboards, and recruiter-ready product thinking.

---

## ✨ Features

### Authentication

* JWT-based signup and login
* Protected user dashboard
* User-specific academic data

### Dashboard

* Academic overview
* Subjects, assignments, attendance, and AI assistant access
* Student productivity-focused UI

### Subjects Management

* Create subjects
* View subjects
* Update subjects
* Delete subjects

### Assignments Management

* Create assignments
* Edit assignment details
* Delete assignments
* Track assignment status and priority

### Attendance Management

* Add attendance records
* Track subject-wise attendance
* Identify attendance risk

### AI Academic Assistant

* Rule-based academic planner
* Groq-powered AI academic assistant
* AI command box for academic productivity

### PDF Upload and Question Extraction

* Upload assignment PDFs
* Extract PDF text using `pdfminer.six`
* Extract questions from uploaded PDFs
* Store extracted questions in MongoDB

### AI Answer System

* Save student answer per question
* Generate AI answer for each question
* Evaluate student answer using AI
* Save score, feedback, strengths, missing points, and improved/model answer
* Mark questions as important
* Set difficulty: easy, medium, hard
* Auto-tag questions with topic, difficulty, and importance

### PDF Report Generation

* Generate downloadable answer PDF
* Export AI-generated answers and evaluated content using ReportLab

### Practice Test Mode

* Create practice test from extracted assignment questions
* Save test answers
* Submit practice test
* AI evaluates answers
* Final score and percentage report
* Weak topic detection

### Analytics Dashboard

* Score trend chart
* Test status pie chart
* Topic performance bar chart
* Weak topic frequency chart
* Pivot-style topic summary table
* Recent practice tests section

---

## 🧠 AI/LLM Usage

CampusAgent AI uses Groq API to power academic AI features such as:

* AI-generated answers
* AI answer evaluation
* Feedback generation
* Strength and weakness detection
* Improved/model answer generation
* Weak topic analysis
* Academic assistant responses

---

## 🛠 Tech Stack

### Frontend

* Next.js
* TypeScript
* Tailwind CSS
* Recharts

### Backend

* FastAPI
* Python
* JWT Authentication
* Groq API
* pdfminer.six
* ReportLab

### Database

* MongoDB Atlas
* Async Motor

### Tools

* Git
* GitHub
* Postman
* VS Code

### Deployment Planned

* Frontend: Vercel
* Backend: Render

---

## 🏗 Architecture

```text
CampusAgent AI
│
├── Frontend: Next.js + TypeScript + Tailwind CSS
│   ├── Dashboard UI
│   ├── Assignments UI
│   ├── Subjects UI
│   ├── Attendance UI
│   ├── Practice Test UI
│   └── Analytics Dashboard
│
├── Backend: FastAPI
│   ├── Auth APIs
│   ├── Dashboard APIs
│   ├── Subjects APIs
│   ├── Assignments APIs
│   ├── Attendance APIs
│   ├── PDF Upload APIs
│   ├── AI Evaluation APIs
│   ├── Practice Test APIs
│   └── Analytics APIs
│
├── Database: MongoDB Atlas
│   ├── Users
│   ├── Subjects
│   ├── Assignments
│   ├── Extracted Questions
│   ├── Practice Tests
│   └── Analytics Data
│
└── AI Layer
    ├── Groq LLM
    ├── Rule-Based Planner
    ├── AI Answer Generator
    ├── AI Answer Evaluator
    └── Weak Topic Analyzer
```

---

## 📁 Folder Structure

```text
campusagent-ai/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/
│   │   ├── models/
│   │   ├── database/
│   │   ├── services/
│   │   └── utils/
│   │
│   ├── requirements.txt
│   ├── .env
│   └── venv/
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/
│   │   │   ├── assignments/
│   │   │   ├── practice-tests/
│   │   │   └── login/
│   │   │
│   │   ├── components/
│   │   │   ├── AssignmentsPanel.tsx
│   │   │   ├── SubjectsPanel.tsx
│   │   │   ├── AttendancePanel.tsx
│   │   │   └── PracticeTestAnalytics.tsx
│   │   │
│   │   └── lib/
│   │
│   ├── package.json
│   ├── tailwind.config.ts
│   └── .env.local
│
├── .gitignore
├── README.md
└── package-lock.json
```

---

## 🔗 Important API Routes

### Dashboard

```http
GET /api/dashboard/overview
```

### Assignment PDF

```http
POST /api/assignments/{assignment_id}/upload-pdf
POST /api/assignments/{assignment_id}/extract-questions
GET /api/assignments/{assignment_id}/generate-pdf
```

### Question Answering

```http
PATCH /api/assignments/{assignment_id}/questions/save-answer
PATCH /api/assignments/{assignment_id}/questions/evaluate-answer
PATCH /api/assignments/{assignment_id}/questions/generate-ai-answer
PATCH /api/assignments/{assignment_id}/questions/auto-tag
```

### Practice Tests

```http
POST /api/assignments/{assignment_id}/practice-tests/create
GET /api/assignments/{assignment_id}/practice-tests
GET /api/practice-tests/{test_id}
PATCH /api/practice-tests/{test_id}/save-answer
POST /api/practice-tests/{test_id}/submit
GET /api/practice-tests/analytics/dashboard-summary
```

---

## ⚙️ Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/AnzarKhan855/campusagent-ai.git
cd campusagent-ai
```

---

## Backend Setup

### 2. Move to Backend Folder

```bash
cd backend
```

### 3. Create Virtual Environment

```bash
python -m venv venv
```

### 4. Activate Virtual Environment

For Windows:

```bash
.\venv\Scripts\activate
```

### 5. Install Backend Dependencies

```bash
pip install -r requirements.txt
```

### 6. Create `.env` File

Create a `.env` file inside the `backend` folder:

```env
MONGODB_URL=your_mongodb_atlas_connection_string
DATABASE_NAME=campusagent_ai
JWT_SECRET_KEY=your_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
GROQ_API_KEY=your_groq_api_key
```

### 7. Run Backend Server

```bash
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Backend will run on:

```text
http://127.0.0.1:8000
```

Swagger API Docs:

```text
http://127.0.0.1:8000/docs
```

---

## Frontend Setup

### 8. Move to Frontend Folder

```bash
cd frontend
```

### 9. Install Frontend Dependencies

```bash
npm install
```

### 10. Create `.env.local` File

Create a `.env.local` file inside the `frontend` folder:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

### 11. Run Frontend Server

```bash
npm run dev
```

Frontend will run on:

```text
http://localhost:3000
```

---

## 📸 Screenshots

### Login Page
![Login Page](./screenshots/login.png)

### Dashboard Overview
![Dashboard](./screenshots/dashboard.png)

### Subjects Management
![Subjects](./screenshots/subjects.png)

### Assignments Management
![Assignments](./screenshots/assignments.png)

### Attendance Management
![Attendance](./screenshots/attendance.png)

### Assignment Workspace
![Workspace](./screenshots/workspace.png)

### PDF Upload
![PDF Upload](./screenshots/pdf-upload.png)

### Extracted Questions
![Extracted Questions](./screenshots/extracted-questions.png)

### AI Generated Answer
![AI Answer](./screenshots/ai-answer.png)

### AI Evaluation Result
![AI Evaluation](./screenshots/ai-evaluation.png)

### Practice Test
![Practice Test](./screenshots/practice-test.png)

### Practice Test Result
![Practice Test Result](./screenshots/practice-result.png)

### Analytics Dashboard
![Analytics](./screenshots/analytics.png)

### Swagger API Documentation
![Swagger](./screenshots/swagger.png)

## Live Demo

Frontend:
https://campusagent-ai.vercel.app

Backend API:
https://campusagent-ai-backend.onrender.com

Swagger Documentation:
https://campusagent-ai-backend.onrender.com/docs

## 📊 Analytics Included

CampusAgent AI includes a dedicated practice test analytics dashboard with:

* Score trend chart
* Test status pie chart
* Topic performance bar chart
* Weak topic frequency chart
* Pivot-style topic summary table
* Recent practice tests section

---

## 🔐 Security Notes

* Environment variables are protected using `.env`
* `.env` files are ignored through `.gitignore`
* JWT authentication is used for protected routes
* MongoDB Atlas is used for cloud database storage
* Sensitive API keys are not pushed to GitHub

---

## 🚀 Deployment Plan

### Backend Deployment: Render

* Create a new Render Web Service
* Connect GitHub repository
* Set root directory as `backend`
* Add environment variables
* Use FastAPI start command
* Deploy backend API

### Frontend Deployment: Vercel

* Import GitHub repository into Vercel
* Set root directory as `frontend`
* Add frontend environment variables
* Connect frontend to deployed backend URL
* Deploy production frontend

---

## 🔮 Future Scope

Planned improvements:

* Full RAG-based PDF question-answering
* Notes summarization from uploaded PDFs
* Smart study planner with calendar integration
* Reminder notifications
* Subject-wise AI tutor
* Voice-based academic assistant
* Student performance prediction
* Admin/teacher dashboard
* Multi-user classroom mode
* Production deployment with CI/CD
* Better mobile-first UI polish

---

## 🧑‍💻 Author

**Anzar Khan**
B.Tech Artificial Intelligence & Machine Learning Student

GitHub: [AnzarKhan855](https://github.com/AnzarKhan855)

---

## ⭐ Why This Project Matters

CampusAgent AI is more than a CRUD project. It combines full-stack engineering with AI-powered academic automation.

It demonstrates:

* Full-stack development
* Authentication
* REST API design
* MongoDB database modeling
* PDF parsing
* LLM integration
* AI evaluation workflow
* Practice test generation
* Analytics dashboards
* Recruiter-focused product thinking

This makes CampusAgent AI a strong portfolio project for full-stack, AI/ML, and agentic AI internship roles.
