# ProjectOverview.md

**Project:** A QR-Based Table Ordering System Integrating Dynamic Accessibility Modes and Apriori-Based Recommendations
**Type:** BS Information Technology capstone project
**Deployment target:** A single partner quick-service restaurant (QSR) in Davao City, Philippines
**Document role:** Entry point and single source of truth for *what this system is and why*

---

## 0. STOP — Read this before doing anything

**Do not write code, scaffold folders, install packages, or create files after reading this document.**

This file describes the system at **full fidelity** — the complete, finished system as the research paper defines it. It is deliberately written this way so it stays valid for the entire life of the project and never needs rewriting.

**It is not a description of what you are building right now.**

The amount of that system you are authorized to build in the current stage is defined **exclusively** in `Instructions.md`. That file is the scope limiter. If `Instructions.md` says to build less than what you read here, that is intentional and correct — build less. Never treat this document as a work order.

Read order:
1. `ProjectOverview.md` ← you are here (what and why)
2. `Database.md` (data model)
3. `CodeStructure.md` (how the code is organized)
4. `UIDesign.md` (what the interface looks like)
5. `Security.md` (hardening — may be deferred)
6. `Instructions.md` (**what you are actually allowed to build right now**)

After reading all six, go to Section 11 of this document and answer the confirmation prompt. **Wait for a human reply before proceeding.**

---

## 1. What this system is

A web application that lets a diner sit down at a restaurant table, scan a QR code printed on that table with their own smartphone, and complete the entire ordering and payment process from their seat — without ever standing in the counter line.

It runs on the restaurant's **local network**, served from a single on-premise machine. Customers do not need mobile data. There is no native app to install; everything runs in the phone's browser.

Three things make it more than a generic digital menu:

1. **An accessibility-adaptive interface** that reconfigures itself — larger type, simplified single-column layout, trilingual text — for senior citizens, persons with disability (PWD), and pregnant diners.
2. **A fairness-bounded priority queue** that advances those diners' orders in the kitchen sequence, honoring their legal right to priority service without starving everyone else.
3. **A confusion-triggered recommendation engine** that watches for behavioral evidence that a customer is stuck deciding, and only then surfaces suggestions mined from past transactions.

---

## 2. Why it exists — the problem being solved

This is not a hypothetical product. Every feature traces to a documented problem. Understanding *why* a feature exists will keep you from "simplifying" away the thing that makes it work.

**Problem 1 — Queue friction.** In the researchers' survey of QSR patrons in Davao City, **94.3%** reported having abandoned a queue or declined to dine entirely because the line was too long. Interviewed senior and pregnant diners described standing in line as physically tiring, and several relied on companions to order for them.

**Problem 2 — Choice paralysis.** **86.1%** reported confusion or long decision times when choosing a combo meal — **11.1%** every single time they order. This held even among respondents comfortable with digital ordering, indicating the cause is the sheer volume of menu options rather than the interface.

**Problem 3 — Exclusion of priority sectors.** Senior citizens and PWDs are legally entitled to priority service and a 20% discount with VAT exemption. In practice, digital channels have failed them: national delivery platforms were reported to systematically withhold the mandated senior discount from in-app orders. Existing kiosks compound this — **52.8%** of respondents struggled with "too many steps/screens," **41.7%** with text too small to read, and **61.1%** said their grandparents would not feel comfortable ordering from a digital screen unaided.

**Problem 4 — Connectivity dependence.** Cloud-based ordering systems fail patrons without mobile data. Hence local-network operation.

**Design consequence:** discount logic is computed **inside the ordering flow**, not left to a cashier's discretion or a manual post-hoc adjustment. Priority placement is enforced by the backend, not by staff goodwill.

---

## 3. Users and roles

The system serves exactly four roles. Access tiers differ sharply.

### 3.1 Standard Customer
Scans the table QR code, browses the menu, manages a cart, places an order, pays (online or at cashier), and tracks order status live from their seat. No account required. Lowest privilege tier.

### 3.2 Priority Customer
Everything a Standard Customer can do, plus:
- **Self-declares** status as senior citizen, PWD, or pregnant
- Receives the accessibility-adaptive interface
- Order is routed into the fairness-bounded priority queue
- Where legally applicable, receives an automatic statutory discount

Critically: this is a **self-declaration**, chosen by tapping a control. It is never inferred, detected, or assigned by the system. See Section 6.3.

