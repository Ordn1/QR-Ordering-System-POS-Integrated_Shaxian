# Security.md

**System:** QR-Based Table Ordering System
**Scope:** Input validation · error handling and notifications · application and deployment security · data protection · privacy compliance
**Governing law:** Republic Act No. 10173 (Data Privacy Act of 2012) · RA 9994 · RA 10754
**Document role:** The authoritative definition of how the system validates input, reports failure, protects data, and handles personal information

---

## 0. STOP — Read this before doing anything

**Do not write validators, middleware, auth logic, or notification components after reading this document.**

This file specifies the **complete finished security model**. It is written at full fidelity so it never needs rewriting.

**It is not a work order.** How much of this you may build right now is defined **exclusively** in `Instructions.md`. If that file authorizes a subset, build only that subset. `Instructions.md` always wins on scope.

Read `ProjectOverview.md`, `Database.md`, `CodeStructure.md`, and `UIDesign.md` first. Then Section 18 of this document.

**One note on deferral.** This file was originally planned as optional for the prototype. It is not. Part 1 governs every form the prototype ships, and §5 changes the database schema. Part 2 may be deferred; Part 1 and §5 may not.

---

# PART 1 — Input, Errors, and Notifications

---

## 1. Validation philosophy

**Prevent, then validate, then report.** Three layers, three distinct behaviors, in this order:

| Layer | When | Behavior |
|---|---|---|
| **Prevention** | Keypress | Invalid input never enters the field. No message — nothing went wrong |
| **Validation** | Blur | Format and completeness checked. Inline message under the field |
| **Verification** | Submit | Server-side rules — uniqueness, references, permissions. Toast |

The first layer does the most work. A field that cannot accept a letter never needs to explain that letters are not allowed.

**Every rule is enforced twice.** Client-side validation is a convenience for the user. Server-side validation is the actual security boundary. **Never trust the client** — a request reaching the API is assumed hostile regardless of what the form allowed.

---

## 2. Field-level rules

### 2.1 Input classes

| Class | Accepts | Rejects |
|---|---|---|
| `alpha` | Letters, spaces, hyphen, apostrophe | Digits, symbols, emoji |
| `alphanumeric` | Letters, digits, space | Symbols, emoji |
| `numeric` | Digits only | Everything else |
| `decimal` | Digits, one decimal point | Everything else |
| `currency` | Digits, one decimal point, max 2 places | Everything else |
| `identifier` | Uppercase letters, digits, hyphen | Lowercase, spaces, symbols |
| `freetext` | Printable characters | Control characters, emoji, zero-width characters |

**Emoji and zero-width characters are rejected in every class, including `freetext`.** They break column widths, corrupt receipt printing, and are a known vector for homograph and injection attacks. Strip at the input boundary and reject server-side.

### 2.2 Length must match the database exactly

**Every input's `maxlength` equals its column's length in `Database.md`. No exceptions, no rounding.**

| Field | Column | Class | Max |
|---|---|---|---|
| Category name (en/fil/bis) | `categories.name_*` | `alpha` | 40 |
| Item name (en/fil/bis) | `menu_items.name_*` | `alphanumeric` | 60 |
| Item description | `menu_items.description_*` | `freetext` | 160 |
| Price | `menu_items.price` | `currency` | 8,2 |
| Calories | `menu_items.calories` | `numeric` | 0–32767 |
| Allergens | `menu_items.allergens` | `freetext` | 120 |
| Image filename | `menu_items.image_filename` | `freetext` | 80 |
| Username | `staff_accounts.username` | `alphanumeric` | 30 |
| Full name | `staff_accounts.full_name` | `alpha` | 80 |
| Table number | `tables.table_number` | `numeric` | 1–32767 |
| Display name | `session_devices.display_name` | `alphanumeric` | 30 |
| Void reason | `transactions.void_reason` | `freetext` | 120 |
| Cardholder name | `priority_verification_log.cardholder_name` | `alpha` | 80 |
| ID fragment | `priority_verification_log.id_last4` | `numeric` | 4 |
| Issuing LGU | `priority_verification_log.issuing_lgu` | `alpha` | 50 |

**Typing past the limit does nothing.** No truncation on save, no silent trimming, no "too long" error. The keystroke is simply not accepted. A character counter appears at 80% of the limit.

Length is enforced in three places: the input's `maxlength`, the Pydantic schema's `max_length`, and the column definition. All three agree or one of them is a bug.

