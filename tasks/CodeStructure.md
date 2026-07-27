# CodeStructure.md

**System:** QR-Based Table Ordering System
**Backend:** Python 3.10+ · FastAPI · SQLAlchemy (async) · Alembic · asyncpg
**Frontend:** React 18 · Vite · Zustand · react-i18next · plain CSS
**Document role:** The authoritative definition of folder layout, module boundaries, naming, and code style

---

## 0. STOP — Read this before doing anything

**Do not scaffold folders, install packages, or generate files after reading this document.**

This file specifies the **complete finished structure**. It is written at full fidelity so it never needs rewriting.

**It is not a work order.** How much of this structure you may create right now is defined **exclusively** in `Instructions.md`. If that file authorizes a subset, build only that subset. `Instructions.md` always wins on scope.

Read `ProjectOverview.md` and `Database.md` first if you have not. Then Section 12 of this document.

---

## 1. Root layout

The repository root holds **two folders and nothing else but configuration.**

```
qr-table-ordering/
├── backend/
├── frontend/
├── tasks/                    ← the six .md specification files
├── .env
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

No source code at root. No stray scripts. If a file is not configuration, it belongs inside `backend/` or `frontend/`.

`tasks/` holds this document and its five siblings. It is documentation, never imported by code.

---

## 2. Code style — non-negotiable

### 2.1 Backend comments

Comments are permitted **only where a reader genuinely needs a marker**, and they are restricted to a **single word or a short label**:

```python
# Create
# Read
# Update
# Delete
# Validate
# Commit
```

That is the entire vocabulary of a backend comment. What is banned:

```python
# ❌ This function creates a new menu item in the database by first
# ❌ validating the input, then constructing the model, then committing.
# ❌ Note: we use async here for performance reasons!
# ❌ TODO: maybe refactor this later
```

If a block needs a paragraph to explain it, the block is wrong — rewrite the code, do not annotate it. Function and variable names carry the meaning; comments only mark position.

**Docstrings:** one line, on service-layer functions only, and only where the behavior is not obvious from the signature. Never on routers, models, or schemas.

### 2.2 Frontend comments

**None. Zero. Not one.**

No section dividers, no `// handle click`, no JSDoc, no `{/* Header */}`. If a component is unclear without a comment, split it or rename it.

### 2.3 No slop

- No defensive `try/except` around code that cannot fail
- No abstraction layers with a single implementation
- No configuration flags for behavior that never varies
- No helper that wraps one function call
- No premature generalization — write the concrete thing

Every function does one thing at one level of abstraction. If it needs a scroll bar, split it.

---

## 3. Backend structure

```
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── core/
│   │   ├── deps.py
│   │   ├── security.py
│   │   └── exceptions.py
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── routers/
│   └── websocket/
│       ├── manager.py
│       └── events.py
├── alembic/
│   ├── versions/
│   ├── env.py
│   └── script.py.mako
├── seeds/
│   ├── run.py
│   ├── menu.py
│   ├── tables.py
│   ├── staff.py
│   └── rules.py
├── tests/
├── .env.example
├── alembic.ini
├── Dockerfile
└── requirements.txt
```

### 3.1 Domains

The backend is organized around **ten domains**. Each layer holds one flat file per domain — no nested folders.

| Domain | Covers |
|---|---|
| `auth` | Staff login, tokens |
| `tables` | Physical tables, QR tokens |
| `menu` | Categories and menu items |
| `sessions` | Ordering sessions, joined devices |
| `orders` | Transactions and line items |
| `queue` | Kitchen queue, priority placement |
| `payments` | Online and cashier payment |
| `recommendations` | Apriori rule retrieval |
| `analytics` | Interaction events, dashboard aggregates |
| `verification` | Priority-status declarations |

A domain gets a file in a layer **only if it needs one**. `verification` has no router of its own if its endpoints live under `sessions` — do not create empty files for symmetry.

### 3.2 Layer responsibilities

Layers are strict. Violating them is the fastest way to make this codebase unmaintainable.

| Layer | May do | May **not** do |
|---|---|---|
| `routers/` | Parse requests, call one service, return a response | Touch models, query the database, hold business logic |
| `services/` | All business logic; the **only** layer that touches models | Know about HTTP, requests, or status codes |
| `schemas/` | Define Pydantic request/response shapes | Contain logic beyond validators |
| `models/` | Define SQLAlchemy ORM tables and relationships | Contain business logic |

