# Luminary — RIQE (Reliable Intelligence Query Engine)

Personalized learning roadmap engine for quantitative finance. RIQE ingests user profiles and free-text learning signals, maintains a knowledge state, and produces ordered topic roadmaps with recommendation scores, prerequisites, and quality metrics.

---

## Features

- **Onboarding**: Create a user from resume text, skill scores, interests, and field of study → initial knowledge state + personalized roadmap.
- **Signal processing**: Send raw text (e.g. “Studied Ito’s lemma today…”) → topic classification, strength, signal type (new_info / reinforcement / contradiction), trend, reliability → updated roadmap.
- **Roadmap engine**: Topics scored by cosine similarity to user vector, signal strength, and trend; ordered by prerequisite DAG; quality score and history.
- **Persistence**: In-memory by default; optional Supabase for states, roadmaps, signals, and metrics.

---

## Setup (use on another machine)

### 1. Clone and install

```bash
cd Luminary
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

### 2. (Optional) Supabase

To persist data across restarts, set:

- `SUPABASE_URL` — project URL  
- `SUPABASE_KEY` — anon/service key  

If unset, the API uses an **in-memory** store (fine for single-process use).

### 3. Train the signal classifier (recommended)

Produces `riqe/models/checkpoints/signal_classifier.pt` used for topic/type/strength:

```bash
python -m riqe.training.train_signal_classifier
```

### 4. Run the API

Single entry point for the app is **`riqe/app.py`** (pipeline + FastAPI in one place; paths stay in `riqe/config.py`).

```bash
python -m riqe.app
# or
uvicorn riqe.app:app --host 0.0.0.0 --port 8000
# or (same app via wrapper)
uvicorn riqe.api.api:app --reload --host 0.0.0.0 --port 8000
```

- Docs: **http://localhost:8000/docs**  
- Base URL: `http://localhost:8000`

---

## Host the API locally (callable by other machines)

To run the API on your machine so that **other computers on your local network** (e.g. another laptop, phone, or server) can call it:

### 1. Start the server bound to all interfaces

From the project root (e.g. `Luminary`):

```bash
uvicorn riqe.api.api:app --host 0.0.0.0 --port 8000
```

- `--host 0.0.0.0` makes the server listen on all network interfaces, not only `localhost`, so other hosts can connect.
- `--port 8000` is the port (change it if 8000 is in use).
- Omit `--reload` in production so the process is stable for remote callers.

### 2. Find your machine’s IP address

Other machines need to use your computer’s **local IP** instead of `localhost`.

- **Windows (PowerShell):** `ipconfig` → look for **IPv4 Address** under your active adapter (e.g. `192.168.1.105`).
- **macOS / Linux:** `ip addr` or `ifconfig` → look for `inet` on your LAN interface (e.g. `192.168.1.105`).

Example: if your IP is `192.168.1.105`, the base URL for other hosts is **`http://192.168.1.105:8000`**.

### 3. Call the API from another host

From another computer or app on the same network, use that base URL:

- **Interactive docs:** `http://192.168.1.105:8000/docs`
- **Onboard:** `POST http://192.168.1.105:8000/onboard`
- **Signal:** `POST http://192.168.1.105:8000/signal`
- **State:** `GET http://192.168.1.105:8000/state/{user_id}`

Example from another machine (replace with your IP):

```bash
curl -X POST http://192.168.1.105:8000/onboard \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user_1","resume_text":"MS math.","skill_scores":{"python":0.7},"interests":["quant"],"field_of_study":"mathematics","timeframe_weeks":12,"learning_history":[]}'
```

### 4. Firewall (if other hosts cannot connect)

- **Windows:** Allow inbound TCP port 8000 in Windows Defender Firewall (or your security software) for the Python/uvicorn process or for “Private” networks.
- **macOS:** System Settings → Network → Firewall → Options → allow your Python/uvicorn app or enable “Allow incoming connections” for it.

---

## API Reference

All request/response bodies are JSON. Content-Type: `application/json`.

---

### POST `/onboard`

Create a new user and get initial knowledge state and roadmap.

**Request body**

| Field             | Type     | Required | Description |
|-------------------|----------|----------|-------------|
| `user_id`         | string   | yes      | Unique user id |
| `resume_text`     | string   | yes      | Free-text resume / background |
| `skill_scores`   | object   | yes      | Map of skill name → score in [0, 1] |
| `interests`       | string[] | yes      | List of interest strings |
| `field_of_study`  | string   | yes      | e.g. `mathematics`, `economics` (see config) |
| `timeframe_weeks` | integer  | yes      | ≥ 1 |
| `learning_history`| array    | no       | List of learning events (see below) |

**Learning event** (each element of `learning_history`):

| Field               | Type    | Description |
|---------------------|---------|-------------|
| `topic_id`          | string  | Topic id from roadmap (e.g. `probability_theory`) |
| `timestamp`         | string  | ISO datetime |
| `completion_rate`   | float   | 0–1 |
| `quiz_score`        | float   | 0–1 |
| `time_spent_minutes`| int     | ≥ 0 |
| `revisit_count`     | int     | ≥ 0 (optional) |

**Response**

- `state`: knowledge state (see GET `/state/{user_id}`).
- `roadmap`: initial roadmap (see roadmap schema below).

**Example**

```bash
curl -X POST http://localhost:8000/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_1",
    "resume_text": "MS math, learning quant finance.",
    "skill_scores": {"probability": 0.7, "python": 0.6},
    "interests": ["derivatives", "risk"],
    "field_of_study": "mathematics",
    "timeframe_weeks": 12,
    "learning_history": []
  }'
```

---

### POST `/signal`

Send a text signal for a user; returns the **updated roadmap** after processing.

**Request body**

