# Algorithms.md

**System:** QR-Based Table Ordering System
**Document role:** The authoritative definition of the four pieces of business logic that must be exactly right
**Needed from:** Phase 5 onward. Phases 1–4 do not touch any of this

---

## 0. STOP — Read this before doing anything

**Do not implement any algorithm here until `Instructions.md` reaches the phase that needs it.**

This file specifies four calculations that the other documents describe but do not define precisely:

| § | Algorithm | Needed in |
|---|---|---|
| 2 | Fairness-bounded priority queue | Phase 6 |
| 3 | Confusion detection | Phase 7 |
| 4 | Discount and VAT computation | Phase 5 |
| 5 | Daily queue number assignment | Phase 5 |

Each is load-bearing for a claim the research paper defends. Each has a failure mode that produces plausible-looking but wrong output — which is worse than a crash, because nobody notices.

**Two of these correct earlier documents.** §2 revises the meaning of a column described in `Database.md`. §4 rejects the obvious arithmetic. Both are flagged where they occur.

---

## 1. Rules that apply to all four

**Money is `Decimal`, never `float`.** In Python, `decimal.Decimal`. In PostgreSQL, `NUMERIC`. A float total will be off by fractions of a centavo and will not reconcile.

**Rounding is `ROUND_HALF_UP` to 2 decimal places**, applied per line item, never once at the end. Receipt lines must sum to the receipt total.

**All four run server-side only.** The client never computes a price, a discount, a queue position, or a queue number. It displays what the server returns.

**Constants live in `config.py`**, not inline. Every threshold below is named and configurable.

```python
VAT_RATE              = Decimal("0.12")
STATUTORY_DISCOUNT    = Decimal("0.20")
MAX_PRIORITY_SKIPS    = 3
CONFUSION_WINDOW_SEC  = 120
CONFUSION_COOLDOWN_SEC = 180
CONFUSION_MAX_PER_SESSION = 3
DWELL_THRESHOLD_SEC   = 45
BACKNAV_THRESHOLD     = 3
```

---

## 2. Fairness-bounded priority queue

### 2.1 The claim being implemented

Senior, PWD, and pregnant diners' orders advance ahead of standard orders — **bounded**, so standard orders are never starved. The paper calls this "fairness-bounded," and the bound is what distinguishes it from an unconditional cut-in-line privilege.

### 2.2 ⚠️ Correction to `Database.md`

`Database.md` §6.5 describes `priority_skips_used` as counting *how many standard orders a given priority order has advanced ahead of*.

**That definition does not prevent starvation.** Work through it: a priority order may skip at most 3 standard orders, so its own counter caps at 3. But the *next* priority order arrives with a fresh counter of 0 and skips the same standard order again. And the next. The standard order at the front is skipped indefinitely by an unbounded series of priority orders, each individually within its limit.

The intent is right; the counter is on the wrong row.

**Corrected definition:**

> `priority_skips_used` — the number of times **this order** has been skipped by a later-arriving priority order. Only ever non-zero on standard orders.

This is a semantic change, not a schema change — the column already exists on every `kitchen_queue` row. Once a standard order's counter reaches `MAX_PRIORITY_SKIPS`, it becomes **protected**: no further priority order may pass it.

The guarantee this buys: **no standard order is ever delayed by more than `MAX_PRIORITY_SKIPS` positions, regardless of how many priority orders arrive.**

### 2.3 Insertion algorithm

```
place_in_queue(new_order):

    if not new_order.is_priority:
        append to end of queue
        return

    i = 0

    # 1. Never reorder food already being cooked
    while i < len(queue) and queue[i].prep_started_at is not None:
        i += 1

    # 2. Priority orders are FIFO among themselves
    while i < len(queue) and queue[i].is_priority:
        i += 1

    # 3. Skip past protected standard orders — they have hit the cap
    while i < len(queue) and queue[i].priority_skips_used >= MAX_PRIORITY_SKIPS:
        i += 1

    insert new_order at position i

    # 4. Charge a skip to every standard order pushed back
    for order in queue[i+1:]:
        if not order.is_priority and order.prep_started_at is None:
            order.priority_skips_used += 1

    renumber queue_position for all rows from i onward
```

Three invariants, in order of precedence:

1. **An order that has started cooking is never moved.** `prep_started_at IS NOT NULL` is immovable.
2. **Priority orders do not jump each other.** Among priority orders, strictly first-in-first-out.
3. **A protected standard order is never passed.** Once at the cap, it is immovable by any priority arrival.

### 2.4 Worked example

`MAX_PRIORITY_SKIPS = 3`. Standard orders S1–S3 are waiting, none started.

