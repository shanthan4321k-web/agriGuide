# AgriGuide Architecture Specification

## Overview

AgriGuide is a farmer-focused agricultural decision-support application built for Indian farmers.

### Final Architecture Stack

- **Frontend**: React + Vite (TypeScript), responsive mobile-first UI with desktop/tablet layout adaptation.
- **Application Backend**: Self-managed Node.js + Express (JavaScript ESM) running on port `5000` (with graceful fallback to `5001` if macOS AirPlay Receiver occupies 5000).
- **Database & Storage**: Supabase PostgreSQL + Supabase Storage (`crop-images`) + Supabase Auth.
- **External Meteorological Feed**: Open-Meteo live API for real-time temperature, precipitation probability, wind speed, humidity, and agro-met spray advisory windows.
- **External Mandi Pricing Feed**: Agmarknet / e-NAM official government portal for APMC yard commodity rates.
- **Agricultural Reasoning Engine**: DecisionEngine consuming verified facts, augmented by Fireworks AI (`llama-v3p3-70b-instruct`) for multilingual translation and synthesis.
- **Voice Transcription**: Fireworks Whisper (`whisper-v3`) with client-side Web Speech API fallback.
- **Crop Vision Diagnosis**: Vision model integration with leaf image upload and Supabase storage/audit trail.

---

## Data Flow Diagram

```
Farmer Client (React + Vite)
         │
         │  HTTP / Multipart (REST)
         ▼
AgriGuide Express Backend (Node.js)
  ├── /api/health ──────────────────────► Backend Health Check
  ├── /api/weather/current ─────────────► Open-Meteo (Live) ──► weather_snapshots (Supabase DB)
  ├── /api/market/current ──────────────► Agmarknet / e-NAM ──► market_prices (Supabase DB)
  ├── /api/advisor ─────────────────────► DecisionEngine + Fireworks AI ──► recommendations (Supabase DB)
  ├── /api/voice/transcribe ────────────► Fireworks Whisper v3
  └── /api/crop/diagnose ───────────────► Vision Provider ──► crop-images (Storage) + crop_diagnoses (DB)
```

---

## Core Principles

1. **Zero Fabricated Factual Data**:
   - Real data is fetched live from meteorological and market gateways.
   - If an external provider key is not configured, the backend returns an honest `503 Service Unavailable` with a structured error code (e.g. `MARKET_UNAVAILABLE`).
   - The UI displays an honest, clean unavailable/unconfigured notice instead of inventing synthetic prices or weather.

2. **Security & Least Privilege**:
   - Backend secrets (`FIREWORKS_API_KEY`, `SUPABASE_SECRET_KEY`, `AGMARKNET_API_KEY`, `VISION_API_KEY`) reside strictly in `backend/.env`.
   - No backend secrets are exposed to the frontend bundle or client code.
   - User identity is verified via Supabase JWTs (`Authorization: Bearer <token>`); client-supplied `user_id` is never trusted directly.