### 2.3 Numeric bounds

Numeric fields carry `min` and `max` matching their column's range and business meaning. Price cannot be negative. Quantity cannot be zero. Calories cannot exceed `SMALLINT`.

Currency inputs accept at most two decimal places and reject a third keystroke.

### 2.4 Server-side enforcement

Pydantic schemas mirror every client rule:

```python
name_en: constr(strip_whitespace=True, min_length=1, max_length=60, pattern=r'^[A-Za-z0-9 \-\'À-ÿ]+$')
price: condecimal(max_digits=8, decimal_places=2, ge=0)
```

Requests failing schema validation return `422` with a field-level error map. The client renders these as inline errors — never as a raw dump.

### 2.5 Injection defense

- **SQL injection** — SQLAlchemy parameterized queries exclusively. **Never** string-concatenate or f-string a query. Raw SQL requires bound parameters.
- **XSS** — React escapes by default. `dangerouslySetInnerHTML` is banned outright. Server responses are JSON, never HTML fragments.
- **Command injection** — no user input reaches a shell. Ever.
- **Path traversal** — `image_filename` is a filename, never a path. Reject anything containing `/`, `\`, or `..`.
- **Mass assignment** — endpoints accept explicit Pydantic schemas, never raw dicts. A client cannot set `is_admin` by adding it to a payload.

---

## 3. Error handling

### 3.1 Errors are specific

**Every error names what failed and what to do about it.** Generic errors are treated as bugs.

| Never | Always |
|---|---|
| "An error occurred" | "Table 4 already has an active session. End it before starting a new one." |
| "Invalid input" | "Price must be between ₱0.00 and ₱999,999.99." |
| "Failed to save" | "A menu item named '1pc Fried Chicken' already exists." |
| "Something went wrong" | "The kitchen display lost connection. Reconnecting…" |
| "Error 500" | "The order could not be sent to the kitchen. It has been saved — try sending again." |

Error copy follows `UIDesign.md` §18: state the cause, state the remedy, no apology, no exclamation mark, no error code shown to a customer.

### 3.2 What the user never sees

Stack traces, SQL fragments, file paths, library names, internal IDs, raw exception text. In production, an unhandled exception returns a generic message with a **correlation ID**; the detail goes to the server log under that ID.

```
"Something interrupted this action. Reference: 8F3A-2C91"
```

That is the only permissible generic error, and it always carries a reference.

### 3.3 Handler hierarchy

`core/exceptions.py` defines the domain exceptions. Each maps to a status code and a message template:

| Exception | Status | Surfaces as |
|---|---|---|
| `ValidationError` | 422 | Inline field errors |
| `NotFoundError` | 404 | Error toast |
| `ConflictError` | 409 | Error toast |
| `PermissionError` | 403 | Error toast |
| `AuthenticationError` | 401 | Redirect to login |
| `BusinessRuleError` | 400 | Error toast |
| Unhandled | 500 | Generic + correlation ID |

Services raise domain exceptions. Routers never construct `HTTPException` — the handler layer translates. This is the `CodeStructure.md` §3.2 boundary restated.

---

## 4. Notifications

Three types, one component, top-right of the viewport.

### 4.1 Anatomy

Per `UIDesign.md`: sharp corners, no outline, tinted background, saturated bold text.

```
┌──────────────────────────────────────┐
│                                      │
│   Menu item saved                    │
│                                      │
└──────────────────────────────────────┘
```

| Property | Value |
|---|---|
| Shape | Rectangle, `--radius: 0`, **no border** |
| Width | 320px fixed |
| Padding | `--space-4` |
| Text align | **Center** |
| Text | `--font-base`, weight **600** |
| Shadow | `--shadow-raised` — it floats, so it earns one |
| Anchor | Top-right of viewport |
| Offset | `--space-5` from top and right edges |
| Stack gap | `--space-3` |
| Motion | 150ms fade + 8px slide-in from right; 120ms fade out |

### 4.2 Types

| Type | Background | Text | Duration |
|---|---|---|---|
| **Success** | `--green-tint` `#E8F3EE` | `--green` `#1E7B4D` | 3s auto-dismiss |
| **Info** | `--blue-tint` `#E9EFF6` | `--blue` `#1D4E89` | 4s auto-dismiss |
| **Error** | `--danger-tint` `#F7E9E9` | `--danger` `#9B1C1C` | **Persists** |