A router that runs a query is a bug. A service that raises `HTTPException` is a bug.

```
Request → router → service → model → PostgreSQL
                     ↓
                  schema → Response
```

### 3.3 File map

```
models/          table.py  staff.py  menu.py  session.py  order.py
                 queue.py  payment.py  recommendation.py
                 analytics.py  verification.py

schemas/         auth.py  table.py  menu.py  session.py  order.py
                 queue.py  payment.py  recommendation.py  analytics.py

services/        auth.py  table.py  menu.py  session.py  order.py
                 queue.py  payment.py  recommendation.py  analytics.py
                 verification.py

routers/         auth.py  tables.py  menu.py  sessions.py  orders.py
                 queue.py  payments.py  recommendations.py
                 analytics.py  admin.py
```

Models group by domain, not by table — `models/menu.py` holds both `Category` and `MenuItem`; `models/session.py` holds `Session` and `SessionDevice`; `models/order.py` holds `Transaction` and `TransactionItem`.

### 3.4 Core

| File | Holds |
|---|---|
| `core/deps.py` | FastAPI dependencies — `get_db`, `get_current_staff`, `require_admin` |
| `core/security.py` | Password hashing, token issue and verify |
| `core/exceptions.py` | Custom exception classes and their handlers |

### 3.5 Root files

| File | Holds |
|---|---|
| `main.py` | App instance, router registration, middleware, WebSocket mount |
| `config.py` | Pydantic `Settings` read from environment — **the only place `os.environ` appears** |
| `database.py` | Async engine, session factory, `Base` |

No secret, connection string, or magic number appears anywhere but `config.py`.

### 3.6 API shape

