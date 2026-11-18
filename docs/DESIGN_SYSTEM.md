# Design system — Laced

Last updated: 2026-11-16. Monochrome and data-first: near-black panels with hairline borders, white as the one highlight, grey charts. Color appears only where it carries meaning (status, and up or down). Dark is the default; light mode is a toggle. One system serves the front desk, the owner dashboard, and the planned gym-goer app. Contrast numbers below were **computed** (WCAG 2 ratio). Anything not listed as measured has not been measured.

## 1. Principles

1. **Few buttons.** The owner is about 30–40 and wants straightforward. One primary action per screen. Everything else is secondary or folded away.
2. **The status is the biggest thing on the check-in screen.** Active, Expiring, Expired are read at a glance, across a counter.
3. **Phone first, gym-floor conditions.** Bright and dim rooms, one thumb, tired eyes. Tap targets 48px or larger, high contrast, numeric keypad for phone numbers.
4. **Calm and monochrome.** This is a work tool. No colored gradients, no glass or blur, no bounce. The only decoration is a faint light falling from the top edge of the page and of dashboard panels.
5. **Never color alone.** Every status has an icon and a text label.
6. **Every number agrees.** One filter row scopes every panel below it.

## 2. Color tokens

The tokens live in `src/index.css` as CSS variables and are exposed to Tailwind there (`bg-card`, `text-ink-2`, `border-line`, and so on). Change a color in that file only. Dark values are on `:root`; light values apply when `<html>` has `data-theme="light"`. The choice is saved on the device (`src/lib/theme.ts`).

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `bg` | `#09090B` | `#ECECEE` | page |
| `card` | `#121214` | `#F7F7F8` | panels, sidebar, tab bar, sheets |
| `raised` | `#1C1C20` | `#E2E2E6` | selected nav item, avatars, tooltips |
| `ink` | `#F4F4F5` | `#09090B` | primary text |
| `ink-2` | `#A1A1AA` | `#52525B` | secondary text |
| `ink-3` | `#8B8B95` | `#63636C` | captions, axis labels |
| `line` | `#26262B` | `#D6D6DC` | hairline borders |
| `accent` / `on-accent` | `#FAFAFA` / `#09090B` | `#09090B` / `#FAFAFA` | primary button, selected pill |
| `good` / `good-bg` | `#4ADE80` / `#11241A` | `#166534` / `#DCEFE2` | Active, increase |
| `warn` / `warn-bg` | `#E9B949` / `#2A2210` | `#92590A` / `#F5E8CC` | Expiring |
| `bad` / `bad-bg` | `#F87171` / `#2C1516` | `#B91C1C` / `#F8DEDE` | Expired, decrease |
| `mark` | `#D4D4D8` | `#27272A` | chart line, hovered bar |
| `mark-soft` | `#71717A` | `#71717A` | chart bars |
| `grid` | `#222226` | `#E0E0E5` | chart gridlines |

The `sheen` utility adds the faint top light to a panel. It is decoration only.

### Measured contrast (WCAG 2)

| Pair | Dark | Light |
|---|---|---|
| ink on card / on page | 17.02 / 18.10 | 18.58 / 16.86 |
| secondary on card / on raised | 7.30 / 6.63 | 7.22 / 5.98 |
| caption on card / on page / on raised | 5.55 / 5.90 / 5.03 | 5.55 / 5.04 / 4.60 |
| primary button text on its fill | 19.06 | 19.06 |
| green on card / on its tint | 10.74 / 9.33 | 6.66 / 5.94 |
| amber on card / on its tint | 10.25 / 8.62 | 5.37 / 4.73 |
| red on card / on its tint | 6.76 / 6.19 | 6.04 / 5.08 |
| chart line on card | 12.66 | 13.91 |
| chart bars on card | 3.87 | 4.51 |

### Chart colors

- Charts are **single-series and grey**: the line and the hovered bar use `mark`, ordinary bars use `mark-soft`. Both clear 3:1 against the panel.
- There is no categorical palette yet. If a chart ever needs two series (for example cash and GCash), choose and validate the pair then, and add a legend.
- Status colors are never used as series colors.
- Part-to-whole across more than 3 items: use **ranked horizontal bars** in one tone. No pie or donut.

## 3. Typography and spacing