**Errors never auto-dismiss.** An error that disappears before it is read has failed at its only job. It stays until clicked or until the user acts on the underlying problem.

### 4.3 Behavior

- **Dismiss** — click anywhere on the toast body. **No X button**, consistent with modals.
- **Stack** — maximum 3 visible. A 4th dismisses the oldest.
- **Deduplicate** — an identical message already showing resets its timer rather than stacking a copy.
- **Announce** — `role="status"` for success and info, `role="alert"` for errors, so screen readers speak them.

### 4.4 Modal-scoped toasts

An error raised by an action **inside** a modal appears **inside that modal**, anchored to its top-right — not the viewport's. A toast at the screen edge while a modal holds focus is easy to miss entirely.

| Property | Value |
|---|---|
| Anchor | Top-right **of the modal container** |
| Offset | `--space-4` from the modal's top and right edges |
| Width | 280px, and never wider than the modal minus `--space-8` |
| z-index | Above modal content, below the modal's own overlays |

**Margins are mandatory.** The toast never touches the modal edge, never overlaps the header's seal square or title, and never spills outside the modal's bounds. On a 480px modal it narrows rather than clipping.

### 4.5 Placement by surface

| Surface | Anchor |
|---|---|
| Admin console | Top-right of viewport |
| Staff terminal | Top-right of viewport |
| Inside any modal | Top-right of the modal |
| **Customer phone** | **Bottom-center**, above the bottom bar |

Top-right on a phone lands under the notch and outside thumb reach. The customer surface anchors bottom-center, full width minus `--space-4`, above the fixed bottom bar.

In accessibility mode, toasts inherit enlarged tokens and errors persist regardless of type.

---

# PART 2 — Security and Privacy

Organized around the **CIA triad**: keeping data secret, keeping it correct, keeping it available.

---

## 5. Confidentiality

### 5.1 Data classification

Every column is classified. Treatment follows classification, not intuition.

| Class | Definition | Examples |
|---|---|---|
| **Public** | Safe to display to anyone | Menu items, prices, categories, table numbers |
| **Internal** | Staff-only, not personal | Transactions, queue state, analytics |
| **Confidential** | Security-sensitive; exposure enables attack | `qr_token`, `device_token`, `aggregator_ref` |
| **Personal** | Identifies a person; DPA-regulated | `cardholder_name`, ID fragment, `issuing_lgu` |
| **Secret** | Never recoverable, never displayed | `password_hash` |

### 5.2 Treatment per field

Three distinct mechanisms, chosen by whether the value must ever be read back:

| Field | Treatment | Rationale |
|---|---|---|
| `staff_accounts.password_hash` | **Hashed** — bcrypt, cost 12 | One-way. Never displayed, returned, or logged |
| `priority_verification_log.id_last4` | **Stored as fragment only** | See §5.3 — the full number is never captured |
| `priority_verification_log.cardholder_name` | **Masked in UI** — `J••• D•••` | Plaintext at rest; staff-only endpoints |
| `priority_verification_log.issuing_lgu` | Plaintext | Not identifying alone |
| `payments.aggregator_ref` | **Masked in UI** — last 6 | Low sensitivity, needed for reconciliation |
| `tables.qr_token` | Plaintext at rest, **never on a customer endpoint** | Security token |
| `session_devices.device_token` | Plaintext, returned only to the owning device | Session handle |

**Hashing and masking are not interchangeable.** Hashing is one-way and destroys the value — correct for passwords, wrong for anything that must be read back. Masking hides a value at display time while preserving it in storage.

### 5.3 Data minimization — the ID number

**The system does not store senior citizen or PWD ID numbers.**

The earlier design captured the full `id_number`. It is replaced by `id_last4` — a four-digit fragment.

The reasoning is a security principle, not a convenience: **data not collected cannot be breached.** The compliance record's actual job is to prove a discount was applied against a verified declaration. That requires knowing *that* an ID was presented, *who* verified it, *when*, and *enough* to distinguish one declaration from another. It does not require the full number.

This eliminates the highest-risk column in the schema outright, and it satisfies the DPA's data minimization principle directly — collect only what the declared purpose needs.

⚠️ **This changes `Database.md`.** In `priority_verification_log`, replace:

```
id_number  VARCHAR(30)  NULL
```

with:

