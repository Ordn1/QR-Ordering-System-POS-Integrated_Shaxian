# Demo script — capstone defence

Built against the IT 22/L Software Prototyping rubric. The walkthrough is 25% on
its own, but it is also the only vehicle you have for showing criteria 1–4 and
Outcome D. Every segment below names the criterion it scores, so nothing you
demonstrate is wasted.

Target running time: **15 minutes**, leaving room for questions.

The rubric rewards *"confidently articulates design decisions"* — not narration.
So the **Say** lines are decisions and trade-offs, never "now I click this."

---

## Pre-flight (do this 10 minutes before, not during)

```bash
# 1. Clean database — makes every number below reproducible
cd ~/Documents/Shaxian/backend && source .venv/bin/activate
alembic downgrade base && alembic upgrade head && python -m seeds.run

# 2. Generate the association rules from that history
python -m jobs.apriori

# 3. Backend
uvicorn app.main:app --port 8001

# 4. Frontend — the override matters, see below
cd ~/Documents/Shaxian/frontend
VITE_DWELL_THRESHOLD_SEC=3 npx vite --port 5173

# 5. Fresh table URLs (tokens change on every reseed)
psql -d shaxian_ordering -U shaxian_app -tAc \
  "select table_number||'  http://localhost:5173/t/'||qr_token from tables order by table_number limit 6"
```

**Why the dwell override.** The real threshold is 45 seconds — that is the value in
the paper and the default in `confusionConfig.js`. Three seconds is a demo
accommodation so segment 6 doesn't stall. **Say this out loud when you get there.**
Volunteering it reads as command of the system; being caught on it does not.

**Window setup**

| Window | What | Login |
|---|---|---|
| **A** | Phone-sized (390×844, DevTools device toolbar) — Table 3 URL | — |
| **B** | Desktop — `/staff/queue` | `crew1` / `crew1-demo-2026` |
| **C** | Desktop — `/admin` | `admin` / `admin-demo-2026` |
| **D** | Phone-sized — Table 3 URL, **unopened until segment 7** | — |

---

## 1 · Frame the problem — 60 seconds

**No screen yet.** Talk first.

> Three problems, all from our own data. 94.3% of the 36 patrons we surveyed had
> abandoned a queue or declined to dine because the line was too long. 86.1%
> reported choice paralysis on a combo at least sometimes — and that persisted
> among people who were otherwise comfortable ordering digitally, so it is menu
> volume, not interface literacy. And seniors and PWDs are legally entitled to a
> 20% discount under RA 9994 and RA 10754, but GrabFood and foodpanda were
> reported withholding it, which triggered a congressional inquiry.
>
> The third one is why the discount is computed inside the ordering session
> rather than left to the counter.

**Scores:** sets up Outcome D and the whole system rationale.

---

## 2 · Standard order — 2 minutes · Window A

Scan → landing names Table 3 → menu → tap an item name → detail sheet → add → cart
→ checkout.

**Pause on the item detail sheet:**

> Calories, allergens and dietary flags are columns on `menu_items`, not text
> baked into the page. That is requirement 2.2.3.1.9, and it is the same row the
> admin edits.

**Pause on checkout — this is a criterion 3 moment:**

> These totals are not computed in JavaScript. The page calls a quote endpoint and
> the server prices the cart with the exact function that will charge it — one
> code path, so the preview cannot disagree with the receipt.

Place it as **Pay at cashier**.

**Scores:** criterion 3 (UI/DB mapping), criterion 4 (flow).

---

## 3 · Priority declaration — 2 minutes · Window A, fresh table

New table. Tap **Priority assistance** → **Senior citizen**.

> The interface reconfigures on declaration — type scales, single column, 60px tap
> targets. No camera, no biometrics. Demographic status is self-declared and the
> ERD says so explicitly.

Add items, go to checkout.

> And there is the 20% with VAT exemption, before they commit — not discovered on
> the receipt afterwards. Gross, VAT-exempt base, discount, amount due.

**Scores:** criterion 3, criterion 4, **Outcome D** (this is your strongest ethics
moment — say "no camera, no biometrics" explicitly).

