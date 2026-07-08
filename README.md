# Itinerate

Plan the best order for your travel activities. Type in the activities you want to do
in a city, how many days you have, and your preferred start/end times. Itinerate uses
AI to resolve each activity's location in the city and build a geographically sensible
day-by-day timeline.

You can also **add activities from a screenshot** — upload a photo and Gemini infers the
place, then Google Maps resolves it to a real location.

- **Backend:** Java 17 + Spring Boot (REST API, stateless)
- **Frontend:** React + TypeScript + Vite + Tailwind
- **AI:** Cursor Composer via a local OpenAI-compatible proxy
- **Vision:** Google Gemini (Google AI Studio) for screenshot inference
- **Maps:** Google Maps MCP for place resolution

## How ordering works

Itinerary planning is powered by **Cursor Composer** through a small local proxy
(`llm-proxy/`). The Java backend sends an OpenAI-style chat request; the proxy forwards
it to Cursor's SDK using your `CURSOR_API_KEY`. The model:

1. **Resolves location** — infers the neighborhood, district, or landmark for each activity
2. **Orders geographically** — groups nearby activities on the same day
3. **Schedules** — assigns time slots inside your preferred daily window

## API keys

Three separate keys are needed for full functionality. Copy the example env files and
fill in your keys:

```bash
cp llm-proxy/.env.example llm-proxy/.env
cp backend/.env.example backend/.env
```

| Key | Where | Required for | How to get |
|-----|-------|--------------|------------|
| `CURSOR_API_KEY` | `llm-proxy/.env` | Trip planning, Maps MCP agent | [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations) |
| `GOOGLE_MAPS_API_KEY` | `llm-proxy/.env` | Resolving inferred locations to real places | [Google Cloud Console](https://console.cloud.google.com/) — enable Places + Geocoding APIs |
| `ITINERARY_VISION_API_KEY` | `backend/.env` | Screenshot → activity inference | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `ITINERARY_LLM_API_KEY` | `backend/.env` | Trip planning (any non-empty value when using local proxy) | Set to `local` |

**Never commit `.env` files** — they are listed in `.gitignore`.

If you pasted a key into chat or committed it anywhere, rotate it in the provider's
dashboard and update your `.env` file.

## Setup

### 1. Install dependencies

```bash
cd llm-proxy && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Configure env files

Edit `llm-proxy/.env`:

```
CURSOR_API_KEY=crsr_your_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

Edit `backend/.env`:

```
ITINERARY_LLM_API_KEY=local
ITINERARY_LLM_BASE_URL=http://localhost:8081/v1
ITINERARY_LLM_MODEL=composer-2.5
ITINERARY_VISION_API_KEY=your_google_ai_studio_key_here
ITINERARY_VISION_MODEL=gemini-2.5-flash
```

## Running

You need **three terminals** (or use `scripts/dev.sh` for proxy + backend together):

**Terminal 1 — Cursor LLM proxy (port 8081)**

```bash
cd llm-proxy
npm run start
```

**Terminal 2 — Backend (port 8080)**

```bash
cd backend
set -a && source .env && set +a   # macOS/Linux — loads API keys into the process
mvn spring-boot:run
```

If `java` is not on your PATH:

```bash
export JAVA_HOME="$(/usr/libexec/java_home)"   # macOS
```

**Terminal 3 — Frontend (port 5173)**

```bash
cd frontend
npm run dev
```

Or start proxy + backend together:

```bash
./scripts/dev.sh
```

## Restarting after changes

The backend and llm-proxy do **not** hot-reload. You must restart them when you change
code or `.env` files:

| What changed | Restart |
|--------------|---------|
| `backend/src/**`, `backend/.env`, `application.properties` | Backend (port 8080) |
| `llm-proxy/server.js`, `llm-proxy/.env` | llm-proxy (port 8081) |
| `frontend/src/**` | Nothing — Vite hot-reloads automatically |

After editing `backend/.env` (e.g. adding `ITINERARY_VISION_API_KEY`), stop the backend
and start it again with `source .env` so the new values are loaded.

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `CURSOR_API_KEY` | `llm-proxy/.env` | Cursor API key for itinerary planning and Maps MCP |
| `GOOGLE_MAPS_API_KEY` | `llm-proxy/.env` | Google Maps Platform key for place resolution |
| `ITINERARY_LLM_API_KEY` | `backend/.env` | Any non-empty value (proxy auth placeholder) |
| `ITINERARY_LLM_BASE_URL` | `backend/.env` | `http://localhost:8081/v1` |
| `ITINERARY_LLM_MODEL` | `backend/.env` | `composer-2.5` |
| `ITINERARY_VISION_API_KEY` | `backend/.env` | Google AI Studio key for screenshot inference |
| `ITINERARY_VISION_MODEL` | `backend/.env` | `gemini-2.5-flash` (change if quota errors) |
| `ITINERARY_VISION_MAPS_RESOLVE_URL` | `backend/.env` | `http://localhost:8081/v1/maps/resolve` |

## Error responses

| Status | Meaning |
|--------|---------|
| **400** | Invalid request |
| **422** | Vision could not identify a location — try a clearer image |
| **429** | Gemini vision quota exceeded — wait or change `ITINERARY_VISION_MODEL` |
| **502** | Proxy, Cursor, or vision service call failed |
| **503** | Missing API key (`ITINERARY_LLM_API_KEY` or `ITINERARY_VISION_API_KEY`) |