```
id_last4   CHAR(4)      NULL   CHECK (id_last4 ~ '^[0-9]{4}$')
```

Apply this as an addendum to `Database.md` §6.8.

### 5.4 Masking rules

Masking happens **server-side**, in the response schema. **A masked value is never sent to the client in full and then hidden with CSS** — the browser would still hold it, and it would appear in devtools, in the network tab, and in any client-side log.

| Type | Pattern | Example |
|---|---|---|
| Name | First letter of each part | `J••• D•••` |
| ID fragment | Prefix dots | `•••• 4821` |
| Payment ref | Last 6 | `••••••8F3A21` |
| Username in logs | First 2 | `ma••••••` |

Unmasked personal data is returned by exactly one endpoint, requires the `admin` role, and writes an `audit_log` entry every time it is called.

### 5.5 Frontend masking in tables

Any table column carrying **Personal** or **Confidential** data renders masked by default.

- No hover-to-reveal, no click-to-reveal in a table. Revealing requires opening the record's detail view, which is a logged action.
- Masked columns use tabular figures so the dots align down the column.
- Export and print carry the masked form unless the export is explicitly an audit export, which is admin-only and logged.

### 5.6 Authentication

| Aspect | Decision |
|---|---|
| Mechanism | **JWT in an httpOnly cookie** |
| Cookie flags | `httpOnly` · `Secure` · `SameSite=Strict` |
| Access token | 15 minutes |
| Refresh token | 7 days, rotated on use |
| Storage | **Never `localStorage` or `sessionStorage`** |
| Hashing | bcrypt, cost 12 |
| Lockout | 5 failed attempts → 15-minute lock, per username **and** per IP |
| Password policy | Minimum 12 characters; checked against a common-password list; no composition rules |

**`localStorage` is banned for tokens.** It is readable by any JavaScript on the page, which makes a single XSS a full account takeover. An httpOnly cookie is not reachable from script.

Because cookies are used, **CSRF protection is mandatory**: a double-submit token on every state-changing request, plus `SameSite=Strict`.

Minimum-12-characters with no composition rules follows current NIST guidance — forced symbol-and-digit rules produce predictable substitutions and worse passwords.

### 5.7 Authorization

Role-checked at the **service layer**, never only in the router, and never in the UI. Hiding a button is presentation, not security.

| Role | May |
|---|---|
| Customer (unauthenticated) | Own session only, scoped by `device_token` |
| `service_crew` | Queue, order status, cashier payment, priority verification |
| `admin` | Everything above, plus menu, staff, analytics, audit |

Every endpoint declares its requirement explicitly. There is no implicit-allow default — an endpoint without a stated role requirement fails closed.

**Object-level checks are separate from role checks.** A customer with a valid session may only act on *their own* session. Verifying the role without verifying ownership is the most common authorization bug in systems of this shape.

### 5.8 Customer session security

The `qr_token` is the only thing standing between a stranger and someone else's table session, and because group ordering exists, a session cannot be locked to a single device.

Joining a session requires **all** of:

1. A valid `qr_token`
2. The table's `occupancy_status` is `occupied`
3. The session is under **3 hours** old
4. The session has not been closed

Additionally:

- The **host device is notified** when a new device joins
- The host may **remove** a device from the session
- A removed device's `device_token` is revoked immediately
- `qr_token` rotates whenever a table's QR marker is reprinted

This is proportionate: it blocks the realistic attack — photographing a QR code and adding items to someone's bill — without adding friction for the four friends who actually sat down together.

### 5.9 Transport and network

- **HTTPS everywhere**, including on the LAN. A self-signed certificate on the local server is acceptable for the prototype; a proper certificate for deployment.
- **WSS**, never plain `ws://`.
- CORS allow-list is explicit. Never `*`. Never reflect the `Origin` header.
- The database listens on **localhost only** — never on the LAN interface.
- Admin routes are reachable only from the restaurant's internal network.

### 5.10 Secrets

- Every secret from the environment, read only through `config.py`
- `.env` is git-ignored; `.env.example` is committed with placeholder values
- No secret in source, in a comment, in a log, or in an error message
- `SECRET_KEY` is a minimum of 32 random bytes, unique per deployment
- Payment keys are sandbox-only. **No production payment credential ever enters this system**

---

## 6. Integrity

### 6.1 Transactional integrity

