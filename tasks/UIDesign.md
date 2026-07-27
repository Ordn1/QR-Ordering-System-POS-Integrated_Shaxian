# UIDesign.md

**System:** QR-Based Table Ordering System
**Direction:** Shaxian Snacks (Davao) brand palette · macOS-grade typographic restraint · sharp-edged, borderless, flat
**Font:** Inter · **Icons:** Lucide · **Charts:** Recharts
**Document role:** The authoritative definition of every visual value, component appearance, and interaction behavior

---

## 0. STOP — Read this before doing anything

**Do not write components, stylesheets, or markup after reading this document.**

This file specifies the **complete finished design system**. It is written at full fidelity so it never needs rewriting.

**It is not a work order.** How much of this you may build right now is defined **exclusively** in `Instructions.md`. If that file authorizes a subset, build only that subset. `Instructions.md` always wins on scope.

Read `ProjectOverview.md`, `Database.md`, and `CodeStructure.md` first. Then Section 21 of this document.

**Relationship to `CodeStructure.md`:** that file defines *where* styles live — the three CSS layers, class naming, file organization. This file defines *what the values are*. Where they overlap, `CodeStructure.md` governs structure and this file governs appearance.

---

## 1. Design thesis

The restaurant's identity is a Chinese street-food house: aged paper, seal-stamp red, ink-brush black. The software is a working tool used at a counter during a lunch rush, and by a seventy-year-old holding a phone at arm's length.

Those two facts set the whole direction:

**The brand appears in small, deliberate places. The working surface stays quiet.** Cream and red identify the system — navbar, modal headers, section markers, charts. Everything a person actually reads or clicks sits on white or near-white. A saturated interface would be on-brand and unusable.

**Nothing is rounded.** No card, button, input, table, or modal has a corner radius. The only exception in the entire system is the status badge, which is a full pill. That one exception is what makes badges instantly scannable — they are the only round thing on screen.

**Nothing is outlined that does not need to be.** Separation comes from whitespace and hairlines, not boxes. Tables have no grid. Icons have no containers. Cards have one hairline and nothing more.

### 1.1 The signature: the seal square

Shaxian's poster carries a red seal stamp — the small square chop in the corner. That square is this system's recurring mark: **a solid red square, 6×6px, sharp-cornered.**

It appears in exactly four places and nowhere else:

- Under the active navbar item, as a 3px red bar
- Before a section heading, as a 6px square
- In a modal header, before the title
- As the required-field marker on forms

It is never decorative. It always marks *this one, here*. Used more freely it becomes wallpaper and stops meaning anything.

### 1.2 What this is not

The reference screenshots are anti-examples as much as examples. Explicitly rejected:

- Rounded cards with drop shadows floating on a tinted page
- Icons in tinted rounded squares
- Gradient fills, glassmorphism, neon accents
- Full-width colored hero bars
- Emoji anywhere in the interface
- Decorative illustration in working screens

---

## 2. Palette

### 2.1 Brand

| Token | Hex | Use |
|---|---|---|
| `--cream` | `#F7F2E8` | Navbar, modal headers, table header rows |
| `--cream-deep` | `#EFE7D6` | Cream surfaces needing separation from cream |
| `--red` | `#B32821` | Brand identity only — logo, seal mark, active indicators, headings |
| `--red-deep` | `#8A1D18` | Chart shading, pressed brand states |
| `--ink` | `#1A1A1A` | Primary text, primary buttons |

**`--red` is never a button fill.** It identifies the system; it does not signal an action. Primary action buttons are ink black. This keeps brand red from competing with destructive red, which sits three rows down in this table and means something entirely different.

### 2.2 Surfaces and text

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FFFFFF` | Page background |
| `--surface` | `#FAFAFA` | Zebra rows, inset panels |
| `--surface-2` | `#F4F5F6` | Disabled fills, chart gridlines |
| `--text` | `#1A1A1A` | Body text |
| `--text-muted` | `#6B7280` | Labels, captions, column headers |
| `--text-faint` | `#9CA3AF` | Placeholders, disabled text |
| `--border` | `#E5E7EB` | Hairlines |
| `--border-strong` | `#D1D5DB` | Input borders, header rules |