| Event | Queue after | S1 / S2 / S3 skips |
|---|---|---|
| — | `[S1, S2, S3]` | 0 / 0 / 0 |
| P1 arrives | `[P1, S1, S2, S3]` | 1 / 1 / 1 |
| P2 arrives | `[P1, P2, S1, S2, S3]` | 2 / 2 / 2 |
| P3 arrives | `[P1, P2, P3, S1, S2, S3]` | 3 / 3 / 3 |
| P4 arrives | `[P1, P2, P3, S1, S2, S3, P4]` | 3 / 3 / 3 |

At P4, all three standard orders are protected, so P4 goes to the back. S1 waits behind exactly three priority orders and no more — that is the bound, demonstrated.

**This table is the demo.** If your professor asks how fairness is enforced, walk it. The fourth row is the whole answer.

### 2.5 Concurrency

Insertion **must** hold a lock for the duration. Two simultaneous priority orders computing positions against the same snapshot will both claim the same slot.

```sql
SELECT * FROM kitchen_queue
 WHERE completed_at IS NULL
 ORDER BY queue_position
 FOR UPDATE;
```

Read, compute, write, commit — one transaction.

### 2.6 Choosing the cap

`MAX_PRIORITY_SKIPS = 3` assumes roughly 4 minutes average prep, giving a worst-case additional wait of about 12 minutes for a standard diner. Defensible, and tunable if the partner restaurant's actual prep times differ.

State it as a finding, not a guess: *no standard order waits behind more than three priority orders.*

---

## 3. Confusion detection

### 3.1 The claim being implemented

Recommendations surface **only** when behavioral evidence confirms choice paralysis — specifically when **any two of four signals fire concurrently**. This conditional trigger is the novelty the paper defends. It is what separates the engine from an always-on upsell.

### 3.2 Defining "concurrently"

The paper says two signals must fire concurrently but never defines the window. Signals are instantaneous events; two are never literally simultaneous.

**Definition:** a fired signal remains **active** for `CONFUSION_WINDOW_SEC` (120 s), then decays. The trigger fires the moment **two or more signals are active at once**.

120 seconds is chosen to span a plausible episode of hesitation without linking unrelated moments minutes apart.

### 3.3 The four signals

| # | Signal | Fires when |
|---|---|---|
| 1 | **Dwell** | A single menu item is ≥50% visible, continuously, for 45 s |
| 2 | **Back-navigation** | The 3rd back action of the session occurs |
| 3 | **Cart abandonment** | Cart goes from ≥1 item to 0, then any browse action within 60 s |
| 4 | **Scroll reversal** | The customer returns to a category they have already left |

**Signal 1 — Dwell.** `IntersectionObserver` at `threshold: 0.5`. A timer starts when a card crosses the threshold and resets when it drops below. Only one item is timed at a time; scrolling to a different item restarts the clock. Fires once per item, at 45 s.

**Signal 2 — Back-navigation.** Increments on any backward move: detail → list, category → category list, cart → menu, and the browser back button. Fires when the session counter reaches 3. Fires **once** — subsequent back actions do not re-fire it.

**Signal 3 — Cart abandonment.** Two-stage. Stage one arms when the cart empties from a non-empty state. Stage two fires if a browse action occurs within 60 s. Disarms if the customer checks out or leaves.

**Signal 4 — Scroll reversal.** Maintain an ordered list of visited category IDs. Fires when the customer opens a category already in that list. Fires once per session.

### 3.4 Trigger evaluation

```
on_signal_fired(signal):

    signal.expires_at = now + CONFUSION_WINDOW_SEC
    active = [s for s in signals if s.expires_at > now]

    if len(active) < 2:
        return

    if session.last_trigger_at and
       now - session.last_trigger_at < CONFUSION_COOLDOWN_SEC:
        return

    if session.trigger_count >= CONFUSION_MAX_PER_SESSION:
        return

    request_recommendations()
    session.last_trigger_at = now
    session.trigger_count += 1
    clear all active signals
```

Three guards beyond the two-signal rule:

- **Cooldown** — 180 s between triggers. Without it, a hesitant customer is interrupted continuously.
- **Session cap** — 3 triggers maximum. A system that keeps suggesting has stopped helping.
- **Clear on fire** — active signals reset after a trigger, so the next one requires fresh evidence.

### 3.5 Resetting on decisiveness

Adding an item to the cart is evidence the customer decided. **Clear all active signals.** Otherwise a customer who browsed slowly, chose, and moved on gets interrupted for hesitation they have already resolved.

### 3.6 Empty cart

The rules table is keyed on antecedents matched against the cart. An empty cart has no antecedent — but an empty cart is also when paralysis is most likely.

**Fallback:** when the cart is empty, return the 3 consequents with the highest lift across all rules in the session's segment, ignoring antecedent matching. Still segment-scoped, still drawn from real rules, no special-case table needed.