- **Inter** (variable, self-hosted through `@fontsource-variable/inter`, SIL Open Font License) with a system sans fallback. Three weights: 400 for text, 500 for labels, 600 for titles, figures, and buttons. Sentence case everywhere.
- Hero figure 48px/500, one per view, **proportional** figures. Stat value 26px/500. Body 14–16px. Captions 12px. Minimum 11px.
- `font-variant-numeric: tabular-nums` only in aligned columns (tables, axis ticks, money lists), never on large standalone numbers.
- Radius: 14px panels, 10px controls, fully rounded badges and filter pills. Hairlines 0.5–1px. Spacing in multiples of 4px. Group with spacing before adding borders.

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

**Navigation.** Destinations: **Dashboard · Check in · Members**, plus **Money** for the owner. On a phone they are a tab bar at the bottom, with a slim header holding the account, the theme toggle, and sign out. From tablet width up they move into a left sidebar. Desk screens stay in a narrow column at any width.

**Dashboard.** Title and the primary button "Check in a member". Three stat cards: collected today, check-ins today, expiring soon, each with a change against yesterday (arrow, amount, and the words "more" or "less"). For the owner only: one range filter (7, 14, 30 days) scoping a revenue area chart and a check-ins bar chart, each with a headline figure, a hover and keyboard tooltip, and a Table switch. Then the renewals due within 7 days. Staff see their own collections and no charts.

**Check in (staff).** Search field first (numeric keypad option). Result card: avatar initials, name, plan. **Large status block** with icon + text + date. One primary button: **Check in**, or **Renew ₱{price}** when expired. Below, one muted line for the next matching member. QR and NFC buttons appear next to search only when supported.

**Members.** Search and list. Profile: name, phone, status badge, membership history, payments, visit history, **Assign card**. Primary action **Renew** or **Sell plan**.

**Sell or renew (bottom sheet).** Plan list from `plans` (price shown, not editable). Method: Cash or GCash. GCash reference field appears only for GCash. Student plans show the "School ID checked" tick. One primary button with the amount: **Collect ₱950**.

**Money (owner) = the dashboard.** See section 8.

**Close today (staff).** Totals by method, counted-cash input, variance shown plainly. One button.

States for every screen: loading (hold the previous content at reduced opacity, no layout jump), empty, error, offline.

## 8. Owner dashboard spec (tablet and desktop widen the same layout)

Order, top to bottom:

1. **Filter row**, one row above everything: Last 7 days, Last 30 days, Last 12 weeks. Selected chip uses the `ink` fill, not blue (blue is reserved for the one primary button).
2. **Hero:** revenue for the range, 48px, with a small accent bar above the label, change vs the previous equal period (named, e.g. "vs previous 30 days"), and net after expenses.
3. **Three stat tiles:** Active members, Renewal rate, Check-ins per day. Each has a value and a signed delta with an arrow icon, colored by direction (all up-is-good).
4. **Revenue by payment method:** stacked columns, cash at the bottom, GCash on top. Daily columns for 7 and 30 days, weekly for 12 weeks. Legend always visible. Tooltip lists every series with the value first and the label second, plus total.
5. **When the gym is busiest:** 7 weekday rows × 16 hour columns (7 AM–10 PM start hours), 6-step sequential fill, closed Sunday hours left empty. Headline states the busiest slot and the quietest weekday-midday slot. Legend "Fewer visits … More visits".
6. **Revenue by plan:** ranked horizontal bars, one hue, value at the bar tip.
7. **Renewals due this week:** up to 4 rows (name, plan, "Ends in N days" with a clock icon, price), "+N more", and the **one primary button**.

**Mark specs.** Bars at most 24px thick, 4px rounded at the data end, square at the baseline. Lines 2px. Markers at least 8px with a 2px surface ring. 2px surface-colored gap between stacked segments and between touching bars (no stroke borders). Gridlines and axes are 1px solid hairlines, never dashed. Y ticks rounded; compact (`10K`) once the axis reaches 10,000. **Label selectively**, never a number on every point.

**Never.** Dual y-axes. Pie or donut charts. More than two categorical colors here. Text colored with a series color (text uses text tokens; a swatch beside it carries identity). Rainbow scales.

**Interaction.** Every chart has hover and keyboard-focus tooltips (a hit area larger than the mark), and a **Table** toggle that swaps the chart for an equivalent table. Tooltips enhance, never gate. Tooltip labels are inserted as text, never as HTML.

## 9. Accessibility

- Contrast as measured above. Status uses icon + text + color.
- Keyboard focus visible everywhere. Heatmap uses the table view as its accessible twin.
- Alt text on any image. Screen-reader summary for each chart. Respect `prefers-reduced-motion`.
- Large tap targets, numeric keypad for phone fields, one-thumb reach for primary actions.