### 2.3 Semantic — actions

Deep and desaturated. Never neon.

| Token | Hex | Action |
|---|---|---|
| `--green` | `#1E7B4D` | Create, add |
| `--amber` | `#B57614` | Update, edit |
| `--danger` | `#9B1C1C` | Delete, remove |
| `--blue` | `#1D4E89` | View, inspect |

`--danger` is deliberately cooler and darker than `--red` so the two are distinguishable when adjacent.

Each has a `-tint` at roughly 8% opacity for badge and hover backgrounds:
`--green-tint #E8F3EE` · `--amber-tint #FBF3E4` · `--danger-tint #F7E9E9` · `--blue-tint #E9EFF6`

### 2.4 Semantic — status

Badges only.

| Token | Hex | Tint |
|---|---|---|
| `--status-grey` | `#6B7280` | `#F3F4F6` |
| `--status-green` | `#1E7B4D` | `#E8F3EE` |
| `--status-amber` | `#B57614` | `#FBF3E4` |
| `--status-blue` | `#1D4E89` | `#E9EFF6` |
| `--status-red` | `#9B1C1C` | `#F7E9E9` |
| `--status-violet` | `#5B3E8E` | `#EFEAF6` |
| `--status-orange` | `#B45309` | `#FCF0E4` |

### 2.5 Charts

Deep, shaded, drawn from the brand rather than a default library ramp:

```
--chart-1: #B32821   --chart-2: #8A1D18   --chart-3: #1A1A1A
--chart-4: #6B7280   --chart-5: #B57614   --chart-6: #1E7B4D
```

Sequential ramps interpolate `--red` → `--red-deep`. Gridlines are `--surface-2`. No legends with colored dots — label the series directly.

---

## 3. Typography

**Inter**, one family, everywhere. No secondary display face — the restraint *is* the macOS quality.

### 3.1 Making Inter read like macOS

Three settings do most of the work. Apply globally:

```css
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: 'cv11', 'ss01';
}
```

`cv11` and `ss01` are Inter's alternate glyph sets — single-storey `a`, straight-tailed `l` — which is precisely what separates it from a generic web sans and lands it near SF Pro. Without these, Inter looks like every other interface font.

### 3.2 Scale

| Token | Size | Weight | Letter-spacing | Use |
|---|---|---|---|---|
| `--font-xl` | 28px | 700 | −0.02em | h1 — page title |
| `--font-lg` | 20px | 600 | −0.01em | h2 — section heading |
| `--font-md` | 16px | 600 | 0 | h3 — card title |
| `--font-base` | 15px | 400 | 0 | Body |
| `--font-sm` | 13px | 400 | 0 | Table cells, secondary |
| `--font-xs` | 12px | 500 | 0.04em | Eyebrows, column headers, badges |

Weights: **400** body · **500** emphasis and small caps · **600** headings and buttons · **700** h1 and KPI values. Nothing else. No 300, no 800.

Negative tracking on large sizes only. Positive tracking on `--font-xs` uppercase only. Body text is never tracked.

### 3.3 Line height

`--leading-tight: 1.2` headings · `--leading-base: 1.5` body · `--leading-loose: 1.7` accessible-mode body.

### 3.4 Eyebrows

Small uppercase labels above sections and inside KPI cards:

```
font-size: 12px · weight: 500 · letter-spacing: 0.06em
text-transform: uppercase · color: var(--text-muted)
```

---

## 4. Space, edges, elevation

### 4.1 Spacing

8px base unit. Every margin, padding, and gap is a multiple.

```
--space-1: 4px    --space-2: 8px    --space-3: 12px   --space-4: 16px
--space-5: 24px   --space-6: 32px   --space-7: 48px   --space-8: 64px
```

Nothing between. No 10px, no 15px, no 18px. Arbitrary spacing is the single loudest tell of generated layout.