```
/api/v1/<plural-noun>
```

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/menu/categories` | List categories |
| `GET` | `/api/v1/menu/items` | List items |
| `POST` | `/api/v1/sessions` | Open a session from a QR scan |
| `POST` | `/api/v1/orders` | Place an order |
| `GET` | `/api/v1/queue` | Kitchen queue (staff) |
| `POST` | `/api/v1/recommendations` | Retrieve rules for a cart |

Plural nouns, no verbs in paths, HTTP methods carry the action. Versioned from day one.

WebSocket: `/ws/orders/{session_id}` for customers, `/ws/kitchen` for staff.

### 3.7 Naming

| Thing | Convention | Example |
|---|---|---|
| Files, functions, variables | `snake_case` | `create_menu_item` |
| Model classes | `PascalCase`, singular | `MenuItem` |
| Schema classes | `PascalCase` + suffix | `MenuItemCreate`, `MenuItemRead` |
| Constants | `UPPER_SNAKE` | `VAT_RATE` |
| Router prefix variable | `router` | |

---

## 4. Frontend structure

**One React application.** Three interfaces separated by route group, sharing one component and style layer.

```
frontend/
├── public/
├── src/
│   ├── api/
│   ├── components/
│   │   ├── shared/
│   │   ├── customer/
│   │   ├── staff/
│   │   └── admin/
│   ├── hooks/
│   ├── lib/
│   ├── locales/
│   │   ├── en.json
│   │   ├── fil.json
│   │   └── bis.json
│   ├── pages/
│   │   ├── customer/
│   │   ├── staff/
│   │   └── admin/
│   ├── routes/
│   ├── store/
│   ├── styles/
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── Dockerfile
├── index.html
├── nginx.conf
├── package.json
└── vite.config.js
```

### 4.1 Route groups

| Group | Path | Device |
|---|---|---|
| Customer | `/t/:qrToken`, `/menu`, `/cart`, `/checkout`, `/status` | Phone |
| Staff | `/staff/*` | Tablet or desktop |
| Admin | `/admin/*` | Desktop |

Staff and admin routes are auth-guarded. Customer routes are open — a valid `qrToken` is what grants access.

### 4.2 `components/shared/` — the atom library

This folder is the heart of the frontend. **Every recurring UI element is defined here exactly once** and imported everywhere it is needed.

```
components/shared/
├── Button.jsx
├── IconButton.jsx
├── DataTable.jsx
├── Card.jsx
├── KpiCard.jsx
├── TextInput.jsx
├── SelectField.jsx
├── QtyStepper.jsx
├── Modal.jsx
├── Toast.jsx
├── Badge.jsx
├── Sidebar.jsx
└── Navbar.jsx
```

Rules:

- **One canonical component per element.** There is one `Button`. Not `AdminButton` and `CustomerButton`.
- **Variants are props, never new components.** `<Button variant="wide-delete">`, `<Button variant="icon-delete">`.
- **A domain folder may never redefine a shared element.** `components/admin/` holds admin-specific *compositions* of shared atoms — never its own button.

`components/customer/`, `/staff/`, `/admin/` hold assemblies: `MenuItemCard`, `CartSummary`, `QueueTicket`, `RecommendationOverlay`. Each is built from shared atoms.

### 4.3 `store/` — Zustand

One store per concern. Each is small — state plus the actions that mutate it, nothing more.

| Store | Holds |
|---|---|
| `sessionStore.js` | `sessionId`, `tableId`, `deviceToken`, `declaredStatus`, `sessionType` |
| `cartStore.js` | Line items, add / remove / setQty, computed totals |
| `uiStore.js` | `language`, `uiMode` |
| `orderStore.js` | Live order status pushed over WebSocket |

No middleware, no devtools wiring, no persistence layer unless a requirement demands it.

### 4.4 `api/` — one file per backend domain

```
api/  client.js  menu.js  sessions.js  orders.js
      queue.js  payments.js  recommendations.js  analytics.js  auth.js
```

`client.js` holds the base fetch wrapper, base URL, and error normalization. Every other file is thin functions that call it. **No component ever calls `fetch` directly.**

### 4.5 `hooks/`

Only genuinely reusable logic: `useWebSocket`, `useConfusionSignals`, `useLanguage`, `useAuth`. A hook used in exactly one component belongs inside that component.

`useConfusionSignals` is the client half of the capstone element — it tracks dwell time, back-navigation, cart abandonment, and scroll reversal, and fires when **any two** are active concurrently. See `ProjectOverview.md` §5.3.

### 4.6 Naming

| Thing | Convention | Example |
|---|---|---|
| Component files | `PascalCase.jsx`, one per file | `MenuItemCard.jsx` |
| Hooks | `useCamelCase.js` | `useWebSocket.js` |
| Stores | `camelCaseStore.js` | `cartStore.js` |
| API modules | `camelCase.js` | `recommendations.js` |
| CSS classes | `kebab-case` | `.wide-delete-btn` |

---

## 5. CSS architecture

Plain CSS, global semantic classes. No Tailwind, no CSS Modules, no styled-components.

**Three layers, imported in strict order.** Order is not cosmetic — later layers depend on the cascade position of earlier ones.

### 5.1 `index.css` — the manifest

`index.css` contains **imports and nothing else.** No rules ever live here.

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

@import './styles/base.css';

@import './styles/buttons.css';
@import './styles/tables.css';
@import './styles/cards.css';
@import './styles/forms.css';
@import './styles/overlays.css';
@import './styles/layout.css';

@import './styles/accessibility.css';

@import './styles/screens/menu.css';
@import './styles/screens/cart.css';
@import './styles/screens/checkout.css';
@import './styles/screens/status.css';
@import './styles/screens/kitchen.css';
@import './styles/screens/admin.css';
```

### 5.2 Layer 1 — `base.css`

Reset, typography, and **all design tokens** as CSS custom properties on `:root`. Every color, size, and spacing value in the system originates here.

```css
:root {
  --font-sm:     14px;
  --font-base:   16px;
  --font-lg:     20px;
  --font-xl:     26px;

  --space-unit:  8px;
  --radius:      8px;
  --tap-target:  44px;

  --color-bg:      #ffffff;
  --color-surface: #f6f7f9;
  --color-text:    #1a1a1a;
  --color-muted:   #6b7280;
  --color-primary: #2e5c8a;
  --color-danger:  #b42318;
  --color-border:  #d9dde3;
}
```

**No hardcoded color or size appears in any other stylesheet.** Every rule references a token.

### 5.3 Layer 2 — atoms, by component family

This is the shared library. One canonical definition per element, variants distinguished **by name**.

**`buttons.css`**
```
.primary-btn        .secondary-btn      .ghost-btn
.wide-create-btn    .icon-create-btn
.wide-edit-btn      .icon-edit-btn
.wide-delete-btn    .icon-delete-btn    .remove-btn
.add-to-cart-btn    .checkout-btn
.sidebar-btn        .navbar-btn         .lang-btn
```

**`tables.css`** — `.data-table` · `.compact-table` · `.queue-table` · `.table-row-active`
**`cards.css`** — `.card` · `.kpi-card` · `.menu-item-card` · `.order-card` · `.summary-card`
**`forms.css`** — `.text-input` · `.select-field` · `.search-field` · `.qty-stepper` · `.field-label` · `.field-error`
**`overlays.css`** — `.modal` · `.modal-backdrop` · `.toast` · `.rec-overlay` · `.confirm-dialog`
**`layout.css`** — `.app-shell` · `.sidebar` · `.navbar` · `.page-header` · `.content-area`

**The rule that keeps this clean:** a delete button in the admin console and a delete button in the cart are the **same CSS class**. If one needs a different shape, it becomes a **new named variant here** — never a redefinition somewhere else.

### 5.4 Layer 3 — screens

One file per screen, holding **layout and positioning only**.

A screen file may set grid and flex arrangement, page-specific spacing, and responsive breakpoints. A screen file **may never** restyle an atom. This is forbidden:

```css
/* ❌ never */
.menu-page .wide-delete-btn { background: red; border-radius: 0; }
```

**Every class in a screen file is prefixed with its screen name.** This is what makes a global namespace safe without tooling:

```css
.menu-grid  .menu-category-tabs  .menu-item-row
.cart-list  .cart-totals  .cart-empty-state
.checkout-summary  .checkout-payment-options
```

Atoms get bare names. Screen classes get prefixes. A collision is then structurally impossible.

### 5.5 `accessibility.css` — the adaptive interface

Accessibility mode is implemented by **overriding tokens on a root attribute**, not by duplicating classes.

Setting `data-ui-mode="accessible"` on `<html>` rescales every shared atom at once, because every atom is already built from tokens:

```css
[data-ui-mode="accessible"] {
  --font-sm:     18px;
  --font-base:   22px;
  --font-lg:     30px;
  --font-xl:     38px;

  --space-unit:  12px;
  --tap-target:  60px;

  --color-text:    #000000;
  --color-muted:   #333333;
  --color-border:  #000000;
}
```

Only genuinely **structural** changes need explicit rules — collapsing to a single column, capping items per screen:

```css
[data-ui-mode="accessible"] .menu-grid { grid-template-columns: 1fr; }
[data-ui-mode="accessible"] .navbar-btn { min-height: var(--tap-target); }
```

This is the entire accessibility layer, and it should stay under roughly fifty lines. **Never create a parallel `.accessible-*` class for an existing atom** — that doubles the component library and guarantees the two copies drift apart.

`uiStore` sets the attribute. Nothing else touches it.

### 5.6 Adding a new element

1. Does a shared atom already cover it? → use it
2. Is it a variation of an existing atom? → add a **named variant** in the relevant family file
3. Is it genuinely new? → add it to the right family file, or create a new family file and register it in `index.css`
4. Is it pure layout for one screen? → the screen file, prefixed

**Never** add a component style to a screen file.

---

## 6. Internationalization

`react-i18next`, three locale files: `en.json`, `fil.json`, `bis.json`.

Keys are **semantic paths**, never English strings:

```json
{ "menu": { "addToCart": "Add to Cart", "categories": { "chicken": "Chicken" } } }
```

**No user-visible string is ever hardcoded in a component.** All three files must carry identical key sets — a missing key is a bug, not a fallback.

Menu item and category names come from the **database** (`name_en` / `name_fil` / `name_bis`), not from locale files. Locale files cover interface chrome only.

---

## 7. Docker

```yaml
services:
  db:        # postgres:15-alpine, named volume
  backend:   # ./backend, depends_on db
  frontend:  # ./frontend, nginx serving the Vite build
