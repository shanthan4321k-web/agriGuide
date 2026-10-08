# AgriGuide Backend API Reference

Base URL: `http://localhost:5000/api` (or `http://localhost:5001/api`)

---

## Endpoints

### 1. Health Check
- **Endpoint**: `GET /api/health`
- **Description**: Verify backend server status.
- **Response**:
```json
{
  "success": true,
  "message": "AgriGuide backend is running"
}
```

---

### 2. Weather
- **Endpoint**: `GET /api/weather/current`
- **Query Parameters**:
  - `latitude` (number, required): e.g. `17.9689`
  - `longitude` (number, required): e.g. `79.5941`
  - `district` (string, optional): e.g. `Warangal`
  - `state` (string, optional): e.g. `Telangana`
- **Response**:
```json
{
  "success": true,
  "data": {
    "location": "Warangal, Telangana",
    "temperature": 27,
    "feelsLike": 30,
    "rainfallProbability": 0,
    "humidity": 74,
    "windSpeedKmH": 8,
    "conditionText": "Clear & Sunny",
    "isRainExpectedToday": false,
    "advisoryText": "Low humidity and moderate breeze. Good conditions for nutrient absorption.",
    "sprayCondition": "safe",
    "sprayWindowText": "Safe to spray until 2:00 PM",
    "updatedAt": "2026-10-07T19:02:33.177Z",
    "source": "Open-Meteo (Live)",
    "isCached": false
  }
}
```

---

### 3. Mandi Market Prices
- **Endpoint**: `GET /api/market/current`
- **Query Parameters**:
  - `district` (string, optional): e.g. `Warangal`
  - `state` (string, optional): e.g. `Telangana`
  - `commodity` (string, optional): e.g. `Cotton`
- **Response (when unconfigured)**:
```json
{
  "success": false,
  "error": {
    "code": "MARKET_UNAVAILABLE",
    "message": "Market rates temporarily unavailable"
  }
}
```

---

### 4. AI Agricultural Advisor
- **Endpoint**: `POST /api/advisor`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <token>` (optional)
- **Body**:
```json
{
  "farmerProfile": {
    "name": "Ramesh Kumar",
    "acres": 4.5,
    "crops": ["Cotton", "Maize"],
    "district": "Warangal",
    "state": "Telangana"
  },
  "weatherData": {
    "temperature": 27,
    "rainfallProbability": 0,
    "humidity": 74,
    "windSpeedKmH": 8,
    "conditionText": "Clear & Sunny",
    "sprayCondition": "safe"
  },
  "cropObservations": [
    { "cropName": "Cotton", "status": "under_watch", "notes": "Routine scouting" }
  ],
  "language": "en"
}
```
- **Response**:
```json
{
  "success": true,
  "data": {
    "status": "success",
    "decision": {
      "actionTitle": "Inspect Cotton canopy and apply bio-pesticide if needed",
      "cropTarget": "Cotton (3 Acres)",
      "reason": "Plot is under watch. Current weather (27°C, 8 km/h wind) provides a safe window for foliar absorption.",
      "deadline": "Before 2:00 PM",
      "urgency": "high",
      "category": "pest",
      "weatherContext": "27°C · Safe Spray Window"
    },
    "source": "AgriGuide Rule-Based Agronomy Engine / Fireworks AI",
    "generatedAt": "2026-10-07T19:02:54.655Z"
  }
}
```

---

### 5. Voice Transcription
- **Endpoint**: `POST /api/voice/transcribe`
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `file`: Audio blob / file (`recording.webm`, `audio/webm` or `wav`)
  - `language`: `en` | `te` | `hi`
- **Response**:
```json
{
  "success": true,
  "data": {
    "status": "success",
    "text": "Transcribed voice query",
    "language": "te",
    "provider": "fireworks-whisper"
  }
}
```

---

### 6. Crop Leaf Diagnosis
- **Endpoint**: `POST /api/crop/diagnose`
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `image`: Leaf image file (`image/jpeg`, `image/png`)
  - `cropName`: e.g. `Cotton`
- **Response**:
```json
{
  "success": true,
  "data": {
    "status": "success",
    "diagnosis": {
      "title": "Observed Leaf Condition",
      "severity": "medium",
      "recommendation": "Scout field regularly.",
      "confidence": 0.88
    }
  }
}
```