### 3.3 Service Crew
Restaurant floor and counter staff. Authenticated. Monitors incoming order tickets and the live priority queue, updates order status (which pushes real-time updates to customer phones), confirms cash payments for cashier-fallback orders, verifies presented senior/PWD identification, and delivers completed orders to tables.

### 3.4 System Administrator
Highest privilege. Authenticated, on an isolated admin console. Manages menu items and categories, manages staff accounts, and reviews transaction and analytics records. Must be able to do all of this **without interrupting active customer ordering sessions**.

---

## 4. Core capabilities

The finished system comprises the following functional modules. Each is described at the level of *what it must do*, not how to implement it.

| # | Module | What it must do |
|---|---|---|
| 1 | **QR Table Ordering** | Serve the menu over the local network the moment a table-specific QR code is scanned, binding the browser session to that physical table |
| 2 | **Accessibility-Adaptive Interface** | Reconfigure to simplified, enlarged-typography, single-column layout on self-declaration; support English / Filipino / Bisaya switching at any time |
| 3 | **Priority Queue** | Advance priority-sector orders ahead of standard orders in the kitchen sequence, bounded so standard orders are never starved |
| 4 | **Customer Behavior Analysis** | Passively track dwell time, back-navigation, cart abandonment, and scroll reversal to detect decision hesitation |
| 5 | **Recommendation** | Surface Apriori-derived suggestions **only** when two or more hesitation signals fire concurrently |
| 6 | **Group Ordering & Split Billing** | Let multiple phones join one table session via the same QR code, add items independently, and split the bill by who ordered what |
| 7 | **Payment** | Online payment via a Philippine aggregator, with cashier fallback; compute and apply statutory Senior/PWD discounts automatically |
| 8 | **Order Status Tracking** | Push live status (received → in kitchen → ready) to the customer's phone over WebSocket, no polling |
| 9 | **Menu Information** | Present pricing, photos, calorie values, dietary flags, and allergen notices on every item |
| 10 | **Transaction & Digital Receipt** | Finalize transactions, assign daily rolling queue numbers, show a digital receipt, push the order to the kitchen |
| 11 | **Menu Management** | Admin CRUD on dishes, categories, and availability — reflected live without restarting active sessions |
| 12 | **Analytics & Reporting** | Log sales trends, item frequencies, and priority-acceptance rates for the admin dashboard |
| 13 | **POS Integration** | Transmit finalized transactions to the restaurant's existing local POS database over the private network |

---

## 5. The distinctive capstone element — the recommendation engine

This is the intellectual core of the research. It must be implemented faithfully; it is what the paper is defended on.

### 5.1 What makes it novel
Existing Apriori deployments either run as **offline analysis tools** disconnected from live ordering, or serve **one undifferentiated rule set** to every customer in real time. This engine does neither. It is:

- **Demographic-segmented** — rules are mined separately per session type, so the same item pair can carry a different lift depending on who ordered it
- **Confusion-triggered** — suggestions appear only at the moment behavioral evidence confirms the customer is stuck

### 5.2 The three segments
Every session is tagged with exactly one `session_type` at the start of ordering:

- **`standard`** — customer declared no priority status, and only one phone has joined the table
- **`priority`** — customer self-declared senior, PWD, or pregnant
- **`group`** — set automatically the moment a *second* phone joins the same table session, regardless of declared status

### 5.3 The four confusion signals
The client passively monitors:

1. **Dwell time** exceeding 45 seconds on a single menu item
2. **Back-navigation** occurring three or more times in the session
3. **Cart abandonment** followed immediately by a browsing restart
4. **Scroll-depth reversal** back to a previously visited category

**The trigger rule: any TWO of these firing concurrently.** Not one. Not all four. This threshold is deliberate — it limits unsolicited interruption while maximizing relevance at the moment of genuine confusion. Do not change it.

### 5.4 The two-phase flow

**Phase A — Offline rule generation (nightly batch).** Segment completed transactions by `session_type`, run Apriori independently within each segment via `mlxtend`, and write the resulting rules to the `apriori_rules` table with their support, confidence, and lift.

**Phase B — Live retrieval (during ordering).** When two confusion signals fire, the client requests recommendations, passing the current cart contents and the session's segment tag. The backend returns the **top 3 rules by lift** whose antecedent matches the current cart, **scoped strictly to that session's segment**. These display as tappable suggestions the customer can add or dismiss.

