# Instructions.md

**Status:** TEMPORARY — governs the current build stage only
**Goal:** A working demo prototype with a real, persisting PostgreSQL database
**Audience for the result:** A capstone professor watching a live walkthrough

---

## 1. What this file is

The other five files describe the **complete finished system**. This file says how much of it to build **right now**.

**This file wins on scope. Always.** When `ProjectOverview.md` describes thirteen modules and this file authorizes six, build six. When `Database.md` specifies a nightly Apriori batch job and this file says seed the rules instead, seed them. The other files are never a work order — this one is.

Anything not listed as in-scope below is out of scope. Do not build ahead. Do not add features because they seem like a natural next step.

When this stage is finished, this file gets replaced or deleted, and the other five — untouched — describe the full build.

---

## 2. The goal in one paragraph

A professor sits down and walks through the system. An admin logs in, creates a menu item, refreshes the browser, and the item is still there — because it is in PostgreSQL, not in React state. A customer opens a table's URL, browses a real menu served from that database, switches the interface to Bisaya, declares senior status and watches the type enlarge, hesitates over the menu and gets a recommendation pulled from a real rules table, places an order, and sees a queue number. A staff member sees that order arrive, marked priority, ahead of the standard orders. They mark it preparing, and the customer's phone updates without a refresh.

Everything in that paragraph must actually work. Nothing beyond it needs to.

---

## 3. The demo script — this is the acceptance test

The build is done when every step below works, in order, without a crash, a console error, or a manual database fix.

**Admin**
1. Log in as an admin. Wrong password is rejected with a specific message.
2. Create a menu item. It appears in the list.
3. **Refresh the browser. The item is still there.**
4. Edit its price. The change persists.
5. Type a letter into the price field — nothing happens.
6. Type past the name field's limit — nothing happens.
7. Delete the item. A confirmation modal appears with no X button; Esc closes it; the delete succeeds and a green toast confirms.
8. Trigger an error (duplicate item name). A red toast appears top-right and does not disappear on its own.

**Customer**
9. Open `/t/{qr_token}` for a seeded table. The menu loads from the database.
10. Switch to Bisaya. Interface strings and menu item names both change.
11. Declare senior status. The interface switches to accessible mode — larger type, single column.
12. Add items to the cart. Quantities adjust; totals compute.
13. Linger on one item past 45 seconds and navigate back three times. The recommendation overlay appears with items pulled from `apriori_rules`, scoped to the priority segment.
14. Check out with "Pay at cashier". A queue number appears.

**Staff**
15. Log in as service crew. The new order is in the queue, badged as priority, positioned ahead of standard orders.
16. Mark it preparing. **The customer's screen updates without a refresh.**
17. Mark it ready, then completed.

**Back to admin**
18. The transaction appears in the transaction list with correct VAT and discount columns.

Eighteen steps. If one fails, the build is not done.

---

## 4. Build order

Sequential. Finish and verify each phase before starting the next. Do not work on two phases at once.

### Phase 1 — Foundation
- Repository scaffold exactly per `CodeStructure.md` §1, §3, §4
- PostgreSQL running locally — **no Docker at this stage**
- SQLAlchemy models for **all 14 tables** in `Database.md`
- One Alembic migration creating the full schema, enums, sequences, and indexes
- Seed script per `Database.md` §8

**Verify:** `alembic upgrade head` builds the schema from empty; the seeded menu is queryable from psql.

### Phase 2 — Design system
- `base.css` tokens, all atom stylesheets, `accessibility.css`, `index.css` manifest — per `UIDesign.md` and `CodeStructure.md` §5
- Shared components: `Button`, `IconButton`, `DataTable`, `Card`, `KpiCard`, `TextInput`, `SelectField`, `QtyStepper`, `Modal`, `Toast`, `Badge`, `Navbar`
- One internal page rendering every atom in every variant

**Verify:** that page passes the `UIDesign.md` §19 anti-slop checklist. Toggling `data-ui-mode="accessible"` on `<html>` rescales everything with no other change.