### 3.7 Logging

Every signal writes an `analytics_events` row. Every trigger writes one. Every overlay shown, accepted, or dismissed writes one. This is the source for the paper's confusion-trigger rate and recommendation-acceptance figures — without it, those numbers cannot be reported.

### 3.8 Demo note

Waiting 45 seconds in front of a professor is dead air. Add a config override — `DWELL_THRESHOLD_SEC = 10` — for the demo, and say so out loud rather than hiding it. The mechanism is identical; only the constant differs.

---

## 4. Discount and VAT computation

### 4.1 ⚠️ The obvious approach is wrong

The intuitive calculation for a 20% senior discount:

```
₱112.00 × 0.80 = ₱89.60          ← WRONG
```

The correct calculation under RA 9994:

```
₱112.00 ÷ 1.12 = ₱100.00         strip VAT — seniors are VAT-exempt
₱100.00 × 0.20 =  ₱20.00         20% discount on the VAT-exempt base
₱100.00 − ₱20.00 = ₱80.00        amount due
```

**A ₱9.60 difference on a single item.** The naive version overcharges every senior on every transaction.

The reason: Philippine menu prices are VAT-inclusive, and the statute grants a discount **and** VAT exemption. The exemption is applied first, then the discount is taken against the exempt base. Applying 20% to a VAT-inclusive price silently charges the senior VAT they are exempt from.

If a panelist checks your arithmetic against the statute, this is the line they will check.

### 4.2 Standard order

No discount, no exemption. Menu prices are VAT-inclusive, so VAT is backed out for reporting.

```
gross_amount     = Σ (unit_price × quantity)
vatable_sales    = gross_amount ÷ (1 + VAT_RATE)
vat_amount       = gross_amount − vatable_sales
vat_exempt_sales = 0
discount_amount  = 0
net_amount       = gross_amount
```

The customer pays the menu price. `vatable_sales + vat_amount` reconciles to `gross_amount`.

### 4.3 Priority order

Computed **per line item**, then summed.

```
for each line:
    line_gross    = unit_price × quantity
    line_exempt   = round(line_gross ÷ (1 + VAT_RATE))
    line_discount = round(line_exempt × STATUTORY_DISCOUNT)
    line_net      = line_exempt − line_discount

gross_amount     = Σ line_gross
vat_exempt_sales = Σ line_exempt
discount_amount  = Σ line_discount
net_amount       = Σ line_net
vatable_sales    = 0
vat_amount       = 0
```

Per-line rounding is what makes the receipt add up. Computing on the total and allocating backward produces lines that do not sum to the total, and a customer checking the arithmetic will find the discrepancy.

### 4.4 Worked example

Priority session — 2× Fried Chicken at ₱89.00, 2× Rice at ₱25.00.

| Line | Gross | ÷ 1.12 | × 20% | Net |
|---|---|---|---|---|
| Fried Chicken ×2 | 178.00 | 158.93 | 31.79 | 127.14 |
| Rice ×2 | 50.00 | 44.64 | 8.93 | 35.71 |
| **Total** | **228.00** | **203.57** | **40.72** | **162.85** |

Stored on `transactions`:

```
gross_amount     = 228.00
vatable_sales    =   0.00
vat_exempt_sales = 203.57
vat_amount       =   0.00
discount_amount  =  40.72
net_amount       = 162.85
```

Reconciles: `203.57 − 40.72 = 162.85` ✓

The same order as a standard session:

```
gross_amount     = 228.00
vatable_sales    = 203.57
vat_amount       =  24.43
vat_exempt_sales =   0.00
discount_amount  =   0.00
net_amount       = 228.00
```

Reconciles: `203.57 + 24.43 = 228.00` ✓

**Both must reconcile before the transaction is written.** Assert it.

### 4.5 Eligibility

The discount applies when **all** hold:

1. `sessions.declared_priority_status` is `senior` or `pwd`
2. A `priority_verification_log` row exists for the session
3. That row has `discount_eligible = TRUE`

**`pregnant` receives priority queue placement but no statutory discount.** RA 9994 and RA 10754 cover senior citizens and persons with disability. Pregnancy grants priority service under separate rules, not a discount. Getting this wrong is a compliance error in the direction of giving away money the restaurant is not obliged to give.

### 4.6 Group sessions

Under RA 9994 the discount applies to the senior's **own consumption**, not the whole table — which requires knowing which items are whose.

**Out of scope this stage.** Split billing is deferred per `Instructions.md` §6. For now, a group session containing a priority declaration applies the discount to that device's own line items only, via `transaction_items.device_id`. When split billing arrives, this needs revisiting against the IRR's per-head rule.