### 4.2 Edges

```css
--radius: 0;
--radius-pill: 999px;   /* status badges only */
```

`--radius` is zero and there is no third value. If a component appears to need a small radius, it does not.

### 4.3 Elevation

Flat by default. Depth is rationed.

| Token | Value | Use |
|---|---|---|
| `--shadow-none` | `none` | Default for everything |
| `--shadow-raised` | `0 1px 2px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.04)` | Hover lift on cards and rows |
| `--shadow-modal` | `0 8px 32px rgba(0,0,0,.12)` | Modals only |
| `--glow-focus` | `0 0 0 3px rgba(179,40,33,.14)` | Keyboard focus ring |
| `--glow-hover` | `0 0 0 3px rgba(0,0,0,.05)` | Subtle hover ring |

Cards, tables, inputs, and buttons carry **no shadow at rest**. Separation comes from a `1px solid var(--border)` hairline.

---

## 5. Icons

Lucide, outline only. Lucide ships no filled variants, which is why it was chosen — the wrong option is not available.

| Property | Value |
|---|---|
| Stroke width | `1.75` |
| Size — table actions | 18px |
| Size — navbar, buttons | 20px |
| Size — inline with text | 16px |
| Color | `currentColor`, always |

### 5.1 Rules

**No containers.** No tinted square, no circle, no background, no border. The glyph sits directly on the surface.

**Fix the baseline gap.** Inline SVG sits on the text baseline and leaves a few stray pixels beneath — the exact misalignment that makes generated interfaces look slightly wrong. Every icon gets `display: block`. Icons beside text sit in a flex container with `align-items: center`.

**Optical centering.** Icon-only buttons are a fixed square with the icon flex-centered. Never rely on padding to center a glyph.

**One icon per meaning, system-wide.** `Trash2` is delete everywhere. `Pencil` is edit everywhere. `Eye` is view everywhere. A second icon for the same action is a bug.

### 5.2 KPI watermark

The one place an icon is large. Positioned absolutely against the card's right edge, vertically centered, cropped by `overflow: hidden`:

```
size: 96px · stroke-width: 1.25 · color: currentColor
opacity: .07 · pointer-events: none · z-index: 0
```

Card content sits at `z-index: 1` and reads over it. No container, no tint, no gradient. The value overlaps the watermark — that overlap is the effect.

---

## 6. Buttons

Sharp corners. Label centered. Groups right-aligned.

### 6.1 The two classes

**Labeled buttons carry their semantic color at rest.** A delete button reads as destructive before contact. Hover deepens the fill.

**Icon-only buttons in table rows are neutral at rest and colorize on hover.** The glyph already carries the meaning; a row of four saturated icons on every row would make the table unreadable. Color is reinforcement.

This split is deliberate: it satisfies hover-reveal where color is decorative, and preserves at-rest recognition where the stakes are real.

### 6.2 Labeled buttons

| Class | Rest | Hover |
|---|---|---|
| `.primary-btn` | `--ink` fill, white text | `#000` |
| `.secondary-btn` | White fill, `--border-strong` hairline, `--text` | `--surface` fill |
| `.ghost-btn` | Transparent, `--text-muted` | `--surface` fill, `--text` |
| `.wide-create-btn` | `--green` fill, white text | `#186040` |
| `.wide-edit-btn` | `--amber` fill, white text | `#94610F` |
| `.wide-delete-btn` | `--danger` fill, white text | `#7F1616` |
| `.wide-view-btn` | `--blue` fill, white text | `#173F6E` |

```
height: 36px · padding: 0 16px · font: 14px/600
border-radius: 0 · transition: 120ms ease-out
```

### 6.3 Icon-only buttons

| Class | Rest | Hover |
|---|---|---|
| `.icon-view-btn` | `--text-muted` | `--blue` + `--blue-tint` bg |
| `.icon-edit-btn` | `--text-muted` | `--amber` + `--amber-tint` bg |
| `.icon-delete-btn` | `--text-muted` | `--danger` + `--danger-tint` bg |
| `.icon-create-btn` | `--text-muted` | `--green` + `--green-tint` bg |
| `.remove-btn` | `--text-faint` | `--danger`, no bg |