### Phase 3 — Auth and shell
- Staff login, JWT in an httpOnly `SameSite=Strict` cookie
- Role guards at the service layer — `service_crew` and `admin`
- Navbar shell, route groups, protected routes

**Verify:** an admin route returns 403 for a service crew token.

### Phase 4 — Admin: menu management
**This is the phase that proves the database is real. Build it carefully.**
- Category CRUD, menu item CRUD
- Full validation per `Security.md` §2 — input classes, exact max lengths, numeric bounds
- Toasts per `Security.md` §4
- Transaction list, read-only

**Verify:** demo steps 1–8.

### Phase 5 — Customer: ordering
- `/t/{qr_token}` opens a session bound to that table
- Menu browsing, category tabs, cart, quantity adjustment
- Priority self-declaration → accessible mode, `session_type` written correctly
- Language switching across all three locales
- Checkout: cashier path fully; online path simulated
- Server-side pricing and discount computation per `Security.md` §6.2
- Digital receipt with queue number

**Verify:** demo steps 9–12 and 14.

### Phase 6 — Staff: queue and live status
- Order list and kitchen queue
- Priority placement with the `priority_skips_used` cap enforced
- Status updates: pending → preparing → ready → completed
- Cashier payment confirmation
- WebSocket push to the customer's device on status change

**Verify:** demo steps 15–17.

### Phase 7 — Recommendations
- `useConfusionSignals` hook tracking all four signals
- Trigger on **any two firing concurrently**
- `POST /api/v1/recommendations` querying `apriori_rules`, scoped to the session's `session_type`, matching the cart antecedent, top 3 by lift
- Overlay per `UIDesign.md` §16

**Verify:** demo step 13. A priority session and a standard session with the same cart return **different** suggestions.

### Phase 8 — Verification pass
- Walk all 18 demo steps end to end, twice
- Run the `UIDesign.md` §19 and `Security.md` §11 checklists
- Verify accessible mode across every screen
- Verify all three languages render without overflow

---

## 5. In scope

| Area | What to build |
|---|---|
| **Database** | All 14 tables, real migrations, real persistence, seed data |
| **Admin** | Login, category CRUD, menu item CRUD, transaction list |
| **Customer** | QR session, menu, cart, checkout, receipt, status tracking |
| **Staff** | Order queue, priority placement, status updates, cashier confirmation |
| **Accessibility** | Self-declaration, accessible mode, all three languages |
| **Recommendations** | Confusion detection, real query against seeded rules |
| **Real-time** | WebSocket status push, simplest working version |
| **Validation** | `Security.md` §1–§2 in full |
| **Errors and toasts** | `Security.md` §3–§4 in full |
| **Auth** | JWT httpOnly cookie, role guards at the service layer |
| **Data protection** | Server-side pricing, bcrypt, `id_last4`, server-side masking |

---

## 6. Out of scope

Do not build these. Do not scaffold placeholders for them. Do not mention them in the UI.

| Area | Why it waits |
|---|---|
| **Nightly Apriori batch job** | Rules are seeded. The retrieval path is real, so adding the job later is purely additive |
| **mlxtend** | Not needed until the batch job exists. Do not install it |
| **Wait-time estimator / XGBoost** | Not in the current paper draft |
| **POS integration** | The partner restaurant's POS schema is undocumented. Nothing to integrate against |
| **PayMongo** | No sandbox credentials. Online payment shows a simulated success screen |
| **Split billing** | Group *joining* is in scope because it drives the `group` segment. Splitting the bill is not — one payment per transaction |
| **Optional customer accounts** | No `customers` table exists. Returning-customer history is out |
| **Rate limiting, lockout, CSRF tokens** | `SameSite=Strict` covers the prototype. `Security.md` §7 waits |
| **Deployment hardening** | `Security.md` §8 is a deployment concern |
| **Docker, Docker Compose, Nginx** | This runs on one laptop for one demo. Containers add a build cycle and a debugging layer for reproducibility that is not needed yet. `CodeStructure.md` §7 waits for actual deployment |
| **Backups, retention jobs, breach plan** | `Security.md` §7.4, §9.3, §9.6 |
| **Tests** | Structure exists per `CodeStructure.md` §9. Writing them is a later stage |
| **TLS** | Plain HTTP on localhost. Cookies drop the `Secure` flag for now — and only for now |

