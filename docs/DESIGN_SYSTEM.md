# Design system — Laced

Last updated: 2026-11-16. A restrained palette: deep navy ink, warm off-white, and one muted gold accent. Dark mode is a separately tuned set, not an inversion. Contrast numbers below were **computed** (WCAG 2 ratio). Anything not listed as measured has not been measured.

## 1. Principles

1. **Few buttons.** The owner is about 30–40 and wants straightforward. One primary action per screen. Everything else is secondary or folded away.
2. **The status is the biggest thing on the check-in screen.** Active, Expiring, Expired are read at a glance, across a counter.
3. **Phone first, gym-floor conditions.** Bright and dim rooms, one thumb, tired eyes. Tap targets 48px or larger, high contrast, numeric keypad for phone numbers.
4. **Calm.** This is a work tool. No moving backgrounds, no glass/blur, no bounce, no gradients, no decorative shadows.
5. **Never color alone.** Every status has an icon and a text label.
6. **Every number agrees.** One filter row scopes every panel below it.

## 2. Color tokens

Gold is the **accent for the one primary action and small highlights**. It is **never used for text or thin lines on a light surface** (2.33:1 on white). Navy text sits on gold.

The tokens live in `src/index.css` as CSS variables and are exposed to Tailwind there (`bg-card`, `text-ink-2`, `border-line`, and so on). Change a color in that file only.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F4F4F2` | `#0B0F18` | page |
| `card` | `#FFFFFF` | `#131926` | cards, sheets |
| `ink` | `#0E1726` | `#ECEEF2` | primary text |
| `ink-2` | `#525B6B` | `#A2AABA` | secondary text |
| `ink-3` | `#6A7282` | `#8891A3` | captions, **on cards only in light mode** |
| `line` | `#E4E5E1` | `#242C3D` | hairline borders |
| `bar` / `on-bar` | `#0E1726` / `#FFFFFF` | `#0B0F18` / `#ECEEF2` | top bar |
| `accent` / `on-accent` | `#D4A23A` / `#0E1726` | `#D4A23A` / `#0B0F18` | primary button |
| `good` / `good-bg` | `#1B5E3A` / `#E3F0E7` | `#7FD4A0` / `#12281D` | Active |
| `warn` / `warn-bg` | `#8A4A12` / `#F6E9D8` | `#EDB67A` / `#33230F` | Expiring (brown-orange, not gold) |
| `bad` / `bad-bg` | `#8F2323` / `#F6E3E1` | `#F0A3A3` / `#351819` | Expired |

Follow `prefers-color-scheme` by default and allow a manual toggle through `data-theme` on the root element.

### Measured contrast (WCAG 2)

| Pair | Ratio |
|---|---|
| Light: ink on card / on page | 17.96 / 16.31 |
| Light: secondary on card / on page | 6.85 / 6.22 |
| Light: caption on card | 4.84 |
| Light: caption on page | **4.39 (below 4.5, so captions never sit directly on the page; use `ink-2` there)** |
| Light: navy on gold button | 7.72 |
| Light: gold on white | **2.33, never for text or thin lines** |
| Light: white on top bar | 17.96 |
| Light: green / brown / red status text on its tint | 6.60 / 5.72 / 6.99 |
| Dark: ink on page / on card | 16.50 / 15.13 |
| Dark: secondary on card / on page | 7.53 / 8.21 |
| Dark: caption on card / on page | 5.55 / 6.05 |
| Dark: gold on card | 7.56 |
| Dark: navy on gold button | 8.24 |
| Dark: green / orange / red status text on its tint | 8.78 / 8.34 / 8.08 |

### Chart colors

Only two categorical series exist: **Cash** and **GCash**. Color follows the entity: Cash is always blue, GCash is always gold-brown, in every chart and every filter state.

- Light, on white: `#3A57A8` and `#BA7F00` (contrast against the surface 6.76 and 3.43).
- Dark, on `#131926`: `#6F8AE0` and `#BC8A00` (5.35 and 5.67).
- These were chosen for an earlier version of the palette. **Before building charts, re-check color-blind separation between the two series** on the current surfaces.
- The accent gold is for buttons and highlights only, not chart marks.
- Heatmap and other magnitude scales are **single-hue sequential**, 6 steps, lighter = fewer in light mode. Light ramp (navy): `#E6EAF4 #C3CCE4 #97A6D0 #6479B4 #38529A #1B2B55`. The dark-mode ramp is **not chosen yet**; pick it when the heatmap is built.
- Part-to-whole across more than 3 items: use **ranked horizontal bars** in one hue (series 1). No pie or donut.
- Never reuse status colors as series colors.

## 3. Typography and spacing

- **Inter** (variable font, self-hosted through `@fontsource-variable/inter`, SIL Open Font License) with a system sans fallback, so Android and iPhone look the same. Two weights only: 400 and 500. Sentence case everywhere.
- Hero figure 48px/500, one per view, **proportional** figures. Stat value 26px/500. Body 14–16px. Captions 12px. Minimum 11px.
- `font-variant-numeric: tabular-nums` only in aligned columns (tables, axis ticks, money lists), never on large standalone numbers.
- Radius: 12px cards, 8–10px controls. Hairlines 0.5–1px. Spacing in multiples of 4px. Group with spacing before adding borders.

## 4. UI rules

