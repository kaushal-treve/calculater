# Calculator — Precision Instrument

A modern, accessible calculator web app built with plain **HTML, CSS, and vanilla JavaScript** — no frameworks, no build step, no dependencies beyond a Google Fonts stylesheet link. Open `index.html` and it runs.

![Calculator screenshot placeholder](screenshot.png)
*(Replace `screenshot.png` with an actual screenshot of the app before publishing.)*

## Overview

This calculator was designed around a "precision instrument" aesthetic — a machined, keycap-driven control panel rather than a generic glassmorphism card. Every button presses down like a physical key, the readout mimics an LCD register with a blinking cursor, and the whole app runs on ~0 KB of JavaScript dependencies.

## Features

**Core arithmetic**
- Addition, subtraction, multiplication, division
- Decimal numbers, with duplicate-decimal protection
- Percentage (`%`) — context-aware: `200 + 10%` behaves like a real percentage of the base value, while a standalone `50 %` simply divides by 100
- Positive / negative toggle (`+/−`)
- Clear all (`AC`) and delete-last-character (`⌫`)
- Operator chaining (`5 + 3 × 2` continues correctly without pressing `=` first)

**Error handling**
- Division by zero
- Invalid or empty expressions
- Consecutive operator presses (the newest operator simply replaces the pending one, matching standard calculator UX)
- Results too large to represent are reported as an error instead of silently breaking the display

**Keyboard support** — every on-screen action has a 1:1 keyboard shortcut:

| Key(s) | Action |
|---|---|
| `0`–`9` | Enter digits |
| `+` `-` `*` `/` | Operators |
| `%` | Percent |
| `.` | Decimal point |
| `Enter` or `=` | Calculate |
| `Backspace` | Delete last character |
| `Delete` or `Escape` | Clear all |

**Interface**
- Dark and light themes, toggled top-right, remembered via `localStorage`, with a system-preference fallback on first visit
- Fully responsive: phones, tablets, laptops, and desktops (CSS Grid + Flexbox)
- Keycap press animation, hover states, ripple effect on every button, smooth theme cross-fade, and a page fade-in on load
- Right-aligned display showing both the pending expression and the live result in a monospace, tabular-figure font
- Respects `prefers-reduced-motion`

**Bonus features included**
- **Calculation history panel** — click any past result to reload it into the display; clearable independently of the working calculation
- **Copy result** button — copies the current result to the clipboard with inline confirmation
- **Sound effect toggle** — tiny synthesized click via the Web Audio API (no audio files), independently toggleable and persisted
- **Memory register** — `MC` / `MR` / `M+` / `M−`, with a visible indicator when memory is non-zero

**Accessibility**
- Semantic HTML with landmark regions
- `aria-label`, `aria-pressed`, `aria-expanded`, and `aria-live` used appropriately throughout
- Visible, high-contrast focus rings for keyboard navigation
- Screen-reader-only live region announces errors and copy confirmations

## Technologies used

- HTML5 (semantic structure, ARIA)
- CSS3 (custom properties / design tokens, Grid, Flexbox, keyframe animations)
- JavaScript (ES6+, vanilla — no libraries or frameworks)
- [Google Fonts](https://fonts.google.com/): Inter (UI) and JetBrains Mono (numeric readout)

## Folder structure

```
calculator/
│
├── index.html      # Markup and structure
├── style.css       # Design tokens, layout, themes, animations
├── script.js       # Application state and logic
└── README.md        # This file
```

## Installation

No build tools, package managers, or dependencies to install. Clone or download the folder as-is:

```bash
git clone <your-repo-url>
cd calculator

## Future improvements

- Scientific mode (square root, exponents, parentheses, trig functions)
- Persist calculation history across sessions via `localStorage`
- Unit conversion mode
- Adjustable theme accent color picker
- Export history as CSV/PDF
- PWA support for offline use and "Add to Home Screen"
