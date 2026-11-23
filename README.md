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

To reset the database between test runs, stop the backend and run:

```bash
python -m seeds.reset            # keeps the table QR codes already printed
python -m seeds.reset --new-qr   # issues new QR tokens; reprint them afterwards
```

It rebuilds the schema from empty, so every test order, session, kitchen queue,
payment, analytics event and audit entry is cleared. Then it reseeds the menu,
tables, staff and order history, and mines the `standard`, `priority` and
`group` Apriori rules. It refuses to run while other connections to the
database are open, and checks the order-history CSV before dropping anything.

### What the seed contains

- **The restaurant's real menu**: 60 dishes in 8 categories, with the code,
  English and Chinese names and price from the shop's printed menu board, plus
  Filipino and Bisaya names and descriptions. The board skips codes F5 and H2;
  F4 Braised Beef Shank is seeded as sold out. Calories are left blank rather
  than estimated. Source: `backend/seeds/menu.py`.
- **Order history**: if `backend/seeds/transactions.csv` (or
  `backend/transactions.csv`) exists, it is loaded from that file, and every
  dish it names must match a seeded English name. Otherwise the seed generates
  48 orders over the 16 days before you seed, from a fixed random seed.
  Generated orders are not real diners; they exist so the Apriori job has
  baskets to mine.
- **Register codes**: each dish's `pos_code`, the code the cashier keys into
  the Columbia POS, starts as its menu-board code (`A1`, `B2`). Admins can
  change it in the menu editor. Customers never see it.
- **Apriori rules mined from that history** by the same job the admin
  dashboard runs (`python -m jobs.apriori`). None are typed in.
- **No analytics events.** The dashboard's recommendation funnel fills only
  from real sessions.
- **Senior and PWD declarations with the ID check already settled.** A
  verified check keeps the discount; a rejected one is charged full VAT.

Reseeding reproduces the same orders, amounts and rules. Only the dates, which
are relative to the day you seed, and the table QR tokens change.

### Senior and PWD discount

A declaration belongs to the phone that made it, so in a group only that
phone's items are discounted. The discount stays provisional until the crew
checks the ID in the cash confirmation dialog:

- **Valid ID**: keeps the discount. The last four digits, the cardholder and
  the issuing LGU can be recorded too; they are optional.
- **No valid ID**: re-prices that phone's items at full VAT. The dialog shows
  the new amount before the cashier confirms.

Discounted shares are paid at the cashier, and cash cannot be confirmed
while a check is still pending. Pregnant diners get queue priority without
a discount, so they skip the check.

**People without a phone.** A phone can add a senior or PWD diner who has no
phone ("Lola · Senior") from Help or the cart. The menu then shows "Ordering
for: Me · Lola", and her dishes:
- carry her discount;
- are grouped under her name;
- are paid at the cashier, where the crew sees "Lola (added by Phone 1)" on
  the ID check.

A phone can add up to four people, and only for itself.

## Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The design system is browsable at `/dev/atoms` — every shared atom in every
variant. Switch the menu size, high contrast and bigger buttons from the bar at the top of that page.

### Dwell threshold during a live walkthrough

The dwell signal fires after 45 seconds on one menu item, which is dead air in
front of an audience. Lower it for the walkthrough and say so out loud — the
mechanism is identical, only the constant differs:

```bash
VITE_DWELL_THRESHOLD_SEC=10 npm run dev
```

Unset, it is 45 seconds. Nothing else about confusion detection changes: two
distinct signals are still required, inside the same 120-second window.

### The adaptive menu

There is no separate senior screen. Each phone has its own display settings:
- **Menu size:** Grid, List (four dishes per screen) or Large (name and price
  first, big photo, full-width Add);
- **High contrast**;
- **Bigger buttons.**

Diners change them in three ways:
- by pinching the menu;
- from the **Aa** button in the header;
- by accepting an offer.

A senior or PWD declaration starts the phone on List with bigger buttons;
pregnant changes nothing on screen.

The menu offers help when it sees a diner struggling. Nothing changes until
the diner taps yes:

| What the menu sees | Offer |
|---|---|
| The page zoomed with two fingers | Make the menu bigger |
| Three taps that just miss a button | Make the buttons bigger |
| Confusion again after dismissing suggested dishes | Ask a crew member |

The **Help** tab in the bottom bar collects everything:
- the step-by-step guide;
- **ordering by menu code** on a keypad (A, 3, s gives Steamed Dumpling);
- text and buttons;
- **asking a crew member**, which shows on the kitchen queue and the POS with
  an "On my way" button;
- the priority declaration;
- adding someone without a phone.

The dish sheet reads a dish aloud when the phone has a voice for the
language. The admin dashboard's "Help offered by the menu" card counts every
offer, answer, crew call and size change.