---

## 4 · Queue fairness — 2 minutes · Window B

The senior ticket sits above the standard ones; standard rows show "skipped 1".

> A priority queue that only promotes is unfair to everyone else. `kitchen_queue`
> carries `priority_skips_used`, and after three skips the cap stops the priority
> order advancing. That is what "fairness-bounded" means — the bound is a column,
> enforced in the service, not a promise in the paper.

**Scores:** criterion 1 (design), criterion 2 (integrity).

---

## 5 · Live push — 90 seconds · Windows A + B

Window A on **Status**. In Window B press **Start preparing**.

> No refresh. That is a WebSocket push from the kitchen to the diner's phone.

**Mark ready** → Ready tab → click the ticket → **Confirm cash**.

> Cash settlement gets its own confirmation showing the amount due and the
> discount, because marking money collected should be deliberate rather than one
> click on a row.

**Scores:** criterion 3, criterion 4.

---

## 6 · The capstone element — 3 minutes · Window A

**This is the segment that distinguishes the project. Do not rush it.**

Put **Wonton** in the cart. Linger on one item, then navigate back three times.

> Two of four behavioural signals fired together — extended dwell and repeated
> back-navigation. One alone does nothing. An overlay that interrupts is a worse
> problem than the choice paralysis it was built to relieve.
>
> I have lowered the dwell threshold to three seconds for this demo. The real
> value is 45 seconds.

Then the point most people miss — **say this slowly**:

> The rules are segmented by declared context, and mlxtend generated them from our
> own transaction history. Same cart — one Wonton — gives a different suggestion
> per segment:

| Segment | Top suggestion for `{Wonton}` | Lift | Confidence |
|---|---|---|---|
| Standard | Shuangcai Pork Noodle Soup | **1.78** | 38% |
| Priority | Xiaolongbao | **1.43** | 63% |
| Group | Steamed Rice | **2.20** | 40% |

> Nobody else combines self-declared segmentation with a concurrent-signal trigger
> inside a QR dine-in flow. That combination is the capstone element.

If asked about speed: **median 2.5 ms retrieval against a 50 ms budget** — because
the rules are pre-computed by the batch job, not mined at request time.

**Scores:** criterion 1, criterion 3, and the novelty claim.

---

## 7 · Group ordering — 90 seconds · Windows A + D

Open Window D on the **same** table URL.

> Second phone, same code. It joins the existing session rather than starting a
> new one, and the session flips to the group segment — which is what changed the
> recommendations you just saw.

Cart → **Split the bill**.

> Be straight here: shares are computed from the real cart, but attribution is
> derived. `transaction_items.device_id` and `payments.device_id` exist in the
> schema for true per-device attribution; independent settlement is out of the
> prototype's scope, so shares reconcile at the counter.

**Scores:** criterion 3 — and volunteering the limitation scores better than being
caught by it.

---

## 8 · Admin — 3 minutes · Window C

**Dashboard.** KPIs, sales trend, segment mix, declared priority status, top items,
recommendation acceptance.

> Declared priority status is charted separately from segment because "priority"
> folds senior, PWD and pregnant together, and the paper reports the breakdown.
>
> One design constraint worth naming: only three of the six chart colours in our
> design system survive a colourblind check, so anything with four categories is
> a single-series chart with identity carried by the axis labels, not by colour.

**Press "Run Apriori job".** Let it finish.

> That is the nightly batch job, run on demand. Same routine as
> `python -m jobs.apriori` — mlxtend over the real baskets, segmented, at
> `min_support` 0.15. I chose that threshold against the actual data: at 0.25 the
> standard segment produces no rules at all.

**Verifications.**

> Every priority declaration, with whether an ID was checked and by whom. We store
> only the last four digits — there is a check constraint enforcing exactly four
> digits, so a full card number cannot be written even by mistake. That is the
> BIR audit trail and the Data Privacy Act at the same time.

**POS bridge.**

> Without this the QR system is an island — the cashier re-keys every order into
> the register to print an official receipt, which is the labour cost we claim to
> remove. This transmits the settled order over the local network automatically.
>
> The register on the far end is simulated, and the receipt says so. The partner's
> POS schema is undocumented, so there is nothing real to integrate against.
> Repointing this at a live register is a change of endpoint, not of design.