| Field    | Type   | Required | Description |
|----------|--------|----------|-------------|
| `user_id`| string | yes      | Must already exist (from `/onboard`) |
| `text`   | string | yes      | Raw learning signal (e.g. “Studied GBM today…”) |

**Response**

- Full roadmap object (same schema as in `/onboard` response), with updated `nodes`, `version`, and `quality_score`.

**Example**

```bash
curl -X POST http://localhost:8000/signal \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_1", "text": "Studied Ito'\''s lemma and GBM. Ready for Black-Scholes."}'
```

---

### POST `/switch-roadmap`

Move the user’s knowledge state to a new roadmap context (new `roadmap_id`). Returns new state + new roadmap.

**Request body**

| Field            | Type   | Required | Description |
|------------------|--------|----------|-------------|
| `user_id`        | string | yes      | Existing user |
| `new_roadmap_id` | string | yes      | New roadmap id (e.g. new UUID) |

**Response**

- Same as `/onboard`: `state` and `roadmap`.

---

### GET `/state/{user_id}`

Return the current knowledge state for a user.

**Response**

| Field             | Type    | Description |
|-------------------|---------|-------------|
| `user_id`         | string  | User id |
| `user_vector`     | float[] | 128-dim embedding |
| `completed_topics`| string[]| Topic ids marked completed |
| `weak_topics`     | string[]| Topic ids below threshold |
| `strong_signals`  | array   | List of RIQE signals (see below) |

**RIQE signal** (each in `strong_signals`):

- `text`, `timestamp`, `topic`, `strength` (0–1), `is_new_info`, `trend` (rising|stable|fading), `reliability_score`, `signal_type`.

**Example**

```bash
curl http://localhost:8000/state/user_1
```

---

### GET `/roadmap/{roadmap_id}/history`

Return all stored versions of a roadmap (e.g. after multiple `/signal` calls).

**Response**

- `roadmap_id`: string  
- `versions`: array of roadmap objects (each with `nodes`, `version`, `quality_score`, `created_at`, etc.)

**Example**

```bash
curl http://localhost:8000/roadmap/<ROADMAP_UUID>/history
```

---

### GET `/metrics/{user_id}`

Return logged metrics snapshots for the user (e.g. roadmap quality, coverage, consistency).

**Response**

- `user_id`: string  
- `metrics`: array of metric snapshots (dicts with keys like `roadmap_quality_score`, `topic_coverage`, etc.)

**Example**

```bash
curl http://localhost:8000/metrics/user_1
```

---

## Roadmap schema (in responses)

Each roadmap object (in `/onboard`, `/signal`, `/switch-roadmap`, and inside `/roadmap/{id}/history`):

| Field           | Type    | Description |
|----------------|---------|-------------|
| `roadmap_id`   | string  | Unique id |
| `user_id`      | string  | Owner |
| `nodes`        | array   | Ordered topic nodes |
| `created_at`   | string  | ISO datetime |
| `version`      | int     | Increments on each update |
| `quality_score`| float   | Aggregate quality (e.g. mean recommendation score) |

**Node** (each in `nodes`):

- `topic_id`, `title`, `description`, `difficulty`  
- `prerequisites`: list of topic ids  
- `recommendation_score`, `signal_score`, `confidence`

---

## Running tests and pipelines

- **Integration test** (unseen signals + full pipeline):  
  `python -m riqe.tests.test_integration`

- **API tests** (all endpoints, in-memory):  
  `python -m riqe.tests.test_api`  
  Or: `pytest riqe/tests/test_api.py -v`

- **E2E pipeline** (no API, no Supabase):  
  `python -m riqe.run_e2e`  
  Uses `riqe/data/training/sample_users.json` and `sample_signals.json`.

- **Train signal classifier**:  
  `python -m riqe.training.train_signal_classifier`  
  Uses `riqe/data/training/sample_signals.json` and topic templates; writes checkpoint to `riqe/models/checkpoints/signal_classifier.pt`.

---

## Project layout (relevant to API)

- **`riqe/app.py`** — **Single entry point**: pipeline creation + FastAPI app and all routes. Paths stay in `config.py`; nothing else changed.
- `riqe/api/api.py` — Thin wrapper: re-exports `app` and `create_pipeline` from `riqe.app`.
- `riqe/api/schemas.py` — Pydantic request/response models  
- `riqe/core/pipeline.py` — Orchestrator (onboard, process_text_input, switch_roadmap)  
- `riqe/core/signal_processor.py` — Text → topic, strength, type, trend  
- `riqe/core/roadmap_engine.py` — Scoring and roadmap generation  
- `riqe/core/knowledge_state.py` — User state and updates  
- `riqe/models/` — UserProfileMLP, RIQESignalClassifier, TrendGRU  
- `riqe/db.py` — In-memory or Supabase persistence  
- `riqe/config.py` — Dimensions, paths, env vars (single source for DATA_DIR, TOPICS_FILE, CHECKPOINTS_DIR, etc.)  
- `riqe/data/topics.json` — Topic list  
- `riqe/data/prerequisites.json` — DAG edges for ordering  

---

## Environment variables

| Variable         | Purpose |
|------------------|---------|
| `SUPABASE_URL`   | Supabase project URL (optional) |
| `SUPABASE_KEY`   | Supabase anon/service key (optional) |
| `MLFLOW_TRACKING_URI` | MLflow logging (default `mlruns`) |

If Supabase is not set, the API runs with in-memory storage only.

---

## Frontend (Next.js)

This repo may include a Next.js frontend. To run it:

```bash
npm run dev
# or: yarn dev | pnpm dev | bun dev
```

Open [http://localhost:3000](http://localhost:3000). Edit `app/page.tsx` for the main page. See [Next.js docs](https://nextjs.org/docs) and [Deploy on Vercel](https://vercel.com/new) for deployment.