Checkout writes `transactions`, `transaction_items`, `kitchen_queue`, and `payments` in **one database transaction**. A partial checkout — an order with no queue slot, a payment with no order — is a corrupt state, not a degraded one.

Queue numbers are assigned under a lock. The `UNIQUE (queue_date, queue_number)` constraint is a backstop, not the mechanism.

### 6.2 Financial integrity

- Money is `NUMERIC`, never floating point, everywhere including in Python
- Discounts are computed **server-side only**. A client-supplied total is ignored, not validated
- The sum of a transaction's `payments` must reconcile to `net_amount` before the order is marked paid
- The four tax columns are computed together and written together

**A client never sends a price.** It sends item IDs and quantities; the server prices the order from `menu_items`. Otherwise a modified request buys a whole chicken for one peso.

### 6.3 Audit log

**A new table.** Staff actions with financial or data consequences are recorded permanently.

⚠️ **This changes `Database.md`.** Add to §6 as a transactional table:

**`audit_log`**

| Column | Type | Constraints |
|---|---|---|
| `audit_id` | `BIGINT` | PK, `GENERATED ALWAYS AS IDENTITY` |
| `staff_id` | `VARCHAR(8)` | NULL, FK → `staff_accounts` |
| `action` | `VARCHAR(40)` | NOT NULL |
| `entity_type` | `VARCHAR(40)` | NOT NULL |
| `entity_id` | `VARCHAR(20)` | NULL |
| `before_state` | `JSONB` | NULL |
| `after_state` | `JSONB` | NULL |
| `ip_address` | `INET` | NULL |
| `occurred_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()` |

```sql
CREATE INDEX idx_audit_staff_time ON audit_log (staff_id, occurred_at DESC);
CREATE INDEX idx_audit_entity     ON audit_log (entity_type, entity_id);
```

Logged actions: login success and failure, price change, menu item create/update/deactivate, staff account create/update/deactivate, transaction void, priority verification, discount application, unmasked personal-data access, any admin config change.

**`before_state` and `after_state` never contain a password hash, a token, or personal data.** They record what changed, not the sensitive values themselves.

**The audit log is append-only.** No update path, no delete path, no UI affordance to edit it. An audit trail a staff member can alter is not an audit trail.

### 6.4 Priority queue integrity

`priority_skips_used` is incremented **server-side only** and enforced against the cap in the service layer. A client cannot request priority placement — placement is derived from the session's declared status, which is itself derived from a logged declaration.

### 6.5 Logging discipline

Logged: authentication events, authorization failures, validation failures with field names, errors with correlation IDs, audited actions.

**Never logged:** passwords in any form, tokens, cookies, full request bodies from auth endpoints, personal data, payment references.

Logs are structured JSON with a correlation ID per request, so an error a user reports can be traced without exposing anything sensitive to them.

---

## 7. Availability

### 7.1 Local-first resilience

The complete browse → order → kitchen path functions with **no internet connection**. Internet is required only for the payment gateway. Uplink loss degrades to cashier payment; nothing else changes.

### 7.2 Rate limiting

| Endpoint | Limit |
|---|---|
| Login | 5 / 15 min per username and per IP |
| Session create | 10 / min per IP |
| Order placement | 5 / min per session |
| Recommendation query | 30 / min per session |
| General API | 100 / min per IP |

Limits protect availability rather than punish users. Exceeding one returns `429` with a retry hint.

### 7.3 Resource protection

- Request body capped at 1 MB
- Image upload capped at 2 MB, extension **and** magic-byte verified
- Database connection pool bounded — `pool_size=10`, `max_overflow=20`
- Query timeout 5 s; WebSocket idle timeout 30 min
- Concurrent WebSocket connections capped per session

### 7.4 Backup and recovery

- Nightly `pg_dump` to a separate physical volume, 30-day retention
- Restore tested before deployment, not after a failure
- **A backup containing personal data is encrypted at rest**
- Alembic migrations are reversible — every `downgrade()` works

### 7.5 Dependency hygiene

- `requirements.txt` and `package-lock.json` pinned to exact versions
- `pip-audit` and `npm audit` run before every deployment
- No dependency added without a stated reason

---

## 8. Deployment hardening

| Area | Requirement |
|---|---|
| Containers | Non-root user; no `latest` tags; multi-stage builds |
| Database | Localhost bind; application user is not superuser; strong generated password |
| Nginx | TLS termination; security headers; server tokens off; request size limits |
| Debug | `DEBUG=False`; FastAPI `/docs` and `/redoc` disabled in production |
| OS | Automatic security updates; firewall default-deny; SSH key-only |
| Ports | Only 80/443 exposed. Database and backend ports are never published |