### 4.7 The client never sends a price

The checkout request carries `item_id` and `quantity`. Nothing else. The server prices the order from `menu_items` at request time.

Accepting a client-supplied total means a modified request buys a whole chicken for one peso. Restated from `Security.md` §6.2 because this is where it is actually enforced.

---

## 5. Daily queue number assignment

### 5.1 Requirement

Each transaction gets a queue number, unique within its business day, resetting each day: `Q-001`, `Q-002`, …

### 5.2 The race

Two phones checking out simultaneously both read "highest today is 5" and both claim 6. `UNIQUE (queue_date, queue_number)` catches it — as a crash, at checkout, in front of a customer.

The constraint is a backstop. Assign correctly instead.

### 5.3 Assignment

Inside the checkout transaction, before writing:

```sql
SELECT COALESCE(MAX(queue_number), 0) + 1
  FROM transactions
 WHERE queue_date = CURRENT_DATE
   FOR UPDATE;
```

`FOR UPDATE` serializes concurrent checkouts on the same day's rows. The second waits for the first to commit, then reads the updated maximum.

This is part of the single checkout transaction covering `transactions`, `transaction_items`, `kitchen_queue`, and `payments` — per `Database.md` §9.

### 5.4 Business day

`queue_date` uses `CURRENT_DATE` in **Asia/Manila**. A restaurant open past midnight will roll over mid-service; that is correct and expected. If the partner restaurant wants a business day boundary at, say, 4 a.m., that is a configuration change — raise it rather than assuming.

### 5.5 Display

Zero-padded to three digits with a `Q-` prefix: `Q-006`. Formatting is display-only; the column stores a `SMALLINT`.

---

## 6. Where these are implemented

| Algorithm | File |
|---|---|
| Priority queue | `services/queue.py` |
| Confusion detection | `frontend/src/hooks/useConfusionSignals.js` |
| Recommendation retrieval | `services/recommendation.py` |
| Discount and VAT | `services/order.py` |
| Queue number | `services/order.py` |

Confusion **detection** is client-side — it observes browser behavior. Everything else is server-side. The client reports that a trigger occurred; it never decides what to recommend.

---

## 7. Questions and clarifications — REQUIRED BEFORE YOU BUILD

These four calculations are the ones where a plausible-looking wrong answer is most likely and least visible. **Ask before assuming.**

### 7.1 Known open items

1. **`MAX_PRIORITY_SKIPS = 3`** is an estimate based on assumed prep times. Confirm against the partner restaurant's actual figures.
2. **`CONFUSION_WINDOW_SEC = 120`** is a reasoned choice, not a measured one. No empirical basis exists yet.
3. **Non-discountable items.** RA 9994 excludes some categories from the senior discount. The schema has no `is_discountable` flag — currently every item qualifies. Confirm whether the partner menu contains anything that should be excluded.
4. **Business day boundary.** Midnight Asia/Manila is assumed. Confirm against the restaurant's operating hours.
5. **VAT rate as configuration.** 12% is current. Confirm it should be configurable rather than constant.
6. **Group-session discount allocation.** §4.6 defers this. It needs resolving before split billing is built.

### 7.2 Raise anything else that is

- Ambiguous, or open to more than one reasonable reading
- Contradictory between this file and `Database.md`, `ProjectOverview.md`, or the paper
- A calculation you cannot verify against a worked example here

**If a computed total does not reconcile, stop and report it.** Do not adjust a figure to make it balance.

---

## 8. Confirmation required before proceeding

**Before implementing any algorithm here, reply confirming the following. Then stop and wait.**

1. **Do you understand the correction in §2.2** — that `priority_skips_used` counts how many times **this order has been skipped**, not how many orders it has skipped, and that the original definition does not prevent starvation?

2. **Do you understand the three queue invariants** — cooking orders never move, priority orders never jump each other, and a protected standard order is never passed?

3. **Do you understand that "concurrently" means two signals active within a 120-second decay window**, with a cooldown, a session cap, and a reset when the customer adds to cart?

4. **Do you understand that `₱112.00 × 0.80` is the wrong discount calculation**, and that VAT is stripped first, with the 20% taken against the VAT-exempt base?

5. **Do you understand that discount computation is per line item with per-line rounding**, so that receipt lines sum to the receipt total?

6. **Do you understand that `pregnant` receives priority queue placement but no statutory discount?**

7. **Do you understand that both the standard and priority totals must reconcile**, and that a failure to reconcile is reported rather than adjusted?

8. **Do you understand that money is `Decimal` everywhere**, never `float`, and that all four algorithms run server-side only?

9. **Do you have any questions from §7.1**, or anything unclear?

Answer these explicitly, list any questions, and **wait for a human reply before writing any code.**
