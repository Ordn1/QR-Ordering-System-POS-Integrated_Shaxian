# Shaxian QR Table Ordering System — Master Technical Reference

> **Authoritative System Reference for AI Agents & Developers**  
> This document provides an exhaustive, definitive, and self-contained specification of the entire Shaxian QR Table Ordering System codebase, architecture, database schema, mathematical algorithms, security model, UI design system, APIs, and operational workflows.  
> **Target Audience:** Any AI model or software engineer tasked with understanding, maintaining, debugging, or extending this project without having to scan and ingest every individual file across the repository.

---

## 1. Executive Summary & Capstone Context

- **Project Title:** A QR-Based Table Ordering System Integrating Dynamic Accessibility Modes and Apriori-Based Recommendations
- **Academic Context:** Bachelor of Science in Information Technology (BSIT) Capstone Project, Davao City, Philippines.
- **Deployment Target:** Deployed to a single partner quick-service restaurant (QSR): *Shaxian Snacks (沙县小吃)* in Sasa, Davao City (`SXN-SASA-01`).
- **Core Architecture:** Local-first, client-server web application. Diners sit at physical tables, scan unique table-mounted QR codes using their personal smartphones, and complete menu browsing, accessibility customization, ordering, and payment from their browser without downloading a native mobile app or creating an account.
- **Key Hardware & Network Paradigm:** Operates completely on the restaurant's private local area network (LAN/Wi-Fi) hosted on a single on-premise workstation. Diners require **zero cellular data or external internet connectivity** for the core browsing, ordering, and kitchen dispatch flows. Internet access is only required if routing through an external online payment aggregator (e.g., PayMongo sandbox); if the internet uplink drops, the system gracefully degrades to counter cashier settlement.

---

## 2. Core Problem Statements & Research Claims

Every architectural decision and feature in this repository maps directly to documented field research and legal requirements in Davao City:

1. **Queue Friction & Abandonment:**
   - *Survey Finding:* **94.3%** of 36 surveyed QSR patrons in Davao City reported abandoning a counter queue or walking away without dining due to excessive line lengths.
   - *System Solution:* Tabletop QR scanning immediately binds a browser session to the physical table, distributing ordering directly to diners' seats and eliminating the counter queue choke-point.
2. **Choice Paralysis & Decision Fatigue:**
   - *Survey Finding:* **86.1%** of respondents reported confusion or lengthy decision times when selecting meals (especially complex combo dishes)—persisting even among tech-literate digital ordering users.
   - *System Solution:* Rather than bombarding users with aggressive upsell banners, a **confusion-detection engine** passively observes client-side hesitation behavior (dwell time, navigation reversal, cart cycling) and triggers **Apriori-derived association recommendations** *only* when decision paralysis is statistically detected.
3. **Exclusion of Statutory Priority Sectors (RA 9994 & RA 10754):**
   - *Legal & Field Problem:* Philippine law mandates a **20% statutory discount and 12% Value-Added Tax (VAT) exemption** for Senior Citizens (RA 9994) and Persons with Disability (PWD, RA 10754), alongside priority queue accommodations. Mainstream delivery apps and digital ordering kiosks have routinely failed these groups—either stripping the statutory discount entirely or forcing confusing multi-screen hurdles, small unreadable text, and counter embarrassment.
   - *System Solution:* Voluntary self-declaration reconfigures the customer interface into an **Accessibility-Adaptive UI** (enlarged type, high contrast, 60px tap targets, single-column flow, trilingual English/Filipino/Bisaya localization), calculates exact statutory tax-exempt discounts server-side before checkout, and routes tickets into a **fairness-bounded priority queue**.
4. **Absolute Privacy & Anti-Biometrics Guarantee:**
   - *Strict Compliance:* Under the Data Privacy Act of 2012 (RA 10173), the system utilizes **zero cameras, zero facial recognition, zero biometric tracking, and zero automatic age inference**. All demographic states are strictly self-declared by user interaction.

---

## 3. System Actors & Roles

The system serves exactly four access tiers with distinct privileges:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM ROLES                              │
├──────────────────────────┬─────────────────────────────────────────────┤
│ 1. Standard Customer     │ Table QR scan, browses menu, manages cart,  │
│    (Anonymous Diner)     │ pays online/cashier, live order tracking.   │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 2. Priority Customer     │ Self-declares Senior / PWD / Pregnant status│
│    (Senior/PWD/Pregnant) │ Receives Adaptive UI, priority kitchen slot,│
│                          │ and statutory 20% + VAT exemption discount. │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 3. Service Crew          │ Authenticated floor & counter staff. Views  │
│    (`service_crew`)      │ kitchen queue, advances prep states, verifies│
│                          │ presented IDs, confirms cash settlements.   │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 4. System Administrator  │ Authenticated manager (`admin`). Menu CRUD, │
│    (`admin`)             │ category CRUD, sales analytics, POS bridge, │
│                          │ on-demand Apriori training, audit reviews.  │
└──────────────────────────┴─────────────────────────────────────────────┘
```

---

## 4. Technology Stack & Operational Dependencies

| Layer | Technology | Version / Specification | Rationale & Configuration |
|---|---|---|---|
| **Backend Framework** | Python / FastAPI | Python 3.12, FastAPI 0.111+ | Asynchronous REST endpoints, high concurrency, native WebSocket support. |
| **Database & Driver** | PostgreSQL / asyncpg | PostgreSQL 15+ (tested on 16.14) | Server-based relational DBMS. Exact numeric precision, native ENUMs, JSONB, GIN indexing. |
| **ORM & Migrations** | SQLAlchemy / Alembic | SQLAlchemy 2.0 (async), Alembic 1.13+ | Pure migration-driven schema versioning. No raw `create_all()`. |
| **Data Mining** | mlxtend / pandas | mlxtend 0.23+, pandas 2.2+ | Offline Apriori association rule generation segmented by ordering context. |
| **Frontend Framework** | React / Vite | React 18.3, Vite 5.3 | Client-side SPA, zero page reloads, responsive viewport adaptation. |
| **State Management** | Zustand | Zustand 4.5+ | Lightweight decoupled stores (`cartStore`, `sessionStore`, `authStore`, `toastStore`, `uiStore`). |
| **Internationalization**| react-i18next | i18next 23+, react-i18next 14+ | Full trilingual runtime translation: English (`en`), Filipino (`fil`), Bisaya (`bis`). |
| **Icons & Charts** | Lucide React / Recharts | Lucide 0.395+, Recharts 2.12+ | Restrained icon set, custom-themed monochromatic and semantic SVG charts. |
| **Styling & Design** | Vanilla CSS | Custom Design System (`src/styles/`) | Pure CSS custom properties (tokens), 3-layer architecture, zero CSS-in-JS overhead, no Tailwind. |
| **Typography** | Inter Variable | Self-hosted (`public/fonts/`) | Offline font hosting with `cv11` and `ss01` OpenType features for a refined macOS-grade look. |
| **Security & Auth** | bcrypt / PyJWT | bcrypt 4.1+, PyJWT 2.8+ | 12-round bcrypt hashing, stateless JWT in `httpOnly`, `SameSite=Strict` session cookies. |

---

## 5. Architectural Principles & Code Conventions

### 5.1 Backend Layering & Separation of Concerns

The backend (`backend/app/`) enforces strict unidirectional dependency layering:
```
Routers (HTTP/WS endpoints)
   └── Services (Domain business logic & algorithms)
         └── Models & Database (SQLAlchemy models, asyncpg sessions)
```
- **Routers (`app/routers/`):** Accept HTTP requests, enforce Pydantic payload validation, extract auth context (`CurrentStaff`, `AdminStaff`, `CurrentDevice`), delegate computation to services, and return Pydantic schemas. Routers **never** execute business logic, calculate prices, or construct generic `HTTPException` instances.
- **Services (`app/services/`):** Encapsulate all business rules, database queries, transactions, and algorithm implementations. When a rule is violated, services raise custom domain exceptions defined in `app/core/exceptions.py`.
- **Exception Handlers (`app/core/exceptions.py` & `main.py`):** Central exception middleware maps domain exceptions (`ValidationError` $\to$ 422, `NotFoundError` $\to$ 404, `ConflictError` $\to$ 409, `PermissionError` $\to$ 403, `AuthenticationError` $\to$ 401, `BusinessRuleError` $\to$ 400). Unhandled exceptions return HTTP 500 with a unique 8-character hex **Correlation ID** (e.g., `8F3A-2C91`) while logging the stack trace server-side.

### 5.2 Code Style & Commenting Discipline
- **Backend Comments:** Comments are restricted exclusively to single-word or short functional section markers (`# Create`, `# Read`, `# Update`, `# Delete`, `# Validate`, `# Commit`). Paragraph-style defensive comments or docstrings on self-explanatory code are strictly banned.
- **Frontend Comments:** **Zero comments policy.** No inline comments, no commented-out code, and no JSDoc banners in `.jsx` or `.js` component files. Code readability is maintained strictly through descriptive identifiers and modular component decomposition.
- **Precision Typing & Currency:** Floating-point data types (`float`, `REAL`, `DOUBLE`) are **strictly prohibited** for money. All financial values in Python use `decimal.Decimal` and PostgreSQL `NUMERIC(p, s)` with `ROUND_HALF_UP` per-line rounding.

---

## 6. Comprehensive Database Architecture (14 Tables)

The database schema (`shaxian_ordering`) consists of **14 tables** and **11 native PostgreSQL ENUM types**. Every table belongs to one of two structural primary key classes:

### 6.1 The Two Primary Key Conventions

1. **Reference Tables (Catalog & Management Entities):**
   - Entities configured and maintained by restaurant staff. Human-facing, spoken aloud, and printed on signs.
   - **Key Format:** Fixed 8-character string `PREFIX-NNNN` (e.g., `TBL-0001`, `STF-0001`, `CAT-0001`, `MNU-0001`, `APR-0001`).
   - Generated automatically by dedicated PostgreSQL sequences (`seq_tables`, `seq_staff`, `seq_categories`, `seq_menu_items`, `seq_apriori_rules`) via a SQL `DEFAULT ('PREFIX-' || LPAD(nextval('seq_...')::TEXT, 4, '0'))`.
   - Enforced by regex check constraints: `CHECK (table_id ~ '^TBL-[0-9]{4}$')`.
2. **Transactional Tables (High-Volume Accumulating Activity):**
   - System-generated audit logs, sessions, orders, items, and events that accumulate indefinitely.
   - **Key Format:** Unformatted SQL-standard `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`.