### 8.1 Security headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; img-src 'self' data:;
                         style-src 'self' 'unsafe-inline' fonts.googleapis.com;
                         font-src fonts.gstatic.com; connect-src 'self' ws: wss:
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**`camera=()` is not boilerplate.** It is a machine-enforced statement of the system's core privacy commitment: this application cannot access a camera, and the browser will refuse if any code ever tries. It is `ProjectOverview.md` §6.3 expressed as policy rather than intention.

---

## 9. Privacy

### 9.1 Principles

The system's design already satisfies most of the DPA. These are the commitments that keep it that way.

**Data minimization.** Collect only what the declared purpose requires. No customer account is required to order. No email, no phone number, no address is ever collected. Priority status is a single enum value. The ID number is reduced to four digits (§5.3).

**Purpose limitation.** Data collected for ordering is used for ordering. Transaction data feeds Apriori mining in **aggregate**, never as individual profiling. Analytics events measure interface behavior, not people.

**No biometrics, architecturally.** No camera, no facial recognition, no age estimation, anywhere in the system. Enforced in three independent places: the schema has no column for it, the `Permissions-Policy` header blocks the API, and `ProjectOverview.md` §6.3 makes it a hard stop. The earlier camera-based design was abandoned deliberately.

**Anonymity by default.** A session is anchored to a table and a device token, not a person. A standard customer completes an entire order while remaining unidentified.

**Consent is explicit.** Priority status is declared by tapping a control. It is never inferred, detected, or assigned.

### 9.2 What is collected

| Data | Purpose | Retention |
|---|---|---|
| Table and session identifiers | Route the order | Session, then transaction history |
| Cart and order contents | Fulfil and bill | Indefinite — financial record |
| Declared priority status | Priority queue, statutory discount | With the transaction |
| ID fragment, cardholder name, LGU | Discount compliance | 3 years — BIR requirement |
| Interaction events | Confusion detection, interface analytics | 90 days, then aggregated |
| Device token | Split billing attribution | Session only |
| Staff credentials | Authentication | Account lifetime |

### 9.3 Retention

| Data | Period | Then |
|---|---|---|
| `analytics_events` | 90 days | Aggregate to daily counts, delete raw rows |
| `sessions`, `session_devices` | 1 year | Anonymize — drop tokens and display names |
| `transactions`, `transaction_items` | Indefinite | Financial record |
| `priority_verification_log` | 3 years | Delete — BIR retention satisfied |
| `audit_log` | 3 years | Archive |
| Backups | 30 days | Delete |

Retention runs as a scheduled job, not by hand.

### 9.4 Data subject rights

Under the DPA, a customer may request access to, correction of, or deletion of their personal data. In practice this applies almost exclusively to priority verification records, since ordinary ordering collects no identifying data at all.

- **Access** — an admin retrieves records matching a presented ID fragment and name. Logged.
- **Correction** — a verification record may be corrected by an admin. Logged, with `before_state` retained.
- **Deletion** — records past their BIR retention period may be deleted. Financial transaction records may not be deleted, but may be disassociated from the verification record.

### 9.5 Notice

A short privacy notice is reachable from the customer ordering screen — before the priority declaration control, not buried in a footer. It states in plain language:

- What is collected and why
- That no camera or biometric data is ever used
- That an ID is checked visually by staff and only four digits are recorded
- How long data is kept
- How to request access or deletion
- Who the restaurant's contact is

Written in all three languages, at the same reading level as the rest of the interface. No legal boilerplate — a notice nobody can read is not notice.

### 9.6 Breach response

The DPA requires notification to the National Privacy Commission and affected individuals within **72 hours** of discovering a breach that risks serious harm.

Minimum plan: contain, assess scope from `audit_log`, notify the NPC and affected individuals if the threshold is met, document, remediate.

---

## 10. What lives elsewhere

| Topic | File |
|---|---|
| Why the system exists; the no-biometrics rule | `ProjectOverview.md` |
| Column definitions and constraints | `Database.md` — **with the §5.3 and §6.3 addenda in this file** |
| Layer boundaries; where validators live | `CodeStructure.md` |
| Toast visual tokens; modal anatomy | `UIDesign.md` |
| **What to build right now** | **`Instructions.md`** |