Open a payload.

> Idempotency key derived from the content — a retry returns the same receipt
> number instead of double-posting the sale.

**Scores:** criteria 1, 2, 3, 4 and **Outcome D**.

---

## Questions this rubric will produce

**"Is your database normalized?"**
> Third normal form, with two deliberate exceptions. Allergens and dietary flags
> are short display-only lists kept on `menu_items` rather than in a join table,
> and Apriori antecedents are JSONB arrays because a rule references a variable
> number of items. Both are documented in the paper.

**"Show me referential integrity."**
> 16 foreign keys with a deliberate deletion policy: CASCADE where a child is
> meaningless without its parent — transaction items, payments, devices — RESTRICT
> where deleting would destroy history, so you cannot delete a menu item that
> appears in past orders or a staff account that verified a discount. The
> financial spine is NO ACTION. Plus 23 check constraints and a unique constraint
> on `(queue_date, queue_number)` that enforces the daily-rolling queue number in
> the database rather than in code.

**"Where does the queue number come from?"**
> A PostgreSQL advisory lock around the allocation, so twelve concurrent
> checkouts cannot collide. We tested that.

**"How do you know a diner is confused?"**
> We do not, and we do not claim to. Four measurable proxies, and it takes two
> concurrently. It is a deterministic rule, not a prediction.

**"Why not just use a camera to detect seniors?"**
> An earlier design did. We removed it. Detection makes an assumption about a
> person's body, it is a Data Privacy Act exposure, and it is not needed —
> declaration is one tap and is auditable. There is no biometric data anywhere in
> the schema.

**"Is anything not backed by the database?"** — three things, know them cold:
> The navigation guidance is a client-side deterministic rule and is not logged.
> Split-bill attribution is derived rather than read from `device_id`. The
> list/tiles preference is in localStorage. Everything else maps to a column.

**"Is this secure?"**
> Bcrypt at 12 rounds, HTTP-only strict-SameSite session cookies, analytics and
> the audit trail scoped to admin. The cookie's Secure flag is off because the
> prototype runs on plain HTTP on localhost — that is a deployment concern we
> documented rather than pretended away.

---

## If something breaks

| Symptom | Do this |
|---|---|
| Overlay won't fire | You forgot `VITE_DWELL_THRESHOLD_SEC=3`. Say so, and show the rules on the dashboard instead |
| Table says "occupied" | `UPDATE sessions SET ended_at=now() WHERE ended_at IS NULL; UPDATE tables SET occupancy_status='vacant';` |
| Queue looks cluttered | Same statement — it clears stale sessions |
| WebSocket not updating | Reload the customer window; the session is stored per device and survives |
| POS shows a failure | That is the retry path working. Open the payload and explain the idempotency key |

---

## Three things to be honest about, unprompted

Volunteering a limitation reads as command of the system. Being caught on one does
the opposite.

1. **The simulated register.** The integration layer is real; the counterparty is
   mocked because the partner's schema is undocumented.
2. **Split-bill attribution is derived**, not tracked per device.
3. **Returning-customer history was never built.** It is a clause in objective
   1.3.2.4 and there is no `customers` table. Say it is out of scope for the
   prototype rather than letting a panel member find it.

---

## Numbers worth memorising

| | |
|---|---|
| Survey base | 36 QSR patrons — 94.3% queue abandonment, 86.1% choice paralysis |
| Schema | 14 tables · 16 FKs · 23 checks · 34 indexes |
| Fairness bound | 3 consecutive priority skips |
| Statutory discount | 20% + VAT exemption, RA 9994 / RA 10754 |
| Apriori | `min_support` 0.15, segmented — 12 standard / 12 priority / 11 group rules |
| Retrieval | median 2.5 ms against a 50 ms budget |
| Languages | English, Filipino, Bisaya — 284 keys, identical sets |
| Verification | 66 automated checks; 0 contrast and 0 overflow failures across both UI modes, 3 languages, 4 widths |