---

### 6.2 PostgreSQL Native ENUM Definitions

```sql
CREATE TYPE occupancy_status_enum AS ENUM ('vacant', 'occupied', 'reserved');
CREATE TYPE staff_role_enum       AS ENUM ('service_crew', 'admin');
CREATE TYPE priority_status_enum  AS ENUM ('standard', 'senior', 'pwd', 'pregnant');
CREATE TYPE session_type_enum     AS ENUM ('standard', 'priority', 'group');
CREATE TYPE ui_mode_enum          AS ENUM ('standard', 'accessible');
CREATE TYPE language_enum         AS ENUM ('en', 'fil', 'bis');
CREATE TYPE txn_status_enum       AS ENUM ('pending', 'preparing', 'ready', 'completed', 'abandoned', 'voided');
CREATE TYPE payment_method_enum   AS ENUM ('online', 'cashier');
CREATE TYPE payment_status_enum   AS ENUM ('pending', 'paid', 'failed');
CREATE TYPE print_status_enum     AS ENUM ('success', 'failed');
CREATE TYPE event_type_enum       AS ENUM (
    'dwell_timeout',
    'back_navigation',
    'cart_abandon',
    'scroll_reversal',
    'recommendation_shown',
    'recommendation_accepted',
    'recommendation_dismissed'
);
```

> **Crucial Conceptual Distinction:**
> - `priority_status_enum` (`standard`, `senior`, `pwd`, `pregnant`): Represents what the user self-declared at the table.
> - `session_type_enum` (`standard`, `priority`, `group`): Represents the mining segment used by Apriori. All senior, PWD, and pregnant declarations collapse into the `priority` segment. When two or more devices join a single table session, `group` overrides all individual declarations.

---

### 6.3 Detailed Schema & Table Definitions

#### 1. `tables` (Reference Table)
Physical dining tables and their cryptographically random QR markers.
- `table_id` (`VARCHAR(8)`, PK, Default: `seq_tables`, Check: `^TBL-[0-9]{4}$`)
- `table_number` (`SMALLINT`, NOT NULL, UNIQUE, Check: `> 0`): Physical table number displayed in dining room.
- `qr_token` (`UUID`, NOT NULL, UNIQUE, Default: `gen_random_uuid()`): High-entropy token encoded into table QR sticker.
- `occupancy_status` (`occupancy_status_enum`, NOT NULL, Default: `'vacant'`)
- `is_active` (`BOOLEAN`, NOT NULL, Default: `TRUE`)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `now()`)

#### 2. `staff_accounts` (Reference Table)
Authentication and access control for restaurant staff.
- `staff_id` (`VARCHAR(8)`, PK, Default: `seq_staff`, Check: `^STF-[0-9]{4}$`)
- `username` (`VARCHAR(30)`, NOT NULL, UNIQUE case-insensitive index on `LOWER(username)`)
- `password_hash` (`CHAR(60)`, NOT NULL): Exact 60-character bcrypt hash.
- `full_name` (`VARCHAR(80)`, NOT NULL)
- `role` (`staff_role_enum`, NOT NULL): `'service_crew'` or `'admin'`.
- `is_active` (`BOOLEAN`, NOT NULL, Default: `TRUE`)
- `last_login_at` (`TIMESTAMPTZ`, NULL)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `now()`)

#### 3. `categories` (Reference Table)
Menu category classification tabs in display order across three languages.
- `cat_id` (`VARCHAR(8)`, PK, Default: `seq_categories`, Check: `^CAT-[0-9]{4}$`)
- `name_en` (`VARCHAR(40)`, NOT NULL): English tab title.
- `name_fil` (`VARCHAR(40)`, NOT NULL): Filipino tab title.
- `name_bis` (`VARCHAR(40)`, NOT NULL): Bisaya tab title.
- `display_order` (`SMALLINT`, NOT NULL, Default: `0`): UI rendering sequence.
- `is_active` (`BOOLEAN`, NOT NULL, Default: `TRUE`)