---

## 11. Security checklist

Before any endpoint or form ships:

- [ ] Every input has a class, a max length matching its column, and bounds
- [ ] Emoji and zero-width characters rejected
- [ ] Every client rule mirrored in a Pydantic schema
- [ ] No string-built SQL anywhere
- [ ] No `dangerouslySetInnerHTML`
- [ ] Endpoint declares an explicit role requirement
- [ ] Object ownership verified, not just role
- [ ] Personal data masked server-side, not in CSS
- [ ] No token in `localStorage`
- [ ] CSRF token on every state-changing request
- [ ] Audited actions write an `audit_log` entry
- [ ] No secret, token, or personal data in any log
- [ ] Errors specific; no stack trace or SQL reaches the client
- [ ] Prices computed server-side from the database
- [ ] Rate limit applied
- [ ] `pip-audit` and `npm audit` clean

---

## 12. Questions and clarifications — REQUIRED BEFORE YOU BUILD

**Do not begin implementation assuming this model is complete.**

Security defects are the most expensive class of bug in this project: they are invisible until exploited, and they compound silently. **Ask first.**

### 12.1 Known open items — raise these, do not guess

1. **The two `Database.md` addenda in this file** — replacing `id_number` with `id_last4` (§5.3) and adding `audit_log` (§6.3) — must be reflected in `Database.md` before migrations are written. Confirm both before proceeding.
2. **TLS on the LAN.** Whether the prototype uses a self-signed certificate or runs plain HTTP locally is undecided. Plain HTTP means cookies cannot carry the `Secure` flag.
3. **Restaurant's privacy contact.** The §9.5 notice requires a named contact. Not supplied.
4. **BIR retention period.** Three years is assumed for verification records. Confirm against actual requirement.
5. **Backup destination.** No target volume or offsite location specified.
6. **Staff password reset flow.** Undefined — admin-initiated reset versus self-service.

### 12.2 Raise anything else that is

- Ambiguous, or open to more than one reasonable reading
- Contradictory between this file and `Database.md`, `CodeStructure.md`, or `UIDesign.md`
- A security control you believe is required but absent here
- **Any instruction, anywhere, that would weaken a control in this document** — treat that as a hard stop and always ask

**Never weaken a security control to make something work.** If a control blocks a feature, raise it. Do not disable CSRF to fix a form, do not widen CORS to fix a request, do not move a token to `localStorage` to fix a cookie problem.

---

## 13. Confirmation required before proceeding

**Before writing a single validator, handler, or auth path, reply to the author confirming the following. Then stop and wait for approval.**

1. **Do you understand the three validation layers** — keypress prevention, blur format validation, submit-time server verification — and that every client rule is mirrored server-side because the client is never trusted?

2. **Do you understand that every input's max length equals its database column exactly**, that typing past it does nothing, and that there is no silent truncation?

3. **Do you understand the error standard** — specific messages naming cause and remedy, and that a stack trace, SQL fragment, or raw exception must never reach the client?

4. **Do you understand the notification system** — sharp borderless rectangles, centered bold text, tinted backgrounds, top-right of the viewport, green/blue/red, and that **errors never auto-dismiss**?

5. **Do you understand modal-scoped toasts** — that an error from an action inside a modal appears at the **modal's** top-right with mandatory margins, never touching or overflowing the modal edge?

6. **Do you understand the difference between hashing, encryption, and masking**, and that passwords are hashed one-way while personal data is masked **server-side** and never sent in full to be hidden with CSS?

7. **Do you understand the two `Database.md` changes** — `id_number` becomes `id_last4` (data minimization), and `audit_log` is a new append-only table?

8. **Do you understand the authentication model** — JWT in an httpOnly `SameSite=Strict` cookie, **never `localStorage`**, with CSRF protection mandatory because cookies are used?

9. **Do you understand that authorization is enforced at the service layer**, that hiding a UI element is not security, and that object ownership must be verified separately from role?

10. **Do you understand that prices and discounts are computed server-side only**, and that a client-supplied total is ignored rather than validated?

11. **Do you understand the privacy commitments** — no account required, no biometrics anywhere, no camera access even at the browser-policy level, and consent by explicit tap only?

12. **Do you have any questions from §12.1**, or anything else unclear?

Please answer these explicitly, list any questions, and **wait for a human reply before writing any code.**
