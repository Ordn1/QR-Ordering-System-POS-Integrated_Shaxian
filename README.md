# Shaxian QR Table Ordering System

A QR-based table ordering system with dynamic accessibility modes and
Apriori-based recommendations. BS Information Technology capstone project,
deployed to a single quick-service restaurant in Davao City.

The full system is specified in `tasks/`. The current build stage is governed
by `tasks/Instructions.md`, which overrides the other documents on scope.

## Requirements

- PostgreSQL 15+ running locally (developed against 16.14)
- Python 3.12
- Node 20+

## Setup

The database and role are created once, outside the application:

```sql
CREATE DATABASE shaxian_ordering;
CREATE USER shaxian_app WITH PASSWORD '<password>';
GRANT ALL ON DATABASE shaxian_ordering TO shaxian_app;
```

Then copy the environment template and fill it in:

```bash
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"   # SECRET_KEY
```

## Backend

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt

alembic upgrade head        # build the schema
python -m seeds.run         # populate demo data, prints table QR URLs

uvicorn app.main:app --reload --port 8001
```

To rebuild the schema from empty:

```bash
alembic downgrade base && alembic upgrade head && python -m seeds.run
```

## Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The design system is browsable at `/dev/atoms` — every shared atom in every
variant. Toggle accessible mode from the bar at the top of that page.

### Dwell threshold during a live walkthrough

The dwell signal fires after 45 seconds on one menu item, which is dead air in
front of an audience. Lower it for the walkthrough and say so out loud — the
mechanism is identical, only the constant differs:

```bash
VITE_DWELL_THRESHOLD_SEC=10 npm run dev
```

Unset, it is 45 seconds. Nothing else about confusion detection changes: two
distinct signals are still required, inside the same 120-second window.

Inter is self-hosted at `public/fonts/InterVariable.woff2` rather than loaded
from a CDN, because the system must work with no internet connection. This
build ships the `cv11` and `ss01` feature sets the type spec depends on;
subset builds commonly strip them.

## Project layout

```
backend/     FastAPI application, Alembic migrations, seed scripts
frontend/    React application
tasks/       The seven specification documents. Documentation only, never imported
```