```
width: 32px · height: 32px · display: flex · centered
```

### 6.4 States

**Disabled** — `--surface-2` fill, `--text-faint`, `cursor: not-allowed`, no hover.
**Loading** — label replaced by a 14px spinner; width held to prevent layout shift.
**Focus** — `--glow-focus` ring. Never removed, never replaced by an outline reset.

### 6.5 Placement

Right-aligned in modal footers, page headers, and toolbars. Order: destructive leftmost, cancel center, confirm rightmost. Confirm is the rightmost element on screen — the shortest travel from where the eye ends.

---

## 7. Tables

Borderless, in the manner of a macOS file list. No grid, no outer frame, no vertical rules.

### 7.1 Anatomy

```
┌─────────────────────────────────────────────────────────┐
  NAME              CATEGORY      PRICE    STATUS      ⋯
 ─────────────────────────────────────────────────────────
  1pc Fried Chicken  Chicken      ₱89.00   ( Available )  👁 ✎ 🗑
  2pc Fried Chicken  Chicken     ₱159.00   ( Available )  👁 ✎ 🗑
  Whole Chicken      Chicken     ₱399.00   ( Sold out  )  👁 ✎ 🗑
└─────────────────────────────────────────────────────────┘
```

| Part | Spec |
|---|---|
| Outer border | **None** |
| Header background | `--cream` |
| Header text | `--font-xs`, uppercase, 500, `--text-muted` |
| Header rule | `1px solid var(--border-strong)` below, nothing else |
| Vertical rules | **None, anywhere** |
| Row separators | **None** — zebra instead |
| Zebra | Even rows `--surface` |
| Row height | 44px standard, 52px comfortable |
| Cell padding | `0 16px` |
| Row hover | `--cream-deep`, 120ms |

### 7.2 Alignment

- Text and identifiers: **left**
- Numbers, currency, counts: **right**, tabular figures (`font-variant-numeric: tabular-nums`)
- Dates: left
- Status badges: left within their column
- Actions: **right**, always the final column

### 7.3 Actions column

Icon-only. No text labels, ever. Fixed width so icons align down the column regardless of row content. Maximum three actions — a fourth goes into an overflow menu.

Order is invariant system-wide: **view → edit → delete**, left to right.

### 7.4 Empty and loading

**Empty** — centered in the table body: one line of plain text stating what is absent, and a `.wide-create-btn` when creation is the obvious next step. No illustration, no icon, no apology.

**Loading** — three skeleton rows at `--surface`, no shimmer animation.

### 7.5 Variants

`.data-table` standard · `.compact-table` 36px rows for dense admin views · `.queue-table` 52px rows, kitchen display, no zebra, priority rows carry a 3px `--red` left edge.

---

## 8. KPI cards

Sharp. One hairline. Right-aligned content. Watermark icon.

```
┌───────────────────────────────┐
│                               │
│           ORDERS TODAY    ╱▔▔ │
│                  248     ▕ ▉  │
│         ▲ 12% vs yesterday ▔▔ │
│                               │
└───────────────────────────────┘
```

| Part | Spec |
|---|---|
| Background | `--bg` |
| Border | `1px solid var(--border)` |
| Radius | 0 |
| Padding | `--space-5` |
| Min height | 120px |
| Content alignment | **Right** |
| Label | eyebrow style, `--text-muted` |
| Value | `--font-xl`, 700, `--text`, tabular figures |
| Delta | `--font-sm`, 500 — `--green` up, `--danger` down |
| Watermark | §5.2 |
| Hover | `--shadow-raised`, 120ms |

The card itself sits in a normal left-to-right grid. Only the text *inside* is right-aligned.

Grid: 4 across desktop, 2 tablet, 1 phone, `--space-4` gap.

---

## 9. Status badges

The only rounded element in the system.