- Delete filler badges and redundant labels. No random uppercase text. Mono font only where needed.
- Use one design system (this one). Show the actual product, not decoration.
- Enlarge the main feature of each screen. Make headlines specific ("Busiest: Mon 6 PM", not "Insights").
- Emphasize the CTA. One accent color. Consistent icon style (outline). Inner radius = outer radius − padding.
- Improve text contrast. Wrap headlines properly. Align by eye, not just by pixels. Use tabular numbers in columns.
- Add loading states. Animate only to give useful feedback.
- Dashboard: group elements, fold unimportant sections, make the primary button's label contextual ("Review 9 renewals", "Close today: ₱6,840"). A command bar and frosted-glass panels were in the inspiration but are **not** used here (owner wants simple).

## 5. Motion

- Entrances ease-out. Small UI 150–250ms. Exits about 20% shorter than entrances.
- Press feedback: scale to 0.97.
- Stagger list rows by about 30ms.
- Success check-in: one small pulse on the status block.
- No bounce on everyday UI. Respect `prefers-reduced-motion`.

## 6. Microcopy

- Sentence case. Verb-first buttons, 1–3 words: **Check in**, **Renew ₱850**, **Day pass ₱85**, **Close today**.
- No "please", no "successfully", no "!" on system copy.
- Errors say what happened and what to do: "That phone number's already registered. Search for the member instead."
- Empty states invite: "No renewals due this week." with a clear next step, not "Nothing here yet."
- Placeholders are real examples: `09171234567`.
- Peso format: `₱6,840`. Dates in the gym's local style, `Mon, Nov 16`.

## 7. Screens (mobile first, portrait)

**Navigation.** Bottom bar, at most 4 tabs: **Today · Check in · Members · Money**. Staff do not see Money (owner only). "Close today" is a staff action on the Today screen. Selected tab is stronger, not a different color family.

**Today (owner).** Top bar with the app name ("Laced" in the prototype) and date. Collected today (large). Two stat tiles: Check-ins, Expiring soon (outlined to draw the eye). One gold primary button with a contextual label, "Review 9 renewals". Nothing else on first view.

**Check in (staff).** Search field first (numeric keypad option). Result card: avatar initials, name, plan. **Large status block** with icon + text + date. One primary button: **Check in**, or **Renew ₱{price}** when expired. Below, one muted line for the next matching member. QR and NFC buttons appear next to search only when supported.

**Members.** Search and list. Profile: name, phone, status badge, membership history, payments, visit history, **Assign card**. Primary action **Renew** or **Sell plan**.

**Sell or renew (bottom sheet).** Plan list from `plans` (price shown, not editable). Method: Cash or GCash. GCash reference field appears only for GCash. Student plans show the "School ID checked" tick. One primary button with the amount: **Collect ₱950**.

**Money (owner) = the dashboard.** See section 8.

**Close today (staff).** Totals by method, counted-cash input, variance shown plainly. One button.

States for every screen: loading (hold the previous content at reduced opacity, no layout jump), empty, error, offline.

## 8. Owner dashboard spec (tablet and desktop widen the same layout)

Order, top to bottom:

1. **Filter row**, one row above everything: Last 7 days, Last 30 days, Last 12 weeks. Selected chip uses the `ink` fill, not gold (gold is reserved for the one primary button).
2. **Hero:** revenue for the range, 48px, with a small gold accent bar above the label, change vs the previous equal period (named, e.g. "vs previous 30 days"), and net after expenses.
3. **Three stat tiles:** Active members, Renewal rate, Check-ins per day. Each has a value and a signed delta with an arrow icon, colored by direction (all up-is-good).
4. **Revenue by payment method:** stacked columns, cash at the bottom, GCash on top. Daily columns for 7 and 30 days, weekly for 12 weeks. Legend always visible. Tooltip lists every series with the value first and the label second, plus total.
5. **When the gym is busiest:** 7 weekday rows × 16 hour columns (7 AM–10 PM start hours), 6-step sequential fill, closed Sunday hours left empty. Headline states the busiest slot and the quietest weekday-midday slot. Legend "Fewer visits … More visits".
6. **Revenue by plan:** ranked horizontal bars, one hue, value at the bar tip.
7. **Renewals due this week:** up to 4 rows (name, plan, "Ends in N days" with a clock icon, price), "+N more", and the **one primary gold button**.

**Mark specs.** Bars at most 24px thick, 4px rounded at the data end, square at the baseline. Lines 2px. Markers at least 8px with a 2px surface ring. 2px surface-colored gap between stacked segments and between touching bars (no stroke borders). Gridlines and axes are 1px solid hairlines, never dashed. Y ticks rounded; compact (`10K`) once the axis reaches 10,000. **Label selectively**, never a number on every point.

**Never.** Dual y-axes. Pie or donut charts. More than two categorical colors here. Text colored with a series color (text uses text tokens; a swatch beside it carries identity). Rainbow scales.

**Interaction.** Every chart has hover and keyboard-focus tooltips (a hit area larger than the mark), and a **Table** toggle that swaps the chart for an equivalent table. Tooltips enhance, never gate. Tooltip labels are inserted as text, never as HTML.

## 9. Accessibility

- Contrast as measured above. Status uses icon + text + color.
- Keyboard focus visible everywhere. Heatmap uses the table view as its accessible twin.
- Alt text on any image. Screen-reader summary for each chart. Respect `prefers-reduced-motion`.
- Large tap targets, numeric keypad for phone fields, one-thumb reach for primary actions.