#### 4. `menu_items` (Reference Table)
Full menu product catalog with multi-lingual descriptions, pricing, and dietary disclosures.
- `item_id` (`VARCHAR(8)`, PK, Default: `seq_menu_items`, Check: `^MNU-[0-9]{4}$`)
- `cat_id` (`VARCHAR(8)`, NOT NULL, FK $\to$ `categories.cat_id` ON DELETE RESTRICT)
- `name_en` (`VARCHAR(60)`, NOT NULL), `name_fil` (`VARCHAR(60)`, NOT NULL), `name_bis` (`VARCHAR(60)`, NOT NULL)
- `description_en` (`VARCHAR(160)`, NULL), `description_fil` (`VARCHAR(160)`, NULL), `description_bis` (`VARCHAR(160)`, NULL)
- `price` (`NUMERIC(8,2)`, NOT NULL, Check: `price >= 0`): Base Philippine Peso price.
- `calories` (`SMALLINT`, NULL, Check: `calories >= 0`)
- `allergens` (`VARCHAR(120)`, NULL): Comma-separated allergen list (e.g., `"Soy, Peanuts"`).
- `dietary_flags` (`VARCHAR(60)`, NULL): Comma-separated flags (e.g., `"Halal, Vegetarian"`).
- `image_filename` (`VARCHAR(80)`, NULL): Relative image file name (e.g., `"wonton-soup.webp"`).
- `is_available` (`BOOLEAN`, NOT NULL, Default: `TRUE`): Live counter 86 / stock toggle.
- `is_featured` (`BOOLEAN`, NOT NULL, Default: `FALSE`)
- `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `now()`)

#### 5. `sessions` (Transactional Table)
The anchor entity tracking a table's dining lifecycle from initial scan to settlement.
- `session_id` (`BIGINT`, PK, Identity)
- `table_id` (`VARCHAR(8)`, NOT NULL, FK $\to$ `tables.table_id`)
- `started_at` (`TIMESTAMPTZ`, NOT NULL, Default: `now()`)
- `ended_at` (`TIMESTAMPTZ`, NULL): Populated when session completes or expires (3-hour timeout).
- `declared_priority_status` (`priority_status_enum`, NOT NULL, Default: `'standard'`)
- `session_type` (`session_type_enum`, NOT NULL, Default: `'standard'`): Segment tag stored permanently for Apriori mining.
- `group_mode` (`BOOLEAN`, NOT NULL, Default: `FALSE`): Automatically becomes `TRUE` when a 2nd phone joins.
- `ui_mode_used` (`ui_mode_enum`, NOT NULL, Default: `'standard'`)
- `language_used` (`language_enum`, NOT NULL, Default: `'en'`)
- `accessibility_accepted` (`BOOLEAN`, NOT NULL, Default: `FALSE`)
- *Index:* Partial index `idx_sessions_table_active` on `(table_id) WHERE ended_at IS NULL`.

#### 6. `session_devices` (Transactional Table)
Every physical device participating in a table session.
- `device_id` (`BIGINT`, PK, Identity): Internal relational key.
- `session_id` (`BIGINT`, NOT NULL, FK $\to$ `sessions.session_id` ON DELETE CASCADE)
- `device_token` (`UUID`, NOT NULL, UNIQUE, Default: `gen_random_uuid()`): Secret handle stored in client `localStorage`.
- `joined_at` (`TIMESTAMPTZ`, NOT NULL, Default: `now()`)
- `display_name` (`VARCHAR(30)`, NULL): Optional diner handle.
- `is_host` (`BOOLEAN`, NOT NULL, Default: `FALSE`): Set to `TRUE` on the phone that opened the session.

#### 7. `transactions` (Transactional Table)
Financial transaction record representing a finalized order ticket.
- `txn_id` (`BIGINT`, PK, Identity)
- `session_id` (`BIGINT`, NOT NULL, FK $\to$ `sessions.session_id`)
- `placed_at` (`TIMESTAMPTZ`, NOT NULL, Default: `now()`)
- `gross_amount` (`NUMERIC(10,2)`, NOT NULL, Check: `>= 0`)
- `vatable_sales` (`NUMERIC(10,2)`, NOT NULL, Default: `0`): Base sales subject to 12% VAT.
- `vat_exempt_sales` (`NUMERIC(10,2)`, NOT NULL, Default: `0`): Statutory exempt base under RA 9994/10754.
- `vat_amount` (`NUMERIC(10,2)`, NOT NULL, Default: `0`): 12% VAT collected.
- `discount_amount` (`NUMERIC(10,2)`, NOT NULL, Default: `0`): Total statutory discount.
- `net_amount` (`NUMERIC(10,2)`, NOT NULL, Check: `>= 0`): Final amount payable.
- `item_count` (`SMALLINT`, NOT NULL, Check: `> 0`)
- `is_priority` (`BOOLEAN`, NOT NULL, Default: `FALSE`)
- `queue_date` (`DATE`, NOT NULL, Default: `CURRENT_DATE`)
- `queue_number` (`SMALLINT`, NOT NULL, Check: `> 0`): Daily rolling ticket counter (`Q-001`).
- `status` (`txn_status_enum`, NOT NULL, Default: `'pending'`)
- `voided_by` (`VARCHAR(8)`, NULL, FK $\to$ `staff_accounts.staff_id`)
- `void_reason` (`VARCHAR(120)`, NULL)
- `voided_at` (`TIMESTAMPTZ`, NULL)
- *Constraint:* `CONSTRAINT uq_txn_queue_daily UNIQUE (queue_date, queue_number)`

#### 8. `transaction_items` (Transactional Table)
Individual dish line items. Serves as the primary market basket dataset for Apriori mining.
- `txi_id` (`BIGINT`, PK, Identity)
- `txn_id` (`BIGINT`, NOT NULL, FK $\to$ `transactions.txn_id` ON DELETE CASCADE)
- `item_id` (`VARCHAR(8)`, NOT NULL, FK $\to$ `menu_items.item_id` ON DELETE RESTRICT)
- `device_id` (`BIGINT`, NULL, FK $\to$ `session_devices.device_id`): Device attribution for split billing.
- `quantity` (`SMALLINT`, NOT NULL, Check: `> 0`)
- `unit_price` (`NUMERIC(8,2)`, NOT NULL, Check: `>= 0`): **Price snapshot** at moment of checkout. Never re-joined against catalog.
- `subtotal` (`NUMERIC(10,2)`, NOT NULL, Check: `>= 0`): `quantity * unit_price`.
- `is_discounted` (`BOOLEAN`, NOT NULL, Default: `FALSE`)
- `discount_amount` (`NUMERIC(8,2)`, NOT NULL, Default: `0`)

#### 9. `kitchen_queue` (Transactional Table)
Operational kitchen pipeline enforcing the fairness-bounded priority queue algorithm.
- `queue_id` (`BIGINT`, PK, Identity)
- `txn_id` (`BIGINT`, NOT NULL, UNIQUE, FK $\to$ `transactions.txn_id`): Enforces 1:1 slot mapping.
- `queue_position` (`SMALLINT`, NOT NULL, Check: `> 0`): Live integer position in active queue.
- `priority_skips_used` (`SMALLINT`, NOT NULL, Default: `0`, Check: `>= 0`): **Starvation defense counter** measuring how many times this specific order has been passed by newer priority orders.
- `updated_by` (`VARCHAR(8)`, NULL, FK $\to$ `staff_accounts.staff_id`)
- `entered_queue_at` (`TIMESTAMPTZ`, NOT NULL, Default: `now()`)
- `prep_started_at` (`TIMESTAMPTZ`, NULL): Timestamp when kitchen begins cooking (locks order position).
- `completed_at` (`TIMESTAMPTZ`, NULL): Timestamp when order is completed/fulfilled.

#### 10. `payments` (Transactional Table)
Settlement records supporting single or split payments per transaction.
- `payment_id` (`BIGINT`, PK, Identity)
- `txn_id` (`BIGINT`, NOT NULL, FK $\to$ `transactions.txn_id` ON DELETE CASCADE)
- `device_id` (`BIGINT`, NULL, FK $\to$ `session_devices.device_id`)
- `method` (`payment_method_enum`, NOT NULL): `'online'` or `'cashier'`.
- `amount` (`NUMERIC(10,2)`, NOT NULL, Check: `> 0`)
- `discount_applied` (`NUMERIC(10,2)`, NOT NULL, Default: `0`)
- `aggregator_ref` (`VARCHAR(50)`, NULL): PayMongo payment intent ID or reference.
- `status` (`payment_status_enum`, NOT NULL, Default: `'pending'`)
- `print_status` (`print_status_enum`, NULL): Counter paper receipt status.
- `paid_at` (`TIMESTAMPTZ`, NULL): Settlement timestamp.

#### 11. `apriori_rules` (Reference Table)
Association rules pre-mined nightly or on-demand, partitioned by demographic segment.
- `rule_id` (`VARCHAR(8)`, PK, Default: `seq_apriori_rules`, Check: `^APR-[0-9]{4}$`)
- `session_type` (`session_type_enum`, NOT NULL): Context segment (`'standard'`, `'priority'`, `'group'`).
- `antecedents` (`JSONB`, NOT NULL): Array of item IDs representing cart premise (e.g., `["MNU-0001"]`).
- `consequents` (`JSONB`, NOT NULL): Array of suggested item IDs (single item e.g., `["MNU-0004"]`).
- `support` (`NUMERIC(6,4)`, NOT NULL, Check: `0 <= support <= 1`)
- `confidence` (`NUMERIC(6,4)`, NOT NULL, Check: `0 <= confidence <= 1`)
- `lift` (`NUMERIC(6,4)`, NOT NULL, Check: `lift > 0`)
- `generated_at` (`TIMESTAMPTZ`, NOT NULL, Default: `now()`)
- *Indexes:* `idx_apriori_segment_lift` on `(session_type, lift DESC)` and GIN index `idx_apriori_antecedents` on `(antecedents)`.

#### 12. `analytics_events` (Transactional Table)
High-frequency client-side telemetry tracking hesitation signals and recommendation interactions.
- `event_id` (`BIGINT`, PK, Identity)
- `session_id` (`BIGINT`, NOT NULL, FK $\to$ `sessions.session_id` ON DELETE CASCADE)
- `event_type` (`event_type_enum`, NOT NULL)
- `screen_id` (`VARCHAR(40)`, NULL)
- `occurred_at` (`TIMESTAMPTZ`, NOT NULL, Default: `now()`)
- `metadata` (`JSONB`, NULL): Key-value payload (e.g., `{"item_id": "MNU-0002", "dwell_seconds": 45}`).

#### 13. `priority_verification_log` (Transactional Table)
Statutory compliance audit log for BIR and DSWD senior/PWD discount audits.
- `log_id` (`BIGINT`, PK, Identity)
- `session_id` (`BIGINT`, NOT NULL, FK $\to$ `sessions.session_id`)
- `declared_status` (`priority_status_enum`, NOT NULL, Check: `<> 'standard'`)
- `id_presented` (`BOOLEAN`, NOT NULL, Default: `FALSE`)
- `id_last4` (`CHAR(4)`, NULL, Check: `~ '^[0-9]{4}$'`): **Last 4 digits only** (Data minimization under RA 10173).
- `cardholder_name` (`VARCHAR(80)`, NULL): Name transcribed from physical ID card.
- `issuing_lgu` (`VARCHAR(50)`, NULL): Municipality or city of issue (e.g., `"Davao City"`).
- `verified_by` (`VARCHAR(8)`, NULL, FK $\to$ `staff_accounts.staff_id`)
- `verified_at` (`TIMESTAMPTZ`, NULL)
- `discount_eligible` (`BOOLEAN`, NOT NULL, Default: `FALSE`)

#### 14. `audit_log` (Transactional Table)
Append-only system action audit trail for sensitive administrative changes and POS integrations.
- `audit_id` (`BIGINT`, PK, Identity)
- `staff_id` (`VARCHAR(8)`, NULL, FK $\to$ `staff_accounts.staff_id`): NULL for automated system actions.
- `action` (`VARCHAR(40)`, NOT NULL): e.g., `"pos_transmit"`, `"menu_update"`.
- `entity_type` (`VARCHAR(40)`, NOT NULL)
- `entity_id` (`VARCHAR(20)`, NULL)
- `before_state` (`JSONB`, NULL)
- `after_state` (`JSONB`, NULL)
- `ip_address` (`INET`, NULL)
- `occurred_at` (`TIMESTAMPTZ`, NOT NULL, Default: `now()`)

---

## 7. The Four Core Mathematical & Business Logic Algorithms

All four core algorithms execute **server-side only** inside `backend/app/services/`. The frontend client never computes prices, discounts, queue numbers, or queue positions.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CORE ALGORITHM OVERVIEW                         │
├─────────────────────────┬──────────────────────────────────────────────┤
│ 1. Fairness-Bounded     │ Bounded priority insertion preventing        │
│    Priority Queue       │ standard customer starvation (`MAX_SKIPS=3`).│
├─────────────────────────┼──────────────────────────────────────────────┤
│ 2. Confusion Detection  │ Dual-signal concurrence across 4 behavioral  │
│    Engine               │ signals within a 120s sliding decay window.  │
├─────────────────────────┼──────────────────────────────────────────────┤
│ 3. Apriori Rule Mining  │ Demographic-segmented transaction mining     │
│    & Retrieval          │ with $<50$ms indexed GIN containment lookup. │
├─────────────────────────┼──────────────────────────────────────────────┤
│ 4. Statutory Tax &      │ Strict RA 9994/10754 statutory formula:      │
│    Discount Math        │ Base Exempt = Gross/1.12; 20% on exempt base.│
└─────────────────────────┴──────────────────────────────────────────────┘
```

---

### Algorithm 1: Fairness-Bounded Priority Queue (`services/queue.py`)

#### Problem & Core Invariant
Under Philippine law, senior citizens and PWDs are entitled to expedited queueing. However, an unconstrained priority queue creates starvation: during lunch rushes, a continuous arrival of priority diners pushes standard diners back indefinitely.

#### The Crucial Schema & Logical Correction
Earlier specifications mistakenly suggested counting how many standard orders a *priority order* had passed. That failed because every *new* priority arrival began with a counter of 0, perpetually starving standard orders at the front of the line.  
**The Solution:** The counter `priority_skips_used` belongs strictly to **the standard order being skipped**. It increments every time a newer priority order cuts ahead of it.

#### Three Non-Negotiable Queue Invariants:
1. **Cooking Food is Immovable:** If `prep_started_at IS NOT NULL`, the kitchen has begun preparation; this slot can **never** be reordered or moved backward.
2. **Priority Orders are FIFO Among Themselves:** A newly arriving priority order never overtakes an earlier-arriving priority order.
3. **Protected Standard Orders are Immovable:** Once a standard order's `priority_skips_used` reaches `MAX_PRIORITY_SKIPS` (default: 3), it becomes **protected**. No subsequent priority order may cut ahead of it.

#### Insertion Pseudocode & Concurrency:
```python
# Synchronized via PostgreSQL advisory transaction lock:
# SELECT pg_advisory_xact_lock(hashtext('kitchen_queue'))

def place_in_queue(new_order):
    if not new_order.is_priority:
        append_to_tail(new_order)
        return

    # Scan past orders that are either:
    # 1. Already cooking (started)
    # 2. Existing priority orders (FIFO among priority)
    # 3. Protected standard orders (hit MAX_PRIORITY_SKIPS)
    index = 0
    while index < len(active_queue) and (
        active_queue[index].started or 
        active_queue[index].is_priority or 
        active_queue[index].protected
    ):
        index += 1

    # Insert new priority order at position 'index'
    insert_at(new_order, index)

    # Charge a skip penalty to all standard orders pushed backward
    for order in active_queue[index + 1:]:
        if not order.is_priority and not order.started:
            order.priority_skips_used += 1

    renumber_all_positions()
```

#### Worked Demonstration Table (`MAX_PRIORITY_SKIPS = 3`):
| Step | Action | Resulting Queue Order | S1 Skips | S2 Skips | S3 Skips | Notes |
|:---:|:---|:---|:---:|:---:|:---:|:---|
| 0 | Initial State | `[S1, S2, S3]` | 0 | 0 | 0 | Three standard orders waiting |
| 1 | Priority P1 arrives | `[P1, S1, S2, S3]` | 1 | 1 | 1 | All standard orders skipped once |
| 2 | Priority P2 arrives | `[P1, P2, S1, S2, S3]` | 2 | 2 | 2 | All standard orders skipped twice |
| 3 | Priority P3 arrives | `[P1, P2, P3, S1, S2, S3]` | 3 | 3 | 3 | S1, S2, S3 hit maximum skips (protected!) |
| 4 | Priority P4 arrives | `[P1, P2, P3, S1, S2, S3, P4]` | 3 | 3 | 3 | **P4 cannot cut.** Appended behind protected standard orders! |