---

## 7. How to read the other five files

| File | Read | Skip |
|---|---|---|
| `ProjectOverview.md` | All of it. Especially §5 and §6 | The §4 module table lists 13 modules — build only the six in §5 above |
| `Database.md` | All of it. Build the whole schema | §12.1 open items stay open |
| `CodeStructure.md` | All of it. Follow layering and CSS rules exactly | §7 Docker — not this stage. §9 testing — structure only, no tests |
| `UIDesign.md` | All of it. §19 is a gate. §13 governs the admin dashboard charts | §16 customer UI is directional; screens are yours to compose |
| `Security.md` | §1–§4 and §5.3, §5.6, §5.7, §6.2 in full | §7 availability, §8 deployment, §9.3–§9.6 |
| `Algorithms.md` | §4 and §5 before Phase 5. §2 before Phase 6. §3 before Phase 7 | Nothing — but do not implement ahead of the phase |

**The schema is built in full even though the features are not.** A partial schema means a migration later; a full schema means the tables are simply sitting there when their feature arrives. Build all 14.

---

## 8. Rules while building

**Real data, seeded — never faked.** Every value on screen comes from PostgreSQL through the API. No hardcoded arrays in components, no mock JSON files, no `if (isDemo)` branches. Seeded data is real data.

**Stub at the boundary, not in the middle.** Where something is out of scope, the seam is a single clearly-named function that returns a fixed value. Online payment is one function returning success. It is not a fake payment flow threaded through five components.

**Do not scaffold what you are not building.** No empty `services/pos.py`, no commented-out routes, no TODO placeholders. An empty file is a lie about the system's state.

**Follow the conventions exactly.** Backend comments are single words. The frontend has none. Layering rules hold. The CSS layers hold. A prototype that ignores conventions has to be rewritten, not extended.

**Stop and ask when a file is silent.** The five specification files have open-items sections for a reason. Do not invent a column, an endpoint, or a color.

---

## 9. Definition of done

- [ ] All 18 demo steps pass, twice, without intervention
- [ ] Backend and frontend both start from a documented command in `README.md`
- [ ] Data survives a backend restart
- [ ] `alembic downgrade base` then `upgrade head` rebuilds the schema cleanly
- [ ] Every screen renders correctly in accessible mode
- [ ] All three languages render without overflow
- [ ] `UIDesign.md` §19 checklist passes
- [ ] `Security.md` §11 checklist passes for the in-scope sections
- [ ] No console errors
- [ ] No hardcoded data anywhere in the frontend
- [ ] Seed script rebuilds the demo state from empty

---

## 10. Confirmation required before proceeding

Reply confirming the following, then stop and wait.

1. **Do you understand that this file overrides the other five on scope**, and that a feature described elsewhere but absent here must not be built?

2. **Do you understand the goal** — a real PostgreSQL database with genuine persistence, demonstrated live, rather than a feature-complete system?

3. **Do you understand that the 18-step demo script in §3 is the acceptance test**, and that the build is not done until every step passes?

4. **Do you understand the eight phases are sequential**, and that each is verified before the next begins?

5. **Do you understand what is stubbed and what is real** — that the Apriori *retrieval path* is real and queries a real seeded table, while only the nightly *batch job* is missing?

6. **Do you understand that all 14 tables are built** even though only some features exist?

7. **Do you understand the no-fake-data rule** — everything on screen comes from PostgreSQL through the API, with no hardcoded arrays and no demo branches?

8. **Do you have any questions** about scope, or anything unclear in the other five files?

Answer these explicitly, list any questions, and **wait for a human reply before writing any code.**