```
border-radius: var(--radius-pill)
height: 22px · padding: 0 10px
font: 12px/500 · letter-spacing: .02em
background: <status>-tint · color: <status>
border: none
```

Sentence case. Never uppercase, never all-caps — the pill shape already does the differentiating.

### 9.1 Assignments

| Domain | Value | Color |
|---|---|---|
| Order | Pending | grey |
| | Preparing | amber |
| | Ready | green |
| | Completed | blue |
| | Abandoned | grey |
| | Voided | red |
| Payment | Pending | amber |
| | Paid | green |
| | Failed | red |
| Table | Vacant | grey |
| | Occupied | blue |
| | Reserved | violet |
| Priority | Senior | violet |
| | PWD | blue |
| | Pregnant | orange |
| | Standard | grey |
| Menu | Available | green |
| | Sold out | grey |
| Session | Active | green |
| | Ended | grey |

**Color is never the only carrier.** Every badge shows its label. A color-blind user reads the word.

---

## 10. Modals

Header / body / footer. No X.

```
┌─────────────────────────────────────┐
│ ▪ Edit Menu Item                    │  cream header
├─────────────────────────────────────┤
│                                     │
│  Name        [                   ]  │  white body
│  Category    [ Chicken          ▾]  │
│  Price       [ ₱               ]    │
│                                     │
├─────────────────────────────────────┤
│              [ Cancel ] [  Save  ]  │  white footer
└─────────────────────────────────────┘
```

| Part | Spec |
|---|---|
| Backdrop | `rgba(0,0,0,.35)`, `backdrop-filter: blur(2px)` |
| Container | `--bg`, `--shadow-modal`, radius 0 |
| Width | 480px small · 640px default · 880px large |
| Header | `--cream` bg, `--space-4 --space-5` pad, `1px solid var(--border)` below |
| Header title | `--font-md`, 600, preceded by the 6px `--red` seal square |
| Body | `--bg`, `--space-5` pad, scrolls past 60vh |
| Footer | `--bg`, `1px solid var(--border)` above, buttons **right-aligned** |

### 10.1 No X button

Dismissal has three paths, all of which must work:

1. **Cancel / Exit** in the footer — the primary, visible path
2. **Esc** key
3. **Backdrop click**

Removing the X is a visual decision, not a behavioral one. Removing all three would trap the user and violate user control and freedom.

**Exception:** destructive confirmations disable backdrop-click. An accidental click outside must not resolve a delete. Esc and Cancel still work.

### 10.2 Destructive confirmation

Body states plainly what will be removed and that it cannot be undone. Confirm button is `.wide-delete-btn`. Cancel sits to its left and holds focus on open — the safe action is the default.

### 10.3 Motion

```
enter: 150ms ease-out — opacity 0→1, translateY 8px→0
exit:  120ms ease-in  — opacity 1→0
backdrop: 150ms opacity
```

No scale, no bounce, no spring. Focus traps inside the modal and returns to the trigger on close.

---

## 11. Shell — navbar and layout

Navbar, never a sidebar.

```
┌──────────────────────────────────────────────────────────┐
│ ▪ 沙县  Shaxian   Orders  Queue  Menu  Reports    EN ▾  ⏻ │
│                   ▔▔▔▔▔▔                                  │
└──────────────────────────────────────────────────────────┘
```

| Part | Spec |
|---|---|
| Background | `--cream` |
| Height | 56px |
| Border | `1px solid var(--border-strong)` below |
| Logo mark | `--red` seal square + wordmark, `--font-md`, 600, `--ink` |
| Items | `--font-base`, 500, `--text`, `0 --space-4` |
| Item hover | `--text` → `--ink`, background `--cream-deep` |
| **Active item** | text 600 `--ink`, **3px `--red` bar** flush to the navbar's bottom edge |
| Right cluster | language selector, staff identity, sign out |

Content sits on `--bg` with a max width of 1440px and `--space-6` horizontal padding.

Page header: h1 left, primary action right, `--space-6` below.

---

## 12. Forms