---

### Algorithm 2: Confusion-Detection Engine (`hooks/useConfusionSignals.js`)

#### Theoretical Rationale (Hick's Law)
Decision time increases logarithmically with the number and complexity of choices. When menu overload strikes, diners enter choice paralysis. Rather than annoying confident diners with constant upsells, the system detects behavioral hesitation before displaying suggestions.

#### The Four Monitored Client Signals:
1. **Dwell Timeout (`dwell`):** An individual menu item card remains $\ge 50\%$ visible within the mobile viewport continuously for **45 seconds** (tracked via `IntersectionObserver`). *Demo note:* Can be overridden down to 10s or 3s via `VITE_DWELL_THRESHOLD_SEC` for live evaluation.
2. **Back-Navigation Threshold (`back`):** The customer performs **3 or more back actions** within a single session (history pops, modal dismissals, or navigating back to menu from cart).
3. **Cart Abandonment (`abandon`):** The cart goes from $\ge 1$ items to 0 items, followed by a category browse or item detail view within **60 seconds**.
4. **Scroll Reversal / Category Revisit (`scroll`):** The customer navigates back into a menu category that they have already visited and departed earlier in the session.

#### Concurrence & Trigger Constraints:
- **Concurrence Rule:** The recommendation overlay displays **if and only if any TWO distinct signals are active concurrently**.
- **Sliding Decay Window:** When any signal fires, it is registered with an expiration timestamp: `Date.now() + (120 * 1000)`. After **120 seconds** (`CONFUSION_WINDOW_SEC`), the signal expires and drops out of the active set.
- **Cooldown Interval:** After triggering recommendations, a mandatory **180-second cooldown** (`CONFUSION_COOLDOWN_SEC`) is enforced to prevent harassing the customer.
- **Session Cap:** Maximum of **3 triggers per session** (`CONFUSION_MAX_PER_SESSION`).
- **Reset on Decisiveness:** If the diner adds an item to the shopping cart, **all active hesitation signals are immediately wiped**. Adding an item proves the customer has resolved their hesitation.

---

### Algorithm 3: Demographic-Segmented Apriori Recommendation Engine

#### Segment Partitioning
Transaction market baskets are segmented by the session's context:
- `standard`: Single device, standard customer.
- `priority`: Self-declared senior, PWD, or pregnant diner.
- `group`: Two or more smartphones connected to the table session.

#### Phase A: Offline Batch Rule Mining (`jobs/apriori.py` & `services/apriori.py`)
Mined nightly (or triggered via Admin console) over completed, non-voided transactions:
1. Extract transactions grouped by `session_type`, building binary sparse basket matrices.
2. Mine frequent itemsets using `mlxtend.frequent_patterns.apriori` with `min_support = 0.15`.
3. Generate association rules using `mlxtend.frequent_patterns.association_rules` on metric `lift` with `min_threshold = 1.0`.
4. Filter consequents: Consequents are constrained strictly to **single-item consequents** (`len(consequent) == 1`) with `lift >= 1.05`.
5. Retain top 12 rules per segment sorted by `lift DESC`, and persist atomically to `apriori_rules`.

