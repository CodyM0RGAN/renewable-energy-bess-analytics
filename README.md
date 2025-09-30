# Renewable Energy BESS Performance Analytics Web App

## Overview
A full-stack template for monitoring Battery Energy Storage System (BESS) fleets. The backend seeds a MongoDB instance with realistic operational telemetry while the React dashboard visualises capacity, availability, and state-of-charge trends.

## Stack
- **Backend**: Node.js + Express + Mongoose
- **Database**: MongoDB (seeded with sample assets)
- **Frontend**: React with Chart.js visualisations
- **Container Orchestration**: Docker Compose

## Running Locally
1. Ensure Docker Desktop is running.
2. From this workspace root, launch the stack:
   ```bash
   docker compose up --build
   ```
3. Visit <http://localhost:3000> for the dashboard.
4. The API is exposed at <http://localhost:8089>. Health check: `GET /health`.

The backend seeds the `bess_analytics` database the first time it connects. Edit `backend/data/sample-bess-assets.json` to customise the starting fleet.

## Project Structure
- `backend/` – Express API, Mongo models, seed data
- `frontend/` – React dashboard
- `data/` – Notes on sourcing public BESS datasets for enrichment
- `docker-compose.yml` – Three-service stack (MongoDB, API, UI)

## Key Endpoints
- `GET /health` – Service heartbeat
- `GET /api/bess/dashboard` – Assets + fleet-level metrics
- `POST /api/bess/assets` – Register a new asset
- `POST /api/bess/assets/:assetId/metrics` – Append telemetry samples

## Next Steps
- Replace the seed file with real ingestion pipelines
- Extend the backend with alerting thresholds per site
- Wire the dashboard to live telemetry or historical batch uploads