| Element | Spec |
|---|---|
| Label | `--font-sm`, 500, `--text`, `--space-2` below |
| Required marker | 6px `--red` seal square, after the label |
| Input | 38px, `1px solid var(--border-strong)`, radius 0, `--space-3` pad, `--font-base` |
| Focus | border `--ink`, `--glow-focus` ring |
| Error | border `--danger`, message below in `--font-sm` `--danger` |
| Disabled | `--surface-2` fill, `--text-faint` |
| Placeholder | `--text-faint` — hints only, never a substitute for a label |
| Select | Lucide `ChevronDown` right, 16px |
| Checkbox / radio | 18px, radius 0 (**including radio** — no exceptions), `--ink` when checked |

Labels sit above inputs, never beside. Vertical stacking survives accessibility mode and narrow phones without reflow.

---

## 13. Charts

Recharts. The brand's one saturated moment.

- Palette from §2.5, applied in order
- Gridlines `--surface-2`, horizontal only, no vertical
- Axis text `--font-xs`, `--text-muted`
- **No chart borders, no chart background fills**
- Direct series labels; no legend with colored dots
- Bars square-capped — no rounded bar tops
- Tooltips follow modal styling: cream header, white body, sharp, `--shadow-raised`
- Animation on mount only, 300ms, never on update

---

## 14. Motion

Three effects exist. There is no fourth.

| Effect | Duration | Easing | Applies to |
|---|---|---|---|
| Hover | 120ms | `ease-out` | Color, background, border, shadow |
| Glow | 160ms | `ease-out` | Focus and hover rings |
| Modal fade | 150ms in / 120ms out | `ease-out` / `ease-in` | Modals, toasts, the recommendation overlay |

Banned: page transitions, skeleton shimmer, bounce, spring, parallax, scroll-triggered reveals, animated numbers, spinners on anything but in-flight buttons.

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

---

## 15. Accessibility mode

Set `data-ui-mode="accessible"` on `<html>`. Every shared atom rescales automatically because every atom is built from tokens. See `CodeStructure.md` §5.5.

### 15.1 Token overrides

```css
[data-ui-mode="accessible"] {
  --font-xs:   16px;
  --font-sm:   18px;
  --font-base: 22px;
  --font-md:   26px;
  --font-lg:   30px;
  --font-xl:   38px;

  --leading-base: 1.7;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;

  --tap-target: 60px;

  --text:        #000000;
  --text-muted:  #333333;
  --border:      #767676;
  --border-strong: #000000;
}
```

### 15.2 Contrast

**Body text is near-black on white. Red is reserved for headings and large type only.**

`--red` on `--cream` measures roughly 4.2:1 — acceptable for large display type, below WCAG AA for body. In accessible mode a senior reads item descriptions at 22px, so red body text is not permissible. Brand red survives in accessible mode only as headings, the seal mark, and active indicators.

Every accessible-mode pairing must clear **7:1 (AAA)** for body and **4.5:1** for large text.

### 15.3 Structural overrides

```css
[data-ui-mode="accessible"] .menu-grid       { grid-template-columns: 1fr; }
[data-ui-mode="accessible"] .kpi-grid        { grid-template-columns: 1fr; }
[data-ui-mode="accessible"] .navbar-btn,
[data-ui-mode="accessible"] .primary-btn,
[data-ui-mode="accessible"] .icon-view-btn   { min-height: var(--tap-target); }
[data-ui-mode="accessible"] .kpi-watermark   { display: none; }
```

The watermark is hidden — decorative overlap reduces legibility at scale.

The whole layer stays under roughly sixty lines. **Never create a parallel `.accessible-*` class for an atom that already exists.**

### 15.4 Baseline, both modes

- Every interactive target ≥ 44px (60px accessible)
- Visible focus on every focusable element; focus order follows visual order
- Every icon-only button carries `aria-label`
- Color never the sole carrier of meaning
- Live regions announce order status changes
- Full keyboard operability — no mouse-only path anywhere

---

## 16. Customer interface

Shared tokens, separate components. A diner's phone is not an admin console: no navbar, no tables, no KPIs.

