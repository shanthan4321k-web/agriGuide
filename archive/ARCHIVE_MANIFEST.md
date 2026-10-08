# Supabase Edge Functions Migration Archive Manifest

All previous Supabase Deno Edge Functions have been migrated to the self-managed Node.js + Express backend (`backend/src/`).

## Migration Mapping

1. **`supabase/functions/weather` → `backend/src/services/weather/weatherService.js`**
   - **Migrated logic**: Open-Meteo live API fetching with exact latitude/longitude, hourly rain probability calculation, spray condition calculation (`safe`, `caution`, `unsafe`), advisory text generation, and optional PostgreSQL `weather_snapshots` persistence.
   - **Controller / Route**: `weatherController.js` / `GET /api/weather/current`.

2. **`supabase/functions/market` → `backend/src/services/market/marketService.js`**
   - **Migrated logic**: Agmarknet / e-NAM public API integration, `getMarketRecommendation` decision logic (`SELL`, `HOLD`, `WAIT` based on verified price spread and trend percentage), and PostgreSQL `market_prices` table persistence.
   - **Controller / Route**: `marketController.js` / `GET /api/market/current`.

3. **`supabase/functions/agri-advisor` → `backend/src/services/ai/fireworksService.js` & `backend/src/services/decision/decisionEngine.js`**
   - **Migrated logic**: Structured prompt generation using verified farm inputs (weather, crop observations, market rate), multilingual translation (Telugu, Hindi, English), JSON schema validation, and PostgreSQL `recommendations` persistence.
   - **Controller / Route**: `advisorController.js` / `POST /api/advisor`.

4. **`supabase/functions/voice-transcription` → `backend/src/services/voice/whisperService.js`**
   - **Migrated logic**: Fireworks Whisper v3 audio transcription API streaming with multilingual language support.
   - **Controller / Route**: `voiceController.js` / `POST /api/voice/transcribe`.

5. **`supabase/functions/crop-diagnosis` → `backend/src/services/crop/cropDiagnosisService.js`**
   - **Migrated logic**: Multipart form handling, vision diagnosis model connection, Supabase Storage (`crop-images`) upload, and `crop_diagnoses` table persistence.
   - **Controller / Route**: `cropController.js` / `POST /api/crop/diagnose`.