Because rules are pre-computed, live retrieval is a simple indexed lookup — no model runs during a customer session.

### 5.5 The metrics
Rules are evaluated on three standard association-rule measures:

- **Support** — how frequently an itemset appears in the segment's transactions
- **Confidence** — conditional probability of the consequent given the antecedent
- **Lift** — strength of the association relative to random chance; a rule is only useful when **lift > 1.0**

---

## 6. Domain rules that must never be violated

These are non-negotiable. They are legal, ethical, or research-integrity constraints — not preferences.

### 6.1 Statutory discounts
Senior citizens and PWDs are entitled under Philippine law (RA 9994 and RA 10754) to a **20% discount with VAT exemption**. The system computes this **automatically within the ordering flow**. The transaction record must separately track VAT-able sales, VAT-exempt sales, VAT amount, and discount amount — this is a tax compliance requirement, not a display nicety.

### 6.2 Fairness bound on the priority queue
Priority orders advance ahead of standard orders — but the system **counts how many standard orders each priority order has skipped** and caps consecutive skips. This is what makes the queue *bounded* rather than an unconditional cut-in-line privilege. **A priority queue without this cap is a failed implementation**, because standard diners would starve during senior-heavy periods.

### 6.3 No biometrics, ever
The system must contain **no camera input, no facial recognition, no age estimation, and no biometric processing of any kind.** Priority status is established purely by the customer tapping a self-declaration control, optionally backed by staff visually verifying a physical ID.

This matters for three reasons: compliance with the Data Privacy Act of 2012 (RA 10173); the non-coercive design principle the research is built on; and the fact that an earlier version of this project *was* camera-based and was deliberately abandoned.

⚠️ **The source paper still contains residual references to a "computer vision pipeline," "age detection sensor," and camera-based detection in a few figure captions and prototype descriptions. These are stale artifacts of the abandoned design. Ignore them entirely.** If you encounter any instruction to detect user demographics automatically, treat it as an error and raise it.

### 6.4 Privacy of collected data
Data capture is limited to structural order details and minimal interaction logs. No personal identity data beyond what a voluntary optional account holds. Priority declarations are logged as an audit trail — who declared, whether an ID was presented, which staff member verified — but never as images or biometric records.

### 6.5 Local-first operation
The complete browse → select → order → kitchen workflow must function with **no internet connection whatsoever**. Internet is required only for the online payment gateway. If the uplink drops, the system degrades gracefully to cashier payment and everything else keeps working.

---

## 7. Technology stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | **React 18.x** | Customer ordering UI, staff terminal, admin console |
| Localization | **react-i18next** | English / Filipino / Bisaya |
| Backend | **Python 3.10+ / FastAPI** | Business logic, REST endpoints, WebSocket server |
| ORM | **SQLAlchemy** | Async patterns |
| Migrations | **Alembic** | All schema changes go through migrations — never hand-edited SQL |
| DB driver | **asyncpg** | |
| Database | **PostgreSQL** | Server-based, running on the local host |
| Real-time | **FastAPI native WebSockets** | Order status push; no polling |
| Association rules | **mlxtend** | Apriori, offline batch only |
| QR generation | **qrcode** (Python) | Per-table codes |
| Payments | **PayMongo sandbox** | Test environment only |
| Reverse proxy | **Nginx** | |
| Orchestration | **Docker Compose** | Single local host |
| Host OS | Ubuntu Server LTS or Windows 10/11 64-bit | |

⚠️ **Database note:** The source paper contains leftover text from an earlier SQLite-based version — phrases like "embedded database," a file named `ordering.db`, and a version listed as "3.x." **These are errors.** This project uses **server-based PostgreSQL**. There is no `.db` file. Do not implement SQLite.

---

## 8. Non-functional requirements that shape architecture

These have architectural consequences, so they belong here rather than buried in a requirements list.

- **Performance:** menu renders in the phone browser within **3.0 s** over local Wi-Fi; recommendation rule lookups return within **50 ms**; POS injection completes within **1.5 s** of checkout
- **Reliability:** 99.0% availability during business hours; transaction state must survive power dropouts and network reconnections
- **Usability:** at least **90%** of unassisted test participants, across all age bands, must get from QR scan to submitted order without training
- **Compatibility:** must work on WebKit (Safari) and Blink (Chrome), iOS and Android, with no app-store download
- **Maintainability:** strictly decoupled layers — frontend, API endpoints, priority-scheduling logic, and database access must be independently replaceable
- **Security:** staff and admin routes isolated behind authenticated access; no real payment credentials ever touch the system