| Aspect | Treatment |
|---|---|
| Layout | Single column, phone-first, 100% width to 480px |
| Navigation | Fixed bottom bar — Menu · Cart · Status |
| Brand | Leans further in — `--cream` page background, `--red` category markers |
| Menu item | Full-width row: image left, name and price right-aligned, `.add-to-cart-btn` |
| Category tabs | Horizontal scroll, active tab carries the 3px `--red` bar |
| Cart | Line rows with `.qty-stepper` and `.remove-btn` |
| Recommendation overlay | Bottom sheet, sharp top edge, three items maximum, dismissible |
| Order status | Vertical stepper, current step marked by the `--red` seal square |
| Tap targets | 48px minimum, 60px accessible |

The customer surface is the one place cream may serve as a page background — a menu should feel like a menu. Working surfaces stay white.

**The recommendation overlay is the capstone element's visible face.** It appears only when two confusion signals fire concurrently (`ProjectOverview.md` §5.3), shows at most three items, always offers dismissal, and never blocks the menu beneath. An overlay that interrupts is a worse problem than the choice paralysis it was built to relieve.

---

## 17. HCI grounding

The research claims accessibility and reduced decision friction. These are the specific commitments that back it.

### 17.1 Nielsen's heuristics

| Heuristic | Implementation |
|---|---|
| Visibility of system status | Live WebSocket order status; queue position; toast on every write; loading states on in-flight buttons |
| Match with the real world | "Ready for pickup", not "status: 3". No system vocabulary in customer-facing copy |
| User control and freedom | Esc, backdrop, and Cancel on every modal; cart items removable to the last step; no forced flows |
| Consistency and standards | One canonical component per element; view→edit→delete order never varies |
| Error prevention | Destructive confirms; disabled rather than failing submits; unavailable items unselectable |
| Recognition over recall | Persistent navbar; icon plus label on primary actions; cart contents always visible |
| Flexibility and efficiency | Accessibility mode; three languages; group ordering; cashier fallback |
| Aesthetic and minimalist design | The whole restraint doctrine in §1 |
| Error recovery | Plain-language errors stating cause and next step; never a raw code |
| Help and documentation | Contextual help on the ordering screen; no manual required |

### 17.2 Fitts's Law

Tap targets scale with importance and with mode. Confirm sits at the far right of the footer — the shortest travel from where the eye lands. Bottom bar on phones puts navigation in thumb reach.

### 17.3 Hick's Law

**This is the theoretical basis of the capstone element.** Decision time rises with the number of options — which is exactly the 86.1% choice-paralysis finding. The interface answers it structurally:

- Category tabs partition the menu instead of presenting it whole
- Accessible mode caps four items per screen
- The recommendation overlay offers **three** items, never more
- Modal footers present at most three actions

### 17.4 Miller's Law

Navbar items capped at seven. Table action columns capped at three. Form sections capped at seven fields before a divider.

---

## 18. Interface voice

Copy is design material. Generic microcopy will make a disciplined layout read as generated.

- **Sentence case everywhere.** Not Title Case, not ALL CAPS — except the `--font-xs` eyebrow.
- **Buttons name their outcome.** "Save changes", not "Submit". "Place order", not "Confirm".
- **A verb keeps its name through the flow.** The button says "Place order"; the toast says "Order placed".
- **Errors state cause and remedy.** "That table is already in a session. Scan a different table." Never "An error occurred."
- **Empty states invite.** "No menu items yet. Add your first item to get started."
- **No apologies, no exclamation marks, no emoji, no filler.** Never "Oops!", never "Please note that".
- **Currency always `₱`, always two decimals, always tabular figures.**

---

## 19. Anti-slop checklist

Before any screen is considered done:

