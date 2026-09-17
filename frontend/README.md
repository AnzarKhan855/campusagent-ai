# CampusAgent AI — Frontend Web Application

> Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS v4 client interface for the CampusAgent AI platform.

For the full product architecture, backend API documentation, and RAG pipeline deep dive, refer to the [Root Repository README](../README.md).

---

## Tech Stack & Libraries

- **Framework**: Next.js `16.2.9` (Turbopack, App Router)
- **Runtime & Language**: React `19.2.4`, TypeScript `^5`
- **Styling**: Tailwind CSS `^4` (`@tailwindcss/postcss`)
- **Data Visualization**: Recharts `^3.9.0` (Radar & Bar charts for attendance & weak topics)
- **Icons**: Lucide React `^1.21.0`
- **Error Handling**: Custom safe serializer (`src/lib/error.ts`) preventing 422 array crashes

---

## Directory Structure

```text
frontend/
├── src/
│   ├── app/                               # Next.js App Router pages
│   │   ├── page.tsx                       # Root redirect to dashboard
│   │   ├── layout.tsx                     # Root layout & font configuration
│   │   ├── login/page.tsx                 # Authentication: Login
│   │   ├── signup/page.tsx                # Authentication: Registration
│   │   ├── dashboard/page.tsx             # Academic KPI summary & quick actions
│   │   ├── subjects/page.tsx              # Subject catalog & teacher management
│   │   ├── assignments/
│   │   │   ├── page.tsx                   # Assignment tracker & PDF uploader
│   │   │   └── [id]/
│   │   │       ├── workspace/page.tsx     # Extracted question & solution workspace
│   │   │       ├── answer/page.tsx        # Student answer editor & AI assistance
│   │   │       └── practice/page.tsx      # Practice test builder
│   │   ├── attendance/page.tsx            # Attendance tracker & risk simulator
│   │   ├── ai-command/page.tsx            # Natural language command interface
│   │   ├── practice-tests/
│   │   │   └── [testId]/page.tsx          # Practice exam runner with live grading
│   │   ├── pdf-library/page.tsx           # Multi-document PDF library manager
│   │   ├── pdf-chat/[documentId]/page.tsx # Single-document grounded RAG chat
│   │   └── rag-chat/page.tsx              # Universal multi-document RAG workspace
│   ├── components/                        # Modular UI panels
│   │   ├── AssignmentsPanel.tsx           # Assignment CRUD, filter, & PDF extraction
│   │   ├── AttendancePanel.tsx            # Attendance cards with recovery metrics
│   │   ├── PracticeTestAnalytics.tsx      # Subject progress & weak topic charts
│   │   └── SubjectsPanel.tsx              # Course list with color tags
│   └── lib/
│       └── error.ts                       # Safe error parser for FastAPI 422 arrays
├── public/                                # Favicon & static web assets
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## Local Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```
For production testing, replace `http://127.0.0.1:8000` with your deployed backend URL.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
npm start
```
