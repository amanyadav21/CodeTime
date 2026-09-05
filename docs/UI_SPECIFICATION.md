# CodePulse — UI Specification

Version: 0.1
Scope: V1

This document describes every UI surface for V1: the sidebar dashboard, the status bar item, and notifications.

---

## 1. Design Principles

- **Premium** — generous whitespace, careful typography, restrained colour.
- **Minimal** — every element earns its place.
- **IDE-native** — respects VS Code theme tokens; reads `prefers-reduced-motion`.
- **Non-intrusive** — never steals focus.
- **Accurate** — labels say exactly what is shown.

## 2. Sidebar Dashboard

### 2.1 Purpose

The single primary surface. Lives in the activity bar under the brand icon. Always shows the current state without requiring interaction.

### 2.2 Layout (top to bottom)

```
CODEPULSE
─────────────────
[ state icon ] 01:42:18
ACTIVE CODING
─────────────────
🔥 COMBO × 8
─────────────────
TODAY'S GOAL
2h 18m / 4h
██████████░░░░ 57%
─────────────────
CURRENT SESSION      42m
BEST SESSION         1h 31m
SESSIONS TODAY       6
─────────────────
🔥 7 DAY STREAK
```

### 2.3 Component Spec

#### Header

- **Purpose**: Brand and identity.
- **Content**: "CODEPULSE" wordmark, uppercase, tracking-wide.
- **States**: static.

#### Timer Card

- **Purpose**: Primary metric. Today's active coding time.
- **Content**:
  - State icon (`⚡` ACTIVE, `⏸` PAUSED, `○` IDLE).
  - Duration `HH:MM:SS` (or `MM:SS` under 1 h) formatted with locale-aware grouping.
  - Label below: "ACTIVE CODING".
- **States**:
  - **Idle**: dimmer text; no animation.
  - **Active**: subtle pulse on the icon (200 ms ease-in-out, paused when `prefers-reduced-motion`).
  - **Paused**: icon static; label switches to "PAUSED".

#### Combo Card

- **Purpose**: Show flow momentum.
- **Content**: `🔥 COMBO × N` where `N` is the multiplier.
- **Animation**: When `N` increments, a 250 ms scale-up + fade of a transient ghost label "× N+1", then settles. Respects `prefers-reduced-motion`.
- **States**:
  - **No combo** (`N == 0`): muted text "COMBO —". Hidden entirely if `notifyOnSessionStart` is off and we want minimalism (decision per V1: keep visible but muted).

#### Daily Goal Card

- **Purpose**: Progress toward configured daily goal.
- **Content**:
  - "TODAY'S GOAL" header.
  - "X / Y" with both formatted as `Hh Mm`.
  - Progress bar with rounded ends, 6 px tall, animated fill.
  - Percentage label, right-aligned.
- **States**:
  - **Completed**: bar full; subtle ring glow. No confetti.

#### Stats Grid

- **Purpose**: At-a-glance daily stats.
- **Content**: three rows: current session, best session today, sessions today.
- **States**: loading: skeleton placeholders; empty: zeros; error: last known with a small "stale" tag.

#### Streak Card

- **Purpose**: Show streak.
- **Content**: `🔥 N DAY STREAK` (singular form when `N == 1`).
- **States**: at-risk (today not yet qualifying): show "STREAK: 6 — keep going today".

### 2.4 Inputs (Webview → Extension)

- `ready` — sent once on mount.
- `setGoal { minutes }`.
- `setStreakMinimum { minutes }`.
- `requestSnapshot` — used after a long disconnection.

### 2.5 Outputs (Extension → Webview)

- `snapshot` — full `EngineSnapshot`, 1 Hz.
- `notification` — UI-only cue (not the OS notification); used for combo / goal / streak transitions.

### 2.6 Loading State

- Skeleton blocks for the timer, combo, goal, and stats. Rendered within ~50 ms of `ready`.

### 2.7 Empty State

- When no sessions today: timer shows `00:00:00`, stats show `0`, goal shows `0 / goal`. No empty illustration — empty state should feel intentional, not apologetic.

### 2.8 Error State

- If a snapshot fails to parse (should not happen given server validation): render the last known good snapshot with a small "stale" badge and a "Reload" button.

### 2.9 Responsive Behaviour

- The webview is rendered in a narrow sidebar (~280–360 px wide). Layout is single column.
- On wider debug surfaces (DevTools), the layout remains single column to preserve design intent.

### 2.10 Accessibility

- All interactive elements are buttons or labelled controls with `aria-label`.
- Colour contrast meets WCAG AA against VS Code's default dark and light themes.
- Animations respect `prefers-reduced-motion`.
- Combo, streak, and goal copy do not rely on colour alone — text is always present.

---

## 3. Status Bar Item

### 3.1 Purpose

Compact, always-visible state indicator.

### 3.2 Layout

Single text item aligned right at low priority:

```
⚡ 01:42:18    (ACTIVE)
⏸ 01:42:18    (PAUSED)
○ 00:00:00    (IDLE)
```

### 3.3 Tooltip

Hover tooltip shows:

- Today's active coding time.
- Current session duration (if any).
- Combo multiplier.
- Daily goal progress.
- Streak count.
- "Click to open CodePulse dashboard" hint.

### 3.4 Click Behaviour

- Opens / focuses the sidebar dashboard view.

### 3.5 States

- **Idle**: muted icon, regular time text.
- **Active**: bright icon, regular time.
- **Paused**: paused icon, regular time.

### 3.6 Accessibility

- Tooltip text is plain text — readable by screen readers.
- Icon is purely decorative; meaning carried by tooltip.

---

## 4. Notifications

### 4.1 Purpose

Surface milestone moments without being intrusive.

### 4.2 Kinds

| Kind | Trigger | Text | Default |
| --- | --- | --- | --- |
| `sessionStarted` | First `IDLE → ACTIVE` of the day | "CodePulse — Coding session started" | off |
| `comboMilestone` | Multiplier reaches 1, 2, 3, 4, 5, 6 | "CodePulse — Combo × N" | off (UI animation only; no OS notification to avoid spam) |
| `goalReached` | `todayActive ≥ goal` for the day | "CodePulse — Daily goal reached" | on |
| `streakMilestone` | Streak reaches 3, 7, 14, 30, 60, 100 | "CodePulse — N day streak" | on |

### 4.3 Anti-Spam Policy

- At most one notification per `kind` per session / per day.
- The notifier deduplicates with an in-memory set keyed by `(kind, scopeId)`.
- No notification may fire while the editor is in full-screen / Zen mode (best-effort check).

### 4.4 Accessibility

- Notifications use `Information` severity — never modal, never blocking.