Inter is self-hosted at `public/fonts/InterVariable.woff2` rather than loaded
from a CDN, because the system must work with no internet connection. This
build ships the `cv11` and `ss01` feature sets the type spec depends on;
subset builds commonly strip them.

## Alpha testing on the shop's Wi-Fi

### The counter: parallel POS

The counter's Columbia POS prints the BIR receipt and cannot be written to, so
the system runs on a cashier tablet beside it and replaces the paper slips:

- The **POS** page (`/staff/pos`) recalls a QR order by its queue number. The
  slip lists each dish's register code and quantity first (`A1 × 2`), split into
  Senior / PWD and Regular items, ready to key into Columbia POS.
- **Show barcodes** adds a Code 128 barcode for each code, for a USB scanner on
  Columbia POS. Reading a barcode off a screen needs an imager (CCD or 2D)
  scanner; most laser scanners cannot.
- **Settle** opens one dialog: check each Senior / PWD ID, choose Cash, GCash
  (the counter QR standee) or Card (the counter terminal), and confirm. One tap
  records the payment and the slip.
- Kitchen tickets show the same codes: `[A1] Wonton × 2`.

### Tables free themselves

A table goes back to vacant on its own when:

- every order on it is paid, and no phone at the table is still filling a cart;
- no order is placed within 30 minutes of the last phone joining;
- 45 minutes pass after its last order with nothing left to pay.

A phone that scans a table with an order in progress is never turned away. It
is asked whether it is joining that order or starting a new one; starting a new
one closes the old session, and its kitchen tickets and payments are kept.
Diners who have paid can still call a crew member for 45 minutes. Staff can
still set any table vacant, occupied or reserved by hand, and an admin's
reserved status survives the automatic release.

### HTTPS on the LAN

Phones only reach the Vite server, which proxies `/api` and `/ws` to the
backend on `127.0.0.1:8001`, so only Vite needs a certificate. Make one with
[mkcert](https://github.com/FiloSottile/mkcert) for the laptop's LAN address:

```bash
mkcert -install
cd frontend
mkdir certs
mkcert -cert-file certs/shaxian-lan.pem -key-file certs/shaxian-lan-key.pem localhost 127.0.0.1 <LAN-IP>
```

Vite serves HTTPS whenever those two files exist (`frontend/certs/` is
git-ignored). Then set these in `.env`:

```
FRONTEND_BASE_URL=https://localhost:5173
CORS_ORIGINS=https://localhost:5173,https://<LAN-IP>:5173
COOKIE_SECURE=true
```

Each test phone must trust the mkcert root certificate (`mkcert -CAROOT` shows
the folder; install its `rootCA.pem` on the phone), or the browser warns on
every visit. Reserve the laptop's IP on the router so it does not change
between runs, then export the table QR codes again; they follow
`FRONTEND_BASE_URL`, with `localhost` swapped for the LAN IP:

```bash
cd backend
python export_qr_codes.py
```

In offline LAN mode leave `PAYMONGO_SECRET_KEY` empty, and online payment falls
back to the cashier. With internet, PayMongo sandbox keys turn on GCash, Maya,
card and QR Ph.

## 3D dish showcase

On the customer screens each dish is shown in 3D: menu cards tilt in relief,
the item sheet spins a 3D model of the dish, and the cart is a serving tray.
High contrast, reduced motion, phones without WebGL2 and phones that run
slowly all keep the flat photos instead.

**Dish models** are built in code — no files to download or license. The
recipes live in `frontend/src/lib/dishes/recipes.js`, and `/dev/dishes` shows
each model turning beside its photo. A menu item's "3D model recipe" field in
the admin editor names its recipe (for example `wonton`). 25 of the 60 dishes
have one (D2 and D2+ share `fried-bihon`); the rest show their photo in relief. Tick "Served hot" for dishes
that should steam.

**Photos** live in `frontend/public/menu/`, one per dish, named after the
English name in snake_case (`braised_pork_with_rice_and_soup.webp`): transparent
WebP, 1024 px wide.

**Depth maps** drive the relief on the menu cards. After adding or replacing a
photo in `frontend/public/menu/`, regenerate them:

```bash
cd backend
pip install -r requirements-assets.txt   # torch + transformers, dev machines only
python -m jobs.depth_maps                # writes frontend/public/menu/depth/
```

## Order progress illustrations

The receipt and status pages show where the order is with one animated
illustration per stage: a receipt printer while it waits for payment, the
stamped ticket on the kitchen rail, a wok over the fire, the service bell, and
the served bowl. They are flat SVG with CSS animation, so they work on every
phone; reduced motion and accessibility mode show them still. `/dev/illustrations`
shows each one, with a button to replay its arrival.

**Order sounds** are off by default; diners turn them on from the speaker
button under the illustration. The phone vibrates when the order is ready
either way.

## Project layout

```
backend/     FastAPI application, Alembic migrations, seed scripts
frontend/    React application
tasks/       The seven specification documents. Documentation only, never imported
```
