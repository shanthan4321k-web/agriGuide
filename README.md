# AgriGuide (కృషి మార్గదర్శి / कृषि मार्गदर्शक)

A practical agricultural decision-support application built for Indian farmers answering the daily question: **"What should I do today?"**

---

## Architecture

- **Frontend**: React + Vite + TypeScript (Mobile-first farmer UX with responsive desktop & tablet views).
- **Backend**: Node.js + Express (JavaScript ESM) running on port `5000` (or `5001`).
- **Database & Storage**: Supabase PostgreSQL + Supabase Storage + Supabase Auth.
- **External Providers**: Open-Meteo (Live weather), Agmarknet / e-NAM (Mandi rates), Fireworks AI (Advisory reasoning), Fireworks Whisper (Multilingual voice).

---

## Directory Structure

```text
AgriGuide/
├── frontend/             # React + Vite TypeScript Frontend
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/              # Node.js + Express JavaScript Backend
│   ├── src/
│   │   ├── config/       # env.js, supabase.js
│   │   ├── controllers/  # weatherController, marketController, etc.
│   │   ├── routes/       # weatherRoutes, marketRoutes, etc.
│   │   ├── services/     # weatherService, marketService, fireworksService, etc.
│   │   ├── middleware/   # authMiddleware, errorMiddleware, validationMiddleware
│   │   ├── app.js
│   │   └── server.js
│   ├── package.json
│   ├── .env.example
│   └── .env
│
├── database/             # PostgreSQL Schema & Seeds
│   ├── schema.sql
│   ├── migrations/
│   └── seed/
│
├── archive/              # Archived legacy Supabase edge functions & manifests
├── docs/                 # Architecture and API documentation
└── README.md
```

---

## Quick Start

### 1. Start the Backend Server

```bash
cd backend
npm install
npm run dev
```

The backend starts on `http://localhost:5000` (or `http://localhost:5001`).
Health check: `GET http://localhost:5000/api/health`

### 2. Start the Frontend Dev Server

```bash
cd frontend   # or from project root
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`):
```env
PORT=5000
SUPABASE_URL=
SUPABASE_SECRET_KEY=
FIREWORKS_API_KEY=
FIREWORKS_MODEL=accounts/fireworks/models/llama-v3p3-70b-instruct
AGMARKNET_API_URL=https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070
AGMARKNET_API_KEY=
VISION_API_URL=
VISION_API_KEY=
```

### Frontend (`frontend/.env`):
```env
VITE_API_BASE_URL=http://localhost:5000/api
```