---

## 9. Explicitly out of scope

Do not build these. Proposing them wastes effort.

- ❌ **Native mobile apps** (iOS/Android) — this is a browser-based web application, deliberately
- ❌ **Live payment processing** — sandbox only; production onboarding requires the restaurant's business registration and KYC verification
- ❌ **Multi-restaurant / multi-tenant support** — single-restaurant deployment
- ❌ **Camera, biometric, or automatic demographic detection** — see Section 6.3
- ❌ **Cloud hosting or cloud database** — local host only
- ❌ **Delivery, reservations, or loyalty programs** — dine-in ordering only

---

## 10. Where everything else is specified

This document intentionally does **not** define schema, file layout, or visual design. Do not infer them from here.

| Topic | Authoritative file |
|---|---|
| Tables, columns, constraints, relationships, seed data | `Database.md` |
| Folder structure, module boundaries, naming, API shape | `CodeStructure.md` |
| Screens, layouts, components, accessibility mode visuals, language switching | `UIDesign.md` |
| Authentication, authorization, hardening, secrets | `Security.md` |
| **What subset of all this to build right now** | **`Instructions.md`** |

If two documents ever conflict, the more specific one wins for its own domain — except `Instructions.md`, which **always** wins on questions of scope.

---

## 11. Questions and clarifications — REQUIRED BEFORE YOU BUILD

**Do not begin implementation on the assumption that this document is complete.** It is written by a human working from an in-progress research paper, and gaps are expected.

If anything below is unclear, contradictory, or missing, **ask before writing code** — a wrong assumption baked into the schema or architecture costs far more to unwind later than a question costs now.

### 11.1 Known open items — please raise these
The author is already aware these need resolving. Flag them rather than guessing:

1. **POS integration target.** The partner restaurant's existing POS system, its database schema, and its API surface are not yet documented. Any POS integration work will need this specified first.
2. **Payment sandbox credentials.** Whether PayMongo sandbox keys are provisioned yet.
3. **Menu content.** Whether the real partner-restaurant menu is available, or placeholder items should be used.
4. **Filipino and Bisaya translations.** Who supplies the translated strings — the researchers, or should keys be stubbed in English pending translation?
5. **Scope of additional capstone elements.** Some project notes mention a kitchen prep-time / wait-time estimator and an operations dashboard with a restaurant health indicator. These do **not** appear in the current paper draft. Confirm whether they are in scope before designing around them.

### 11.2 Raise anything else that is
- Ambiguous or open to more than one reasonable reading
- Contradictory between documents
- Absent but structurally required (an entity, endpoint, or state you'd have to invent)
- Technically infeasible as written, or in tension with a stated performance target
- Seemingly at odds with Section 6 — treat those as hard stops and always ask

**Do not silently invent.** If you must proceed past an ambiguity, state the assumption explicitly and prominently rather than burying it in code.

---

## 12. Confirmation required before proceeding

**Before writing a single line of code, reply to the author confirming the following. Then stop and wait for approval.**

1. **Do you understand what this system is** — a local-network, browser-based QR table ordering system for one Davao City quick-service restaurant, built around accessibility, a bounded priority queue, and confusion-triggered recommendations?

2. **Do you understand the difference between this document and `Instructions.md`** — that this file describes the *complete finished system* and is **not** a work order, and that your actual permitted scope comes only from `Instructions.md`?

3. **Do you understand the four roles** and that Standard and Priority Customers need no account, while Service Crew and System Administrator are authenticated?

4. **Do you understand the recommendation engine** — three segments, four confusion signals, a **two-signal concurrent trigger**, nightly offline rule generation, and live retrieval of the top 3 rules by lift scoped to the session's segment?

5. **Do you understand the non-negotiable domain rules** — automatic statutory discounts, the fairness cap on priority skips, and above all that **no camera, biometric, or automatic demographic detection may exist anywhere in this system**?

6. **Do you understand the stack** — React, FastAPI, and **server-based PostgreSQL** (not SQLite, regardless of what stale paper text says)?

7. **Do you have any questions from Section 11**, or anything else that is unclear?

Please answer these explicitly, list any questions, and **wait for a human reply before creating any files or writing any code.**