```

One `docker-compose.yml` at root. Backend and frontend each own their `Dockerfile`. `nginx.conf` proxies `/api` and `/ws` to the backend so the browser sees a single origin.

---

## 8. Environment

`.env.example` is committed and complete. `.env` is git-ignored and never committed.

```
DATABASE_URL=
SECRET_KEY=
PAYMONGO_SECRET_KEY=
CORS_ORIGINS=
```

Read only through `config.py`.

---

## 9. Testing

```
backend/tests/     test_<domain>.py, pytest + httpx
frontend/src/test/ *.test.jsx, Vitest
```

Structure exists from the start; coverage scope is set by `Instructions.md`.

---

## 10. What must never happen

- ❌ A router that queries the database directly
- ❌ A service that raises `HTTPException`
- ❌ A component that calls `fetch` directly
- ❌ A screen CSS file that restyles a shared atom
- ❌ A second definition of an element that already exists in `components/shared/`
- ❌ A hardcoded color, size, or user-visible string anywhere
- ❌ A `.accessible-*` duplicate of an existing atom
- ❌ Multi-line explanatory comments in the backend
- ❌ **Any** comment in the frontend
- ❌ Source code at the repository root

---

## 11. What lives elsewhere

| Topic | File |
|---|---|
| What the system is and why | `ProjectOverview.md` |
| Tables, columns, constraints, seeds | `Database.md` |
| Screens, visual design, component appearance | `UIDesign.md` |
| Auth flows, hardening, secrets handling | `Security.md` |
| **What to build right now** | **`Instructions.md`** |

---

## 12. Questions and clarifications — REQUIRED BEFORE YOU BUILD

**Do not begin scaffolding assuming this structure is complete.**

Structural mistakes are expensive: a misplaced layer boundary or a duplicated component propagates through every file added afterward. **Ask first.**

### 12.1 Known open items — raise these, do not guess

1. **Auth mechanism.** JWT versus server-side sessions for staff and admin login is specified in `Security.md`, not here. If that file is deferred, ask before implementing either.
2. **WebSocket authentication.** How the staff kitchen socket authenticates is unspecified.
3. **Icon library.** No icon set has been chosen. `IconButton` needs one.
4. **Font.** `Inter` is a placeholder in the manifest above. Confirm before committing to it.
5. **Payment SDK integration point.** Whether PayMongo's SDK is called from the frontend, the backend, or both is undecided.

### 12.2 Raise anything else that is

- Ambiguous, or open to more than one reasonable reading
- Contradictory between this file and `ProjectOverview.md`, `Database.md`, or the paper
- Structurally required but absent — a layer, module, or file you would otherwise have to invent
- In tension with the layering rules in §3.2 or the CSS rules in §5

**Do not silently invent structure.** If you must proceed past an ambiguity, state the assumption prominently.

---

## 13. Confirmation required before proceeding

**Before creating a single folder or file, reply to the author confirming the following. Then stop and wait for approval.**

1. **Do you understand the root layout** — that only `backend/`, `frontend/`, `tasks/`, and configuration files live at root, and no source code does?

2. **Do you understand the comment policy** — backend comments are **single-word labels only** (`# Create`, `# Read`), and the frontend contains **no comments whatsoever**?

3. **Do you understand the backend layering** — routers never touch models, services never know about HTTP, and each layer holds one flat file per domain with no nested folders?

4. **Do you understand the shared component rule** — one canonical `Button`, `DataTable`, `Card`, and so on in `components/shared/`, with variants passed as props, and that a domain folder may **never** redefine a shared element?

5. **Do you understand the three CSS layers** — `base.css` tokens, then atoms grouped by component family, then screen files that hold **layout only** and may never restyle an atom?

6. **Do you understand the naming rule that makes global CSS safe** — atoms get bare semantic names (`.wide-delete-btn`), screen classes get a screen prefix (`.menu-grid`), and `index.css` contains imports and nothing else?

7. **Do you understand accessibility mode** — that `data-ui-mode="accessible"` overrides **tokens** on the root element, so every atom rescales automatically, and that parallel `.accessible-*` classes are forbidden?

8. **Do you understand the "no slop" standard** — no single-implementation abstractions, no defensive handling of impossible errors, no wrapper helpers, no premature generalization?

9. **Do you have any questions from §12.1**, or anything else unclear?

Please answer these explicitly, list any questions, and **wait for a human reply before creating any files or folders.**