- [ ] No rounded corners anywhere except status badges
- [ ] No icon inside a container, tinted square, or circle
- [ ] No shadow on a resting card, button, input, or table
- [ ] No gradient, no glassmorphism, no neon
- [ ] Every spacing value a multiple of 8px
- [ ] Every color from a token — no literal hex in a component
- [ ] Every size from a token
- [ ] Icons `display: block`, no baseline gap
- [ ] Actions right-aligned; view→edit→delete order intact
- [ ] Table has no vertical rules and no outer border
- [ ] KPI text right-aligned; watermark present, uncontained
- [ ] Modal has no X; Esc and backdrop both work
- [ ] Only the three permitted animations
- [ ] Brand red used as identity, never as a button fill
- [ ] Every icon-only control has `aria-label`
- [ ] Focus visible on every interactive element
- [ ] No emoji, no exclamation marks
- [ ] Contrast verified in both modes

---

## 20. What lives elsewhere

| Topic | File |
|---|---|
| What the system is and why | `ProjectOverview.md` |
| Tables, columns, seeds | `Database.md` |
| Where styles live; class naming; CSS layering | `CodeStructure.md` |
| Auth, hardening, secrets | `Security.md` |
| **What to build right now** | **`Instructions.md`** |

---

## 21. Questions and clarifications — REQUIRED BEFORE YOU BUILD

**Do not begin building assuming this system is complete.**

Visual inconsistency compounds: one rounded card, one contained icon, one 10px margin, and the discipline that makes this design distinctive is gone. **Ask first.**

### 21.1 Known open items — raise these, do not guess

1. **Logo asset.** No wordmark or logo file has been supplied. The navbar mark is described but not provided.
2. **Menu photography.** Item images are referenced throughout with no source confirmed. Placeholder treatment is undefined.
3. **Customer UI screens.** §16 sets direction only. Full screen-by-screen layouts are not yet designed and will be specified separately.
4. **Chart inventory.** Which specific charts the admin dashboard shows is not defined.
5. **Bisaya and Filipino string lengths.** Translations frequently run longer than English; button and label widths have not been tested against them.
6. **Toast placement.** Position and duration are unspecified.

### 21.2 Raise anything else that is

- Ambiguous, or open to more than one reasonable reading
- Contradictory between this file and `CodeStructure.md` or `ProjectOverview.md`
- Structurally required but absent — a component or state you would otherwise have to invent
- In tension with §15 contrast requirements or the §19 checklist

**Do not silently invent visual values.** Every color, size, and spacing value comes from a token defined here. If a value is missing, ask for it rather than choosing one.

---

## 22. Confirmation required before proceeding

**Before writing a single component or stylesheet, reply to the author confirming the following. Then stop and wait for approval.**

1. **Do you understand the design thesis** — Shaxian cream and red as *identity*, applied in small deliberate places, while every working surface stays white or near-white?

2. **Do you understand that `--radius` is zero everywhere**, and that the status badge pill is the **only** rounded element in the entire system?

3. **Do you understand the two button classes** — labeled buttons carry semantic color **at rest**, icon-only table actions are neutral at rest and colorize **on hover** — and that brand red is **never** a button fill?

4. **Do you understand the table specification** — no outer border, no vertical rules, cream header, zebra rows, right-aligned icon-only actions in invariant view→edit→delete order?

5. **Do you understand the KPI card** — right-aligned text, and a large low-opacity Lucide **watermark** cropped by the right edge, with **no container, no tint square, no small left-side icon**?

6. **Do you understand modals** — cream header with the seal square, white body, white footer with right-aligned buttons, **no X**, and dismissal via footer button, Esc, and backdrop click?

7. **Do you understand accessibility mode** — token overrides only, body text near-black on white, red restricted to headings and large type, and that parallel `.accessible-*` classes are forbidden?

8. **Do you understand the motion budget** — hover, glow, and modal fade, and nothing else?

9. **Do you understand the icon rules** — Lucide outline at 1.75 stroke, `currentColor`, `display: block`, and **never inside a container**?

10. **Do you understand the anti-slop checklist in §19** and that it is a gate every screen must pass, not a suggestion?

11. **Do you have any questions from §21.1**, or anything else unclear?

Please answer these explicitly, list any questions, and **wait for a human reply before writing any components or styles.**