#### Phase B: Low-Latency Online Retrieval (`services/recommendation.py`)
Executed when Algorithm 2 fires:
1. Target Budget: $< 50$ms response latency.
2. Fetch top rules matching `session_type = :segment AND lift > 1.0`.
3. Filter where rule antecedents are a subset of the current cart: `apriori_rules.antecedents <@ :cart_jsonb`.
4. **Empty Cart Fallback:** If the cart is empty (when paralysis is most severe), the query omits the antecedent match and returns the top 3 consequents with the highest overall lift in that demographic segment.
5. Suggestions return up to **3 items maximum** (Hick's Law constraint), displaying item name, price, lift score, and confidence.

---

### Algorithm 4: Statutory Discount & VAT Computation (RA 9994 & RA 10754)

#### The Common Naive Arithmetic Error
In the Philippines, restaurant menu prices are legally mandated to be **VAT-inclusive** (12% VAT). Under RA 9994 (Senior Citizens) and RA 10754 (PWD), eligible patrons are entitled to **both VAT exemption AND a 20% statutory discount**.
- ❌ **The Wrong (Naive) Calculation:**
  $$\text{Price} \times (1 - 0.20) = 112.00 \times 0.80 = 89.60$$
- ✅ **The Correct Statutory Formula:**
  $$\text{VAT-Exempt Base} = \frac{\text{VAT-Inclusive Gross}}{1 + \text{VAT Rate}} = \frac{112.00}{1.12} = 100.00$$
  $$\text{Statutory Discount} = \text{VAT-Exempt Base} \times 0.20 = 100.00 \times 0.20 = 20.00$$
  $$\text{Net Amount Due} = \text{VAT-Exempt Base} - \text{Statutory Discount} = 100.00 - 20.00 = 80.00$$
  *(Note: Applying 20% directly to the VAT-inclusive price overcharges the senior by ₱9.60 per ₱112 item!)*

#### Line-Item Precision & Reconciliation Invariant
Calculations are executed **per line item** using `ROUND_HALF_UP` to 2 decimal places, then summed:
```python
line_gross = round(unit_price * quantity)
if is_senior_or_pwd:
    line_exempt = round(line_gross / 1.12)
    line_discount = round(line_exempt * 0.20)
    line_net = line_exempt - line_discount
    line_vatable = 0.00
    line_vat = 0.00
else:
    line_vatable = round(line_gross / 1.12)
    line_vat = line_gross - line_vatable
    line_net = line_gross
    line_exempt = 0.00
    line_discount = 0.00
```
- **Legal Compliance Rule:** **Pregnant diners receive priority queue placement, but NO statutory discount.** Statutory discounts apply strictly to `senior` and `pwd`.
- **Reconciliation Invariant:** Every order must mathematically balance before saving to the database:
  $$\text{net\_amount} == \text{vat\_exempt\_sales} - \text{discount\_amount} + \text{vatable\_sales} + \text{vat\_amount}$$

#### Daily Queue Number Assignment:
Queue numbers (`Q-001` to `Q-999`) reset each business day (midnight in `Asia/Manila` time). When an order is placed, an advisory transaction lock or `SELECT COALESCE(MAX(queue_number), 0) + 1 FROM transactions WHERE queue_date = CURRENT_DATE FOR UPDATE` serializes assignment, preventing race collisions.

---

## 8. Real-Time Push & WebSocket Architecture

The system uses native FastAPI WebSockets instead of client HTTP polling:

```
┌─────────────────┐                 ┌──────────────────┐                 ┌─────────────────┐
│ Customer Device │                 │ FastAPI Server   │                 │ Kitchen Display │
│ (Table Session) │                 │ WebSocket Hub    │                 │ (Staff Queue)   │
└────────┬────────┘                 └────────┬─────────┘                 └────────┬────────┘
         │                                   │                                    │
         │  WS /ws/orders/{id}?device={tok}  │                                    │
         │──────────────────────────────────>│                                    │
         │  Connection Accepted              │      WS /ws/kitchen (JWT Cookie)   │
         │<──────────────────────────────────│<───────────────────────────────────│
         │                                   │      Connection Accepted           │
         │                                   │───────────────────────────────────>│
         │                                   │                                    │
         │  POST /api/v1/orders/{session_id} │                                    │
         │──────────────────────────────────>│                                    │
         │                                   │  publish_new_order()               │
         │                                   │  {"type": "queue_changed"}         │
         │                                   │───────────────────────────────────>│
         │                                   │                                    │
         │                                   │  PATCH /queue/{txn_id}/status      │
         │                                   │<───────────────────────────────────│
         │  publish_status()                 │  (Crew marks 'preparing')          │
         │  {"type": "order_status", ...}    │                                    │
         │<──────────────────────────────────│                                    │
         │  (Customer UI updates live!)      │                                    │
```

- **Customer Endpoint:** `/ws/orders/{session_id}?device={device_token}`  
  Authenticates via UUID `device_token` belonging to that table session. Disconnects with code 4401/4403 if invalid.
- **Kitchen / Staff Endpoint:** `/ws/kitchen`  
  Authenticates via `shaxian_session` HTTP cookie containing valid staff JWT. Disconnects if cookie missing or role unauthorized.
- **`ConnectionManager` (`websocket/manager.py`):** Maintains in-memory thread-safe sets of active WebSocket connections partitioned by table session ID and kitchen channel.

---

## 9. POS Integration Layer (Objective 1.3.2.5)

To satisfy integration objective 1.3.2.5 without access to the proprietary schema of the partner restaurant's counter terminal, the system includes an **authenticated HTTP POS Bridge with a Simulated Counter Register**:

1. **Automatic Counter Synchronization:**  
   When staff collects cash payment (`POST /api/v1/queue/{txn_id}/payment`), the backend automatically serializes the settled order and transmits it over the local network to `POS_ENDPOINT`.
2. **Payload & Wire Precision:**
   - Currency values cross the wire formatted as fixed-point strings (`"100.00"`), never floating-point numbers.
   - Payload includes store code (`SXN-SASA-01`), terminal code (`REG-01`), table number, queue number, item breakdowns, and tax breakdowns.
3. **Idempotency Guarantee:**
   - Every transmission calculates an `idempotency_key` via SHA-256 of the payload content:
     $$\text{key} = \text{sha256}(f\text{"{store}:{txn}:{queue}:{net}:{items_hash}"})$$
   - If the network retries or re-sends, the register matches the key and returns the existing receipt number with `duplicate: true`, preventing double-posting.
4. **Audit Trail:**
   - Outbound transmissions, payload byte size, round-trip latency (ms), attempts, and responses are permanently logged to `audit_log` with action `'pos_transmit'`.
   - The Admin console includes a dedicated **POS Bridge Console** (`/admin/pos`) displaying bridge status, latency metrics, and an inspection modal for raw JSON payloads and official receipt printouts.

---

## 10. Online Payment Aggregator Integration (PayMongo) & Session State Resiliency

To enable modern cashless settlements alongside counter cashier payments, the system integrates the **PayMongo Checkout API v1**:

### 10.1 Payment Architecture & Supported Rails
- **Payment Rails:** Supports Philippine e-wallets (**GCash**, **Maya / PayMaya**), cards (**Visa / Mastercard**), and interoperable national QR (**QR Ph** via Bangko Sentral ng Pilipinas standards).
- **Checkout Session Workflow:**
  1. Customer selects **Pay Online (GCash / Card)** at checkout.
  2. Frontend sends `payment_method: "online"` and `origin_url: window.location.origin` to `POST /api/v1/orders/{session_id}`.
  3. Server invokes `payment_service.initiate_online_payment()` which communicates with `https://api.paymongo.com/v1/checkout_sessions` using HTTP Basic Auth (`PAYMONGO_SECRET_KEY`).
  4. Amount is converted from `Decimal` pesos to integer centavos ($100\text{ centavos} = ₱1.00$).
  5. If configured and amount $\ge ₱1.00$ (`MIN_ONLINE_AMOUNT`), PayMongo returns a hosted `checkout_url`.
  6. Customer's browser redirects via `window.location.assign(receipt.checkout_url)` to complete the payment.

### 10.2 Graceful Cashier Fallback
If `PAYMONGO_SECRET_KEY` is omitted, network connectivity to the internet is down, or the order net amount is below ₱1.00:
- The system automatically falls back to **Pay at Cashier** (`fallback_to_cashier = True`).
- The payment record is assigned aggregator reference `'CASHIER-FALLBACK'` with status `pending`.
- A blue informational toast alerts the diner: *"Online payment is unavailable. Switched to Pay at Cashier."*
- Ordering is never blocked by external payment provider downtime.

### 10.3 Payment Verification & Live Reconciliation
- **Return URLs:** PayMongo redirects back to the SPA receipt endpoint:
  - Success: `/t/{table.qr_token}/receipt?txn_id={txn_id}&verify=1&device={device_token}`
  - Cancellation: `/t/{table.qr_token}/receipt?txn_id={txn_id}&cancelled=1&device={device_token}`
- **Active Verification (`POST /api/v1/orders/{session_id}/verify/{txn_id}`):**
  - When the customer returns with `verify=1`, `ReceiptPage.jsx` triggers immediate verification.
  - Server queries PayMongo's `GET /v1/checkout_sessions/{id}` to verify payment status.
  - If paid, sets `Payment.status = PaymentStatus.PAID`, `Transaction.paid_at = now()`, and broadcasts live status update via WebSocket.
- **Webhook Reconciliation (`POST /api/v1/webhooks/paymongo`):**
  - Asynchronously receives `checkout_session.payment.paid` webhooks.
  - Verifies HMAC signature using `PAYMONGO_WEBHOOK_SECRET` to prevent tampering.

### 10.4 Session Identity Preservation (Phantom Device Prevention)
When navigating off-site to PayMongo and redirecting back:
1. **The SPA Lifecycle Problem:** A full-page browser navigation wipes React and Zustand in-memory state. If the returning request creates a new session device without an identifier, `device_count` falsely increments (e.g., displaying *"3 phones ordering together"* when only 1 physical phone exists) and forces `group_mode = True`.
2. **The Multi-Layered Preservation Mechanism:**
   - **URL Token Embedding:** `payment.py` embeds the current device's UUID token directly into the PayMongo return query string: `&device={device_token}`.
   - **URL Query Extraction:** `sessionStore.js` (`recall()`) inspects `window.location.search` for `?device=`. If found, it immediately recovers and persists the identity to `localStorage` (`shaxian.device`).
   - **Case-Insensitive Reconciliation:** `recall()` normalizes `qr_token` comparisons with `.toLowerCase()` to guard against case variations across redirects.
   - **Backend Device Lookup:** `open_session()` in `backend/app/services/session.py` matches the recovered `device_token` against existing `SessionDevice` records, reusing the existing device without creating phantom entries.

---

## 10. Context-Aware Navigation Guidance (`useNavGuidance.js`)

Distinct from the Apriori recommendation overlay (which answers *"what should I order?"*), the **Navigation Guidance Engine** answers *"how do I proceed?"*:
- **Frustration Detection:** Observes user interaction with primary buttons. If a diner taps a tracked control $\ge 3$ times within 10 seconds (`WINDOW_MS = 10000`, `REPEAT_LIMIT = 3`) without completing the step, or if they tap the floating **Help FAB** (`?`), guidance triggers.
- **Dynamic Action Highlighting:** Computes the logical next step based on session state:
  - If viewing cart $\to$ highlights **Checkout**.
  - If on checkout page $\to$ highlights **Place Order**.
  - If on menu with items in cart $\to$ highlights **View Basket**.
  - If on menu with empty cart $\to$ highlights **Add to Cart**.
- Renders an animated pulse highlight box (`NavHighlight.jsx`) over the target control, auto-dismissing after 6 seconds.

---

## 11. Security, Privacy & DPA 2012 Compliance

### 11.1 Input Handling: Prevention, Validation, Verification
The system enforces input sanitization across three defensive layers:

```
[Keypress Event] ──► 1. Prevention: Invalid chars ignored immediately.
[Blur Event]     ──► 2. Validation: Pattern & length checked; inline error.
[Form Submit]    ──► 3. Verification: Server schema validation; toast on error.
```

- **Input Classes (`frontend/src/lib/inputClasses.js` & `backend/app/schemas/fields.py`):**
  - `alpha`: Latin characters, spaces, hyphens, apostrophes.
  - `alphanumeric`: Letters, numbers, spaces, parentheses.
  - `numeric`: Digits `0-9` only.
  - `currency`: Digits with up to two decimal places.
  - `freetext`: Printable ASCII and accented Latin characters.
- **Strict Character Ban:** Emoji, control codes (`0x00-0x1F`), zero-width spaces (`0x200B-0x200D`, `0xFEFF`), and decorative Unicode ranges are **strictly stripped client-side and rejected with 422 server-side**.
- **Length Synchronization:** Client `maxlength` attributes match database column widths exactly (e.g., category name = 40, item name = 60, description = 160, username = 30, full name = 80). Typing past the limit is blocked at the keyboard.

### 11.2 Authentication & Authorization
- **Staff Sessions:** Stored in an HTTP-only, `SameSite=Strict` cookie named `shaxian_session`. Protected from JavaScript XSS theft.
- **Customer Authentication:** Customers carry no passwords. The table QR code issues a high-entropy `device_token` (UUIDv4) stored in browser `localStorage`. Every customer API request sends this via the `X-Device-Token` HTTP header. Service guards verify the token belongs to that table's active session.
- **Server-Side Pricing Boundary:** The checkout payload sends *only* `item_id` and `quantity`. The client is **never allowed to submit prices, discounts, or subtotals**. The server prices every line from `menu_items` at checkout time.

### 11.3 Toast Notification System (`Security.md` §4)
- **Geometry:** Sharp rectangle (`--radius: 0`), no borders, centered bold text, floating with `--shadow-raised`.
- **Auto-Dismiss Rules:**
  - Success toasts: Green tint (`#E8F3EE`), dismiss after 3 seconds.
  - Info toasts: Blue tint (`#E9EFF6`), dismiss after 4 seconds.
  - **Error toasts:** Red tint (`#F7E9E9`), **NEVER auto-dismiss**. Errors persist until manually dismissed or resolved.
- **No 'X' Buttons:** Consistent with modal dialogs, toasts have no 'X' icon. Dismissal is performed by clicking anywhere on the toast body.
- **Modal-Scoped Stacking:** When an error occurs inside a modal dialog, the toast is constrained inside the top-right of that modal container rather than the viewport.

---

## 12. UI/UX Design System, Typography & Accessibility

### 12.1 Visual Thesis & Color Tokens
The aesthetic reflects a Chinese street-food house: aged paper, seal-stamp red, and ink-brush black.

```css
:root {
  /* Brand Identity */
  --cream:        #F7F2E8;   /* Aged paper background for headers & customer menu */
  --cream-deep:   #EFE7D6;   /* Inset panels on cream */
  --red:          #B32821;   /* Seal-stamp red: Brand identity, seal squares, markers */
  --red-deep:     #8A1D18;   /* Pressed brand state, chart accent */
  --ink:          #1A1A1A;   /* Primary body text & PRIMARY ACTION BUTTONS */

  /* Surfaces */
  --bg:           #FFFFFF;   /* Clean white working surfaces */
  --surface:      #FAFAFA;   /* Zebra rows, cards */
  --surface-2:    #F4F5F6;   /* Disabled fills, table borders */
  --border:       #E5E7EB;   /* Hairlines */
  --border-strong:#D1D5DB;   /* Form inputs */

  /* Semantic Actions */
  --green:        #1E7B4D;   /* Add / Create */
  --amber:        #B57614;   /* Edit / Update */
  --danger:       #9B1C1C;   /* Delete / Destructive actions (cooler than brand red) */
  --blue:         #1D4E89;   /* Inspect / View */
}
```

> **The Red Button Ban:** `--red` is **NEVER** used as a button background color. Primary action buttons are solid ink-black (`--ink`). This prevents brand red from clashing with destructive action red (`--danger`).

### 12.2 Geometric Restraint & The Anti-Slop Rules (`UIDesign.md` §19)
- **Zero Border Radius (`--radius: 0`):** Every card, button, modal, text input, and data table in the system has completely square, sharp corners.
- **The One Exception:** Status badges (`Badge.jsx`) are the **only rounded pills** in the entire design system. This deliberate contrast makes status chips instantly scannable.
- **Zero Resting Shadows:** Cards, inputs, and tables have no drop shadows. Only floating overlays (modals, dropdown menus, toasts) earn a shadow (`--shadow-raised`).
- **The Signature Seal Square:** A 6×6px solid red square appears in exactly four locations:
  1. Under the active navigation bar link (as a 3px red bar).
  2. Before major section headings.
  3. In modal header titles.
  4. Marking the active step in order status steppers.

### 12.3 Typography & macOS-Grade Rendering
- Single font family: **Inter Variable** (`InterVariable.woff2`), self-hosted locally for offline execution.
- Configured with OpenType stylistic features for a clean, SF Pro-like rendering:
  ```css
  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: 'cv11', 'ss01';
  }
  ```
  (`cv11` provides single-storey `a`, `ss01` provides straight-tailed `l`).

### 12.4 Dynamic Accessibility-Adaptive Mode
Activated automatically when a customer declares **Senior, PWD, or Pregnant** status, or toggled on the `/dev/atoms` catalog:
- Appends `data-ui-mode="accessible"` to the root `<html>` element.
- Overrides base tokens:
  - Base font size jumps from 15px $\to$ **20px**.
  - Minimum interactive tap target jumps from 44px $\to$ **60px**.
  - Multi-column grid layouts collapse into **single-column vertical layouts**.
  - Background contrast increases to exceed **WCAG AAA (7:1)**.
  - Decorative background watermarks are hidden.

### 12.5 Trilingual Internationalization (i18n)
Full localization across English (`en`), Filipino (`fil`), and Bisaya (`bis`):
- Translation files located in `frontend/src/locales/{en,fil,bis}.json`.
- Menu items and categories store three distinct columns in PostgreSQL (`name_en`, `name_fil`, `name_bis`). When the language toggle is clicked, the database entity dynamically displays the corresponding column.

---

## 13. Complete API Specification Catalog

### 13.1 Authentication & Staff (`/api/v1/auth`)
| Method | Path | Auth Required | Description | Request Body | Response |
|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/login` | None | Authenticate staff credentials | `{ username, password }` | `StaffRead` + sets `shaxian_session` cookie |
| `POST` | `/api/v1/auth/logout` | Staff Cookie | Terminate staff session | None | HTTP 204 (clears cookie) |
| `GET` | `/api/v1/auth/me` | CurrentStaff | Inspect current authenticated staff | None | `StaffRead` |

### 13.2 Table Sessions (`/api/v1/sessions`)
| Method | Path | Auth Required | Description | Request Body | Response |
|---|---|---|---|---|---|
| `POST` | `/api/v1/sessions` | None | Open or join session via QR token | `{ qr_token, device_token? }` | `SessionRead` |
| `GET` | `/api/v1/sessions/{id}` | CurrentDevice | Read active session status | None | `SessionRead` |
| `PATCH`| `/api/v1/sessions/{id}/declaration` | CurrentDevice | Self-declare priority demographic | `{ declared_priority_status }` | `SessionRead` |
| `PATCH`| `/api/v1/sessions/{id}/preferences` | CurrentDevice | Update language or UI mode | `{ language_used, ui_mode_used }` | `SessionRead` |

### 13.3 Physical Tables & QR Management (`/api/v1/tables`)
| Method | Path | Auth Required | Description | Request Body | Response |
|---|---|---|---|---|---|
| `GET` | `/api/v1/tables` | AnyStaff | List tables with live occupancy, device count, LAN IP | None | `TableCatalogRead` |
| `POST` | `/api/v1/tables/{table_id}/reset` | AnyStaff | Reset active table session to VACANT | None | `TableRead` |
| `POST` | `/api/v1/tables/{table_id}/regenerate` | AdminStaff | Invalidate old token and issue fresh QR code | None | `TableRead` |
| `GET` | `/api/v1/tables/{table_id}/qr` | None | Generate PNG QR code pointing to detected LAN URL | Query: `base_url?` | `image/png` |

### 13.4 Menu Management (`/api/v1/menu`)
| Method | Path | Auth Required | Description | Request Body | Response |
|---|---|---|---|---|---|
| `GET` | `/api/v1/menu/categories` | None | List categories in display order | Query: `active_only` | `list[CategoryRead]` |
| `POST` | `/api/v1/menu/categories` | AdminStaff | Create new category | `CategoryWrite` | `CategoryRead` (201) |
| `PATCH`| `/api/v1/menu/categories/{id}` | AdminStaff | Update category details | `CategoryWrite` | `CategoryRead` |
| `DELETE`|`/api/v1/menu/categories/{id}` | AdminStaff | Delete category (restricted if holds items)| None | HTTP 204 |
| `GET` | `/api/v1/menu/items` | None | List full menu catalog | Query: `available_only` | `list[MenuItemRead]` |
| `POST` | `/api/v1/menu/items` | AdminStaff | Create menu item | `MenuItemWrite` | `MenuItemRead` (201) |
| `PATCH`| `/api/v1/menu/items/{id}` | AdminStaff | Update menu item | `MenuItemWrite` | `MenuItemRead` |
| `DELETE`|`/api/v1/menu/items/{id}` | AdminStaff | Delete menu item | None | HTTP 204 |

### 13.5 Cart, Quoting & Checkout (`/api/v1/orders` & `/api/v1/transactions`)
| Method | Path | Auth Required | Description | Request Body | Response |
|---|---|---|---|---|---|
| `POST` | `/api/v1/orders/{session_id}/quote` | CurrentDevice | Price cart preview with exact VAT/discount | `QuoteCreate` (`items`) | `QuoteRead` |
| `POST` | `/api/v1/orders/{session_id}` | CurrentDevice | Place order, issue queue ticket & initiate PayMongo | `OrderCreate` (`items, payment_method, language, origin_url`) | `ReceiptRead` (201) |
| `POST` | `/api/v1/orders/{session_id}/verify/{txn_id}` | CurrentDevice | Verify online payment via PayMongo API & mark paid | None | `ReceiptRead` |
| `GET` | `/api/v1/orders/{session_id}/receipt/{txn_id}` | CurrentDevice | Retrieve receipt details | None | `ReceiptRead` |
| `GET` | `/api/v1/orders/{session_id}/latest` | CurrentDevice | Get live status of table's active orders | None | `list[OrderStatusRead]` |
| `GET` | `/api/v1/transactions` | AdminStaff | List full financial transactions | None | `list[TransactionRead]` |

### 13.5 Kitchen Queue & Operations (`/api/v1/queue`)
| Method | Path | Auth Required | Description | Request Body | Response |
|---|---|---|---|---|---|
| `GET` | `/api/v1/queue` | AnyStaff | List live active kitchen queue | None | `list[QueueEntryRead]` |
| `PATCH`| `/api/v1/queue/{txn_id}/status` | AnyStaff | Advance state (pending $\to$ preparing $\to$ ready $\to$ completed) | `{ status }` | `OrderStatusRead` |
| `POST` | `/api/v1/queue/{txn_id}/payment` | AnyStaff | Cashier confirms cash received; triggers POS | None | `OrderStatusRead` |

### 13.6 Recommendations & Analytics (`/api/v1`)
| Method | Path | Auth Required | Description | Request Body | Response |
|---|---|---|---|---|---|
| `POST` | `/api/v1/recommendations/{session_id}`| CurrentDevice | Fetch Apriori suggestions on hesitation | `{ cart, language }` | `RecommendationResponse` |
| `POST` | `/api/v1/analytics/{session_id}/events`| CurrentDevice | Post client behavioral telemetry event | `EventWrite` | HTTP 204 |
| `GET` | `/api/v1/analytics/summary` | AdminStaff | Aggregate KPIs, sales trend, segment mix | None | `AnalyticsSummary` |
| `POST` | `/api/v1/analytics/apriori/run` | AdminStaff | Trigger on-demand Apriori rule generation | None | `AprioriRunRead` |
| `GET` | `/api/v1/analytics/verifications` | AdminStaff | Audit trail of priority declarations | None | `list[VerificationRow]` |

### 13.7 POS Integration Bridge (`/api/v1/pos`)
| Method | Path | Auth Required | Description | Request Body | Response |
|---|---|---|---|---|---|
| `POST` | `/api/v1/pos/register/inbox` | None | Simulated register terminal endpoint | Raw POS payload dict | `RegisterAck` (`receipt_no, duplicate`) |
| `GET` | `/api/v1/pos/register/{txn_id}` | CurrentStaff | Inspect register record for transaction | None | Held receipt status |
| `POST` | `/api/v1/pos/transmit/{txn_id}` | CurrentStaff | Manually trigger POS transmission | None | `TransmitResult` |
| `GET` | `/api/v1/pos/transmissions` | AdminStaff | List all outbound transmission logs | None | `list[TransmissionRead]` |
| `GET` | `/api/v1/pos/status` | AdminStaff | Get POS bridge health & average latency | None | `BridgeStatus` |

### 13.8 WebSockets (`/ws`)
| Path | Protocol | Auth Requirement | Broadcast Trigger |
|---|---|---|---|
| `/ws/orders/{session_id}?device={token}` | WebSocket | `device_token` belonging to session | Pushes live order status updates to customer phone. |
| `/ws/kitchen` | WebSocket | Staff JWT session cookie | Pushes live queue changes to kitchen display. |

---

## 14. Frontend Architecture & State Management

### 14.1 Zustand Stores (`frontend/src/store/`)
- `sessionStore.js`: Holds active session details (`session_id`, `table_number`, `device_token`, `declared_priority_status`, `session_type`, `ui_mode_used`, `language_used`). Synchronizes `data-ui-mode` on `<html>` and updates i18next language.
- `cartStore.js`: Manages local cart array `lines: [{ item_id, name, price, quantity }]`. Provides `add()`, `remove()`, `update()`, and `clear()`.
- `authStore.js`: Holds authenticated staff object (`staff_id`, `username`, `full_name`, `role`). Handles login/logout API calls.
- `toastStore.js`: Queue of active toasts (max 3 visible). Handles deduplication, timeouts, and dismissals.
- `uiStore.js`: Controls view mode switches (e.g., table vs grid tile view on admin console).

### 14.2 Custom React Hooks (`frontend/src/hooks/`)
- `useConfusionSignals.js`: Implements Algorithm 2. Observes item visibility via `IntersectionObserver`, intercepts window `popstate` for back-navigation, watches cart emptying, and measures category revisits. Dispatches recommendation fetch when 2 signals concur.
- `useNavGuidance.js`: Implements Section 10. Tracks repeated clicks on interactive controls; calculates next logical workflow step.
- `useWebSocket.js`: Manages resilient WebSocket connection lifecycle with reconnection handlers.
- `usePagination.js`: Standardizes client-side pagination slicing and navigation across admin tables.

---

## 15. Complete Repository File Structure

```
QR-Ordering-System-POS-Integrated_Shaxian/
├── .env                              # Active environment variables
├── .env.example                      # Template environment variables
├── .gitignore                        # Git exclusion rules
├── README.md                         # Quickstart setup instructions
├── PROJECT_REFERENCE.md              # THIS FILE — Master AI & Developer Reference
│
├── backend/                          # FastAPI Backend Application
│   ├── alembic.ini                   # Alembic migration configuration
│   ├── requirements.txt              # Python package dependencies
│   ├── alembic/                      # Database Schema Migrations
│   │   ├── env.py                    # Migration execution environment
│   │   └── versions/                 # Versioned schema migration files
│   ├── app/                          # Core Application Source Code
│   │   ├── config.py                 # Pydantic Settings & environment validation
│   │   ├── database.py               # SQLAlchemy async engine & session factory
│   │   ├── main.py                   # FastAPI app creation & router registration
│   │   ├── core/                     # Cross-Cutting Infrastructure
│   │   │   ├── customer.py           # CurrentDevice X-Device-Token dependency
│   │   │   ├── deps.py               # CurrentStaff & AdminStaff auth dependencies
│   │   │   ├── exceptions.py         # AppError hierarchy & correlation ID handler
│   │   │   └── security.py           # bcrypt password hashing & JWT token handling
│   │   ├── models/                   # SQLAlchemy Database Models (14 Tables)
│   │   │   ├── analytics.py          # AnalyticsEvent model
│   │   │   ├── audit.py              # AuditLog model
│   │   │   ├── enums.py              # PostgreSQL native Enum classes
│   │   │   ├── keys.py               # Formatted string PK generation helpers
│   │   │   ├── menu.py               # Category and MenuItem models
│   │   │   ├── order.py              # Transaction and TransactionItem models
│   │   │   ├── payment.py            # Payment model
│   │   │   ├── queue.py              # KitchenQueue model
│   │   │   ├── recommendation.py     # AprioriRule model
│   │   │   ├── session.py            # Session and SessionDevice models
│   │   │   ├── staff.py              # StaffAccount model
│   │   │   ├── table.py              # Table model
│   │   │   └── verification.py       # PriorityVerificationLog model
│   │   ├── routers/                  # API Route Controllers
│   │   │   ├── auth.py               # Staff login, logout, me endpoints
│   │   │   ├── menu.py               # Categories & menu items CRUD
│   │   │   ├── orders.py             # Order placement, quoting, transactions list
│   │   │   ├── pos.py                # POS bridge, simulated register, transmission log
│   │   │   ├── queue.py              # Kitchen queue, status updates, cash payment
│   │   │   ├── realtime.py           # WebSocket handlers (/ws/orders & /ws/kitchen)
│   │   │   ├── recommendations.py    # Recommendation fetch & analytics endpoints
│   │   │   └── sessions.py           # QR session opening & priority declarations
│   │   ├── schemas/                  # Pydantic Data Validation Schemas
│   │   │   ├── analytics.py          # Analytics summary, funnel, verification schemas
│   │   │   ├── auth.py               # Login request & staff read schemas
│   │   │   ├── checkout.py           # Quote and order placement schemas
│   │   │   ├── fields.py             # Sanitized input constraint types (alpha, price)
│   │   │   ├── menu.py               # Category & menu item read/write schemas
│   │   │   ├── order.py              # Transaction summary schemas
│   │   │   ├── pos.py                # POS transmission & register ack schemas
│   │   │   ├── queue.py              # Kitchen queue entry & status schemas
│   │   │   ├── recommendation.py     # Recommendation suggestions & event schemas
│   │   │   └── session.py            # Session open & declaration schemas
│   │   ├── services/                 # Business Logic & Algorithms
│   │   │   ├── analytics.py          # Sales aggregation & dashboard KPIs
│   │   │   ├── apriori.py            # mlxtend association rule mining engine
│   │   │   ├── auth.py               # Staff authentication & credential checks
│   │   │   ├── menu.py               # Menu & category database operations
│   │   │   ├── order.py              # Cart pricing, statutory tax math, queue number
│   │   │   ├── pos.py                # POS payload builder, HTTP client, retry logic
│   │   │   ├── queue.py              # Fairness-bounded priority insertion & status
│   │   │   ├── recommendation.py     # Indexed rule retrieval & cart matching
│   │   │   └── session.py            # Session lifecycle & priority status transitions
│   │   └── websocket/                # WebSocket Real-Time Infrastructure
│   │       ├── events.py             # Event serializer helpers
│   │       └── manager.py            # In-memory connection pool manager
│   ├── jobs/                         # Standalone Batch Jobs
│   │   └── apriori.py                # Nightly Apriori rule generation script
│   └── seeds/                        # Database Seeding Framework
│       ├── analytics.py              # Historical confusion events seeder
│       ├── history.py                # Historical transactions & orders seeder
│       ├── menu.py                   # Real Shaxian menu items & categories seeder
│       ├── rules.py                  # Initial Apriori association rules seeder
│       ├── run.py                    # Master seed execution runner
│       ├── staff.py                  # Demo staff & admin accounts seeder
│       └── tables.py                 # Dining tables seeder
│
├── frontend/                         # React 18 + Vite SPA Frontend
│   ├── index.html                    # Application HTML shell
│   ├── package.json                  # Frontend dependencies and scripts
│   ├── vite.config.js                # Vite build and proxy configuration
│   ├── public/                       # Static Assets
│   │   ├── fonts/                    # Self-hosted InterVariable.woff2
│   │   ├── icons/                    # App icons & favicon
│   │   ├── logos/                    # Restaurant chop logo
│   │   └── menu/                     # Compressed WebP menu item photos
│   └── src/                          # Frontend Source Code
│       ├── App.jsx                   # Master routing configuration
│       ├── index.css                 # Global CSS entrypoint importing layers
│       ├── main.jsx                  # React DOM mounting & i18n initialization
│       ├── api/                      # Client HTTP Service Wrappers (fetch client)
│       │   ├── analytics.js          # Analytics & verification endpoints
│       │   ├── auth.js               # Login & session check endpoints
│       │   ├── client.js             # Base fetch wrapper with error handling
│       │   ├── menu.js               # Categories & items API calls
│       │   ├── orders.js             # Quote & order placement API calls
│       │   ├── pos.js                # POS bridge status & transmission API calls
│       │   ├── queue.js              # Kitchen queue status & payment API calls
│       │   ├── recommendations.js    # Recommendation & telemetry API calls
│       │   ├── sessions.js           # Session open & declaration API calls
│       │   └── transactions.js       # Transaction list API calls
│       ├── components/               # React UI Component Hierarchy
│       │   ├── admin/                # Admin Console Specific Components
│       │   │   ├── CategoryTile.jsx  # Category grid display card
│       │   │   ├── MenuItemModal.jsx # Menu item create/edit modal form
│       │   │   ├── MenuTile.jsx      # Menu item grid card
│       │   │   ├── PriorityMixChart  # Priority vs standard distribution chart
│       │   │   ├── RegisterReceipt   # Simulated POS receipt paper view
│       │   │   ├── SalesTrendChart   # Daily sales revenue line chart
│       │   │   ├── SegmentMixChart   # Standard / Priority / Group pie chart
│       │   │   └── TopItemsChart.jsx # Highest volume dish bar chart
│       │   ├── customer/             # Customer Phone Specific Components
│       │   │   ├── BottomBar.jsx     # Fixed bottom mobile nav (Menu, Cart, Status)
│       │   │   ├── GroupBanner.jsx   # Banner indicating shared table group mode
│       │   │   ├── ItemDetailSheet   # Sliding bottom sheet for dish nutrition/allergens
│       │   │   ├── LanguageSwitch    # Trilingual locale selector dropdown
│       │   │   ├── MenuItemCard.jsx  # Full-width menu dish card with image & add button
│       │   │   ├── NavHighlight.jsx  # Frustration navigation pulse highlight box
│       │   │   ├── PriorityDeclaration # Senior/PWD/Pregnant modal selector
│       │   │   ├── RecommendationOverlay # Apriori bottom sheet suggestion overlay
│       │   │   └── SearchOverlay.jsx # Client-side real-time menu search modal
│       │   ├── shared/               # Universal Reusable Design System Atoms
│       │   │   ├── AppShell.jsx      # Admin/staff desktop header & navbar shell
│       │   │   ├── Badge.jsx         # Status pill badge (the only rounded element)
│       │   │   ├── Button.jsx        # Standard sharp action button
│       │   │   ├── Card.jsx          # Borderless panel container
│       │   │   ├── DataTable.jsx     # Borderless responsive tabular data grid
│       │   │   ├── IconButton.jsx    # Accessible icon action button (view, edit, delete)
│       │   │   ├── KpiCard.jsx       # Analytics KPI card with metric watermark
│       │   │   ├── Modal.jsx         # Accessible modal dialog (no X, Esc/backdrop dismiss)
│       │   │   ├── Navbar.jsx        # Navigation bar with red seal-square active bar
│       │   │   ├── Pagination.jsx    # Table page controls
│       │   │   ├── QtyStepper.jsx    # Quantity stepper (- [qty] +)
│       │   │   ├── SelectField.jsx   # Standardized form dropdown select
│       │   │   ├── TextInput.jsx     # Sanitized text input with character limit
│       │   │   ├── Toast.jsx         # Individual floating notification
│       │   │   ├── ToastRegion.jsx   # Top-right / bottom-center toast viewport container
│       │   │   └── ViewToggle.jsx    # Grid tile vs table list view switch
│       │   └── staff/                # Kitchen & Counter Staff Specific Components
│       │       ├── CashierConfirmModal # Payment collection & ID verification dialog
│       │       ├── QueueHero.jsx     # Large active ticket view with advance controls
│       │       └── QueueList.jsx     # Active kitchen queue ticket list
│       ├── hooks/                    # Custom React Hooks (Confusion, Guidance, WS)
│       ├── lib/                      # Shared Frontend Utilities
│       │   ├── chartTheme.js         # Color ramps & configuration for Recharts
│       │   ├── confusionConfig.js    # Numerical thresholds for confusion detection
│       │   ├── format.js             # Currency formatting (₱) and queue numbers (Q-001)
│       │   ├── i18n.js               # react-i18next setup and configuration
│       │   ├── inputClasses.js       # Client-side input filter regular expressions
│       │   └── menuImage.js          # Helper resolving public menu image URLs
│       ├── locales/                  # Trilingual Translation Dictionaries
│       │   ├── en.json               # English UI translations
│       │   ├── fil.json              # Filipino (Tagalog) UI translations
│       │   └── bis.json              # Bisaya (Cebuano) UI translations
│       ├── pages/                    # Routed Page Views
│       │   ├── admin/                # Admin Console Screens
│       │   │   ├── CategoriesPage    # Menu category list & CRUD
│       │   │   ├── DashboardPage     # Sales metrics, KPIs, Apriori manual runner
│       │   │   ├── MenuPage.jsx      # Menu items list & CRUD
│       │   │   ├── PosPage.jsx       # POS integration bridge & transmission log
│       │   │   ├── TransactionsPage  # Audited transaction records & tax breakdowns
│       │   │   └── VerificationsPage # Senior/PWD ID verification compliance log
│       │   ├── customer/             # Customer Phone Screens
│       │   │   ├── CartPage.jsx      # Current shopping cart review & quantity edit
│       │   │   ├── CheckoutPage.jsx  # Cart summary, statutory tax quote, place order
│       │   │   ├── CustomerMenuPage  # Menu browsing & category tabs
│       │   │   ├── CustomerShell.jsx # Common layout wrapping customer screens
│       │   │   ├── ReceiptPage.jsx   # Post-checkout receipt with rolling queue number
│       │   │   ├── SplitBillPage.jsx # Group bill breakdown by participating device
│       │   │   ├── StatusPage.jsx    # Live WebSocket-driven order timeline stepper
│       │   │   └── TableEntryPage.jsx# Initial landing page when QR is scanned
│       │   ├── dev/                  # Developer Showcase
│       │   │   └── AtomsPage.jsx     # Design system catalog rendering all atom variants
│       │   └── staff/                # Staff Terminal Screens
│       │       ├── LoginPage.jsx     # Staff and admin login portal
│       │       ├── QueuePage.jsx     # Live kitchen queue display & order advancement
│       │       └── SignedInPage.jsx  # Staff account details & logout
│       ├── routes/                   # Route Guards
│       │   └── ProtectedRoute.jsx    # Role-based route guard checking auth cookie
│       ├── store/                    # Zustand Stores
│       └── styles/                   # Modular CSS Architecture
│           ├── accessibility.css     # data-ui-mode="accessible" scaling overrides
│           ├── badges.css            # Pill status badge styling
│           ├── base.css              # Design tokens (colors, fonts, spacing, shadows)
│           ├── buttons.css           # Button variants (ink primary, secondary, danger)
│           ├── cards.css             # Sharp borderless panel styling
│           ├── forms.css             # Input fields, select dropdowns, labels
│           ├── layout.css            # Grid and flex layout helpers
│           ├── overlays.css          # Modal dialogs, bottom sheets, toasts
│           ├── tables.css            # Data tables with zebra striping
│           └── screens/              # Screen-specific style sheets
│               ├── admin.css         # Admin console styling
│               ├── atoms.css         # Dev atoms catalog styling
│               ├── auth.css          # Login screen styling
│               ├── customer.css      # Mobile phone customer styling
│               ├── dashboard.css     # Admin analytics dashboard charts styling
│               └── queue.css         # Staff kitchen queue terminal styling
│
├── tasks/                            # Formal Specification Documents (Documentation Only)
│   ├── Algorithms.md                 # Detailed mathematical formulas & invariants
│   ├── CodeStructure.md              # Folder structure & naming rules
│   ├── Database.md                   # Authoritative database schema definition
│   ├── Instructions.md               # Scope limiter & acceptance testing criteria
│   ├── ProjectOverview.md            # Research motivation, domain rules, & scope
│   ├── Security.md                   # Security model, DPA compliance, validation
│   └── UIDesign.md                   # Visual design system & HCI principles
│
└── docs/                             # Academic & Capstone Presentation Documentation
    ├── data-dictionary.md            # Live introspected database dictionary
    ├── demo-script.md                # 15-minute defense presentation walkthrough
    ├── gen_data_dictionary.py        # Database introspection script
    ├── paper-corrections.md          # Research paper corrections log
    └── rubrics.md                    # Capstone scoring rubric breakdown
```

---

## 16. Seeding, Batch Jobs & Operational Runbook

### 16.1 Initial Environment Setup
```bash
# 1. PostgreSQL Database & User Initialization (Execute in psql)
CREATE DATABASE shaxian_ordering;
CREATE USER shaxian_app WITH PASSWORD 'your_password_here';
GRANT ALL ON DATABASE shaxian_ordering TO shaxian_app;

# 2. Environment Configuration
cp .env.example .env
# Fill DATABASE_URL and generate SECRET_KEY:
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 16.2 Backend Build & Database Migration
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run migrations and seed data
alembic upgrade head
python -m seeds.run

# Run the Apriori batch mining job
python -m jobs.apriori

# Start FastAPI backend
uvicorn app.main:app --reload --port 8001
```

### 16.3 Rebuilding From Scratch
To drop the entire schema and rebuild demo data cleanly:
```bash
alembic downgrade base && alembic upgrade head && python -m seeds.run && python -m jobs.apriori
```

### 16.4 Frontend Execution
```bash
cd frontend
npm install
npm run dev  # Starts Vite dev server at http://localhost:5173
```
*Live Walkthrough Dwell Override:*
```bash
# Lowers dwell threshold from 45s to 3s for quick presentation testing
VITE_DWELL_THRESHOLD_SEC=3 npm run dev
```

### 16.5 Pre-Seeded Default Accounts & Table Tokens
- **Admin Account:** Username: `admin` | Password: `admin-demo-2026`
- **Service Crew Account:** Username: `crew1` | Password: `crew1-demo-2026`
- **Tables:** Seeded with 6 dining tables (`TBL-0001` through `TBL-0006`). Scannable URLs are output to the console during `python -m seeds.run` in the format: `http://localhost:5173/t/<qr_token>`.

---

## 17. The 18-Step Acceptance Test Walkthrough (`Instructions.md` §3)

The system build is verified complete when all 18 sequential steps execute flawlessly without error:

1. **Admin Login:** Navigate to `/admin/login`. Incorrect password shows specific red error toast. Correct credentials log in smoothly.
2. **Create Menu Item:** Create a new dish with English/Filipino/Bisaya names and price. Dish immediately appears in menu list.
3. **Persistence Verification:** **Refresh the browser.** Dish remains present (persisted in PostgreSQL, not ephemeral React state).
4. **Edit Price:** Change dish price. Price update persists after reload.
5. **Input Prevention (Numbers):** Type alphabetic characters into the price field. Input is completely ignored at the keyboard.
6. **Input Prevention (Length):** Type past the dish name field's maximum character limit. Keystrokes are ignored.
7. **Modal Confirmation & Delete:** Delete dish. Confirmation modal appears with no 'X' button. Esc key closes dialog. Confirming deletion removes item and displays green success toast.
8. **Error Handling Toast:** Attempt to trigger duplicate category or item name. A red toast appears top-right and **persists without auto-dismissing**.
9. **Customer QR Entry:** Open `/t/{qr_token}` in mobile viewport. Menu loads live from PostgreSQL.
10. **Trilingual Switching:** Toggle language to Bisaya (`bis`). All UI labels and menu dish titles dynamically switch to Bisaya.
11. **Priority Self-Declaration:** Tap **Priority Assistance** $\to$ select **Senior Citizen**. UI instantly switches to accessible mode (20px type, single column, 60px tap targets).
12. **Cart Management:** Add dishes to cart. Adjust quantities; subtotals calculate accurately.
13. **Confusion Detection & Apriori Recommendations:** Linger on a menu dish for 45s (or 3s with demo flag) and navigate back 3 times. Apriori recommendation bottom-sheet overlay appears with suggestions tailored to the `priority` segment.
14. **Checkout & Quotation (Dual Payment Flow):** Proceed to checkout. Screen displays live quote with 20% statutory discount and VAT exemption.
    - *Option A (Pay at Cashier):* Choose **Pay at cashier**. Digital receipt appears immediately with daily rolling queue number (e.g., `Q-001`) with payment status `pending`.
    - *Option B (Pay Online via PayMongo):* Choose **Pay Online (GCash / Card)**. The diner is seamlessly redirected to PayMongo's secure payment checkout. After completing payment (or test authorization), PayMongo redirects back to `/t/{qr_token}/receipt?verify=1&device={device_token}`. The receipt page actively verifies the settlement, confirms the paid status with a green toast, and preserves device identity without bumping `device_count` or spawning phantom devices.
15. **Kitchen Arrival:** Log into `/staff/queue` as service crew. Customer's order is in the queue, badged with priority, positioned ahead of standard orders.
16. **Live Real-Time Status Push:** Mark ticket **Preparing**. **The customer's phone updates its timeline stepper instantly over WebSocket without a browser refresh.**
17. **Order Completion & Cash Settlement:** Mark ticket **Ready**, then **Completed**. Click ticket and confirm cash payment. Order is marked paid and automatically transmits to the POS bridge.
18. **Admin Transaction & Audit Review:** In Admin console, navigate to `/admin/transactions` and `/admin/pos`. Transaction appears with balanced VAT-exempt sales and discount columns, and transmission log shows POS acknowledgment.

---

## 18. Critical Anti-Patterns & What NOT to Build

Any engineer or AI agent working on this codebase must adhere strictly to these constraints:

1. ❌ **NEVER Add Biometrics or Cameras:** Do not introduce OpenCV, computer vision models, camera access, or automated age/gender detection. Priority status is 100% voluntary self-declaration under the Data Privacy Act of 2012.
2. ❌ **NEVER Re-introduce SQLite:** Disregard any stale paper references to `ordering.db` or SQLite 3.x. The database is strictly server-based PostgreSQL 15+.
3. ❌ **NEVER Allow Client-Side Pricing:** Never accept prices, discounts, or subtotals sent from the frontend. The server prices orders independently from `menu_items` at quote and checkout time.
4. ❌ **NEVER Use Floating Point for Money:** Never use Python `float` or PostgreSQL `FLOAT`/`REAL` for currency. Always use `decimal.Decimal` and `NUMERIC(p,s)` with `ROUND_HALF_UP` per-line rounding.
5. ❌ **NEVER Use Naive Senior Discount Math:** Never calculate senior discount as `gross * 0.80`. VAT must be stripped first (`gross / 1.12`), and the 20% discount taken against the VAT-exempt base.
6. ❌ **NEVER Move the Queue Starvation Counter to Priority Orders:** The column `priority_skips_used` belongs strictly to the *standard order being skipped*, defending standard diners against starvation.
7. ❌ **NEVER Use Brand Red as Button Backgrounds:** Brand red (`#B32821`) is reserved for brand identity marks, active indicators, and headings. Primary action buttons are solid ink black (`#1A1A1A`).
8. ❌ **NEVER Add Rounded Corners or Box Shadows to Cards:** The design system is flat, sharp-cornered (`--radius: 0`), and borderless. Status badges are the only rounded pills on screen.
9. ❌ **NEVER Use Hardcoded Mock Arrays in Frontend Components:** All data rendered on screen must originate from PostgreSQL via authenticated REST/WebSocket endpoints. No fake demo JSON files.
