# Check-In Design System (`DESIGN.md`)

> **Portable, AI-Ready Design Constitution & Component Architecture**  
> Drop this file into any prompt (with any product idea—**Landing Page**, **SaaS Dashboard**, **CRM**, **Admin Portal**, or **Mobile-First Web App**) and instruct the AI: *"Follow `DESIGN.md` strictly for visual tokens, layout shells, animations, and interaction patterns."*

---

## 1. AI Auto-Adaptation Router (Read First)

When a user provides this `DESIGN.md` alongside a product idea, **automatically classify the project type** from their prompt and select the matching architecture without inventing unrelated aesthetics:

| Project Type Detected | Primary Layout Shell | Navigation Pattern | Hero / Top Section | Core Surface Modules |
| :--- | :--- | :--- | :--- | :--- |
| **SaaS Dashboard / Analytics / Admin** | **Floating Island Shell** (Section 5A) | Floating top pill nav (`layoutId`) + left `52px` icon rail (`xl+`) + floating mobile bottom pill (`< xl`) | Page title (`28px` bold) + **Date Filter Pill Bar** (`Today`, `7D`, `Month`, `Pick Dates`) | **4-Card Pastel KPI Grid** (`#C9C3F5`, `#A9C8FA`, `#92E2B3`, `#F6E7A1`) + **9/3 Bento Grid** (Interactive Bar Chart + Deep Teal `#17807D` Fast-Action Card) + **Hybrid `DataTable`** |
| **CRM / Operations / Ledger / ERP** | **Floating Island Shell** (Section 5A) | Top pill nav (max 5–6 primary modules) + contextual **Segmented Sub-Tab Pills** (`layoutId`) inside pages | Summary KPI row + **Segmented Sub-Tab Switcher** + Inline `+ New` / Quick-Add modal triggers | **`DataTable`** (with search, inline `Select` filters, column picker, server/cached `Pagination`, `< md` mobile list cards) + **Inline `ConfirmDeleteButton`** (zero confirmation modals!) + **Split Detail Modals** |
| **Landing Page / Marketing / Product Launch** | **Floating Marketing Header** (Section 5B) | Centered floating glass/white pill navbar (`h-12 rounded-full`) with sliding `layoutId` anchor pill + `#D4F56B` primary CTA pill + theme toggle tile | **12-Col Split Hero Card** (`rounded-[28px] sm:rounded-[34px]`) with radial Lime/Mint/Sky glow + Deep Teal `#17807D` showcase card (left/right) | **Pastel Bento Feature Grid** (using the 4 pastel hues) + **Interactive Live Chart/Widget Preview** + **Deep Teal Pricing / Conversion Showcase** + **Minimal Floating Footer** |
| **Auth / Onboarding / Portal Gate** | **Centered Canvas Wrapper** (`#F2F4F4` / `#0F1113`) | Fixed top-right `40×40px` `rounded-[14px]` Theme Toggle tile | **12-Col Split Card** (`max-w-[1200px] lg:min-h-[680px] rounded-[28px] sm:rounded-[34px]`) | Deep Teal `#17807D` left showcase panel with top-right radial glow + clean `#F3F5F6` filled inputs & `#D4F56B` primary submit button on right |

### Non-Negotiable Cross-Project Rules
1. **Canvas-First Neutrality**: Never use stark `#FFFFFF` as the full-page background in light mode or pure `#000000` in dark mode. Always ground on **Canvas `#F2F4F4`** (dark `#0F1113`) and float **`#FFFFFF`** (dark `#181B1F`) surfaces above it.
2. **Minimalist Shadow Discipline**: Interactive pills, idle buttons, table badges, and inline action icons use **`shadow-none`** and rely on **1px hairline borders** (`#E3E6E8` / `#2A2F35`) and tonal fills (`#F3F5F6`, `#EDEEEF`). Soft shadows are reserved strictly for **floating navigation islands**, **hovering popovers/select menus**, **modals**, and **featured Deep Teal cards**.
3. **Electric Lime Focal Restraint**: Reserve **`#D4F56B`** (hover `#C9EE55`) strictly for the **single highest-priority CTA** per view, **active sidebar rail icon tiles**, **active pagination pills**, **primary form submit buttons**, and **unread count badges**. Never flood paragraphs or entire cards with lime.
4. **Apple-Style Bubble Physics Everywhere**: All buttons, nav tabs, pills, and toggles must use the spring press/rebound engine (Section 4). Active tab indicators must slide seamlessly via Framer Motion `layoutId`—never snap abruptly.
5. **Zero-Shift Inline Confirmations**: Destructive row/card deletes never open blocking `window.confirm()` dialogs or full modals. Use the **fixed-slot `ConfirmDeleteButton`** (Section 6.5) that morphs in place without shifting table column widths or row heights.

---

## 2. Visual Philosophy & Surface Hierarchy

This design system blends **calm Scandinavian utility** with **tactile Apple-inspired spring responsiveness**:

- **Tonal Layering (3 Levels)**:
  - **Level 0 — Page Canvas**: `#F2F4F4` (Light) / `#0F1113` (Dark)
  - **Level 1 — Floating Cards, Islands & Tables**: `#FFFFFF` (Light) / `#181B1F` (Dark) + `1px` border `#E3E6E8` / `#2A2F35`
  - **Level 2 — Recessed Wells, Inputs, Table Headers & Active Chips**: `#F3F5F6` / `#F8F9FA` / `#EDEEEF` (Light) / `#1F2328` / `#20242A` / `#272C33` (Dark)
- **Heroic Color Discipline**:
  - Neutral ink and off-white carry ~80% of screen real estate so data remains effortless to scan.
  - **Pastel KPI Cards** (`#C9C3F5` Lavender, `#A9C8FA` Sky, `#92E2B3` Mint, `#F6E7A1` Butter) intentionally keep **`#14161A` dark charcoal ink in both Light and Dark mode** so metric legibility stays high-contrast and cheerful.
  - **Deep Teal Showcase (`#17807D` / dark `#146B69`)** pairs crisp white copy with `#D4F56B` Electric Lime accents for primary calls to action and product/brand highlights.

---

## 3. Complete Design Tokens (Light & Dark)

### 3.1 Font Loading (`index.html`)
Load **`Plus Jakarta Sans`** (weights `400, 500, 600, 700, 800`) and pair with system monospace for aligned financial/numeric columns.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

### 3.2 CSS Custom Properties & Global Rules (`src/index.css`)
Copy this base block directly into any Tailwind v4 project:

```css
@import "tailwindcss";

@theme {
  --default-transition-duration: 220ms;
  --default-transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

@custom-variant dark (&:where(.dark, .dark *));

@layer base {
  :root {
    --color-canvas: #F2F4F4;
    --color-surface: #FFFFFF;
    --color-surface-subtle: #F3F5F6;
    --color-active-chip: #EDEEEF;
    --color-border-subtle: #E3E6E8;
    --color-border-strong: #D7DBDF;
    --color-ink: #14161A;
    --color-ink-secondary: #4A515B;
    --color-ink-muted: #636B76;
    --color-lime: #D4F56B;
    --color-lime-hover: #C9EE55;
    --color-pastel-lavender: #C9C3F5;
    --color-pastel-sky: #A9C8FA;
    --color-pastel-mint: #92E2B3;
    --color-pastel-butter: #F6E7A1;
    --color-card-teal: #17807D;
  }

  .dark {
    --color-canvas: #0F1113;
    --color-surface: #181B1F;
    --color-surface-subtle: #1F2328;
    --color-active-chip: #272C33;
    --color-border-subtle: #2A2F35;
    --color-border-strong: #373E47;
    --color-ink: #F2F4F5;
    --color-ink-secondary: #A3AAB3;
    --color-ink-muted: #8A929C;
    --color-lime: #D4F56B;
    --color-lime-hover: #C9EE55;
    --color-pastel-lavender: #C9C3F5;
    --color-pastel-sky: #A9C8FA;
    --color-pastel-mint: #92E2B3;
    --color-pastel-butter: #F6E7A1;
    --color-card-teal: #146B69;
  }

  html,
  body {
    overflow-x: clip;
    max-width: 100%;
  }

  body {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: var(--color-ink);
    background-color: var(--color-canvas);
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  /* Cross-browser Date/Time input normalization */
  input[type="date"],
  input[type="time"],
  input[type="datetime-local"] {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    display: block;
    box-sizing: border-box;
    -webkit-appearance: none;
    appearance: none;
  }

  input[type="date"]::-webkit-date-and-time-value {
    text-align: left;
    min-width: 0;
  }

  button:focus,
  button:focus-visible {
    outline: none;
  }
}

/* Prevent iOS Safari from auto-zooming on inputs smaller than 16px */
@media (max-width: 767px) {
  input:not([type="checkbox"]):not([type="radio"]),
  select,
  textarea {
    font-size: 16px !important;
  }
}

/* Minimalist thin scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.25);
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.45);
}
```

### 3.3 Color Token Reference Table

| Role | Light Value | Dark Value | Usage |
| :--- | :--- | :--- | :--- |
| **Page Canvas** | `#F2F4F4` | `#0F1113` | Root background behind all floating islands and cards |
| **Elevated Card / Island** | `#FFFFFF` | `#181B1F` | Top nav pill, left rail, KPI/chart/table cards, modals |
| **Subtle Surface / Input Fill** | `#F3F5F6` / `#F8F9FA` | `#1F2328` / `#20242A` | Search bars, inputs, `<thead>` rows, mobile card summary wells |
| **Active Pill / Chip Fill** | `#EDEEEF` | `#272C33` | Sliding active tab background (`layoutId`), icon button badges |
| **Border Subtle / Strong** | `#E3E6E8` / `#D7DBDF` | `#2A2F35` / `#373E47` | Hairline `1px` borders replacing heavy drop shadows |
| **Primary Ink** | `#14161A` | `#F2F4F5` | Headings, active nav labels, primary numbers |
| **Secondary / Muted Ink** | `#4A515B` / `#636B76` | `#A3AAB3` / `#8A929C` | Inactive tabs, table cells (`#636B76`), labels, subtitles |
| **Electric Lime CTA** | `#D4F56B` (hover `#C9EE55`) | `#D4F56B` (hover `#C9EE55`) | Primary action buttons, active rail icon tile, active page pill, text selection |
| **Deep Teal Showcase** | `#17807D` | `#146B69` | Featured Fast-Action card, Landing Hero/Auth showcase panel |
| **Pastel Card — Lavender** | `#C9C3F5` | `#C9C3F5` | Revenue / Sales / Primary Metric KPI & Revenue Chart Bars |
| **Pastel Card — Sky** | `#A9C8FA` | `#A9C8FA` | Inventory / Active Pipeline / Capacity KPI |
| **Pastel Card — Mint** | `#92E2B3` | `#92E2B3` | Gross Profit / Growth KPI, Cost Chart Bars & Success Toasts |
| **Pastel Card — Butter** | `#F6E7A1` | `#F6E7A1` | Net Profit / Cash-in-Hand / Highlight KPI |
| **Semantic Status** | Profit `#2FB67C`, Warn `#F5B544`, Danger `#E11D48` / `#D95C5C` | Profit `#2FB67C`, Warn `#F5B544`, Danger `#F43F5E` / `#FF8585` | Signed financial deltas, inline delete confirmation (`bg-rose-600`), alerts |

### 3.4 Typography Scale & Radii

| Element | Classes / Specs |
| :--- | :--- |
| **Hero Display (Landing / Split Auth)** | `text-[28px] sm:text-[34px] lg:text-[42px] font-bold leading-[1.14] tracking-[-0.02em]` |
| **Page Title (`<h1>` Desktop / Mobile)** | Desktop: `text-[28px] leading-[34px] font-extrabold tracking-[-0.02em]` · Mobile: `text-[24px] sm:text-[26px] font-extrabold` |
| **KPI Metric Value** | `text-[24px] sm:text-[26px] font-black tracking-tight leading-none font-mono tabular-nums` |
| **Card / Section Title (`<h3>`)** | `text-sm sm:text-base font-bold text-[#14161A] dark:text-[#F2F4F5]` |
| **Overline / Eyebrow / Table Header** | `text-[11px] font-extrabold tracking-[0.06em–0.08em] uppercase` (table headers: `font-medium text-[#7B848F]`) |
| **Body / Table Cells / Form Labels** | `text-xs` (`12px`) with `tabular-nums` for numbers and `font-normal text-[#636B76]` in tables |
| **Corner Radii System** | Split Hero Card: `28px`/`34px` · Standard Cards/Rail: `20px` · Modals: `rounded-t-[24px] sm:rounded-[22px]` · Brand Logo Tile: `18px` (`13px` inner) · Inputs/Rail Icons: `14px` · Pills/Nav/CTAs: `9999px` (`rounded-full`) |

### 3.5 Shadow & Elevation Rules
- **Idle Pills, Nav Items & Standard Buttons**: `shadow-none` (clean flat surfaces crisp against `#F2F4F4` / `#FFFFFF`).
- **Floating Islands (Top Nav, Logo Tile, Left Rail, Bottom Controls)**: `shadow-[0_1px_2px_rgba(20,22,26,0.04),0_6px_18px_rgba(20,22,26,0.05)]`
- **Main Data Cards (`Chart`, `DataTable`)**: `shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)]`
- **Mobile Bottom Nav Pill**: `shadow-[0_8px_28px_rgba(20,22,26,0.1)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.42)]`
- **Open Dropdowns / Select Menus**: `shadow-[0_10px_30px_rgba(20,22,26,0.14)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.45)]`
- **Active Inline Confirm Capsule**: `shadow-[0_1px_2px_rgba(225,29,72,0.14)] dark:shadow-none`

---

## 4. Apple-Style Bubble & Tap Motion Engine

Every tap in the interface delivers a crisp, physical **shrink-on-press -> overshoot spring-rebound** inspired by modern Apple tactile UI, paired with a subtle radial tap ripple and shared-element `layoutId` sliding pills.

### 4.1 Spring Constants (`src/utils/appleBubbleMotion.ts`)

```ts
export const APPLE_BUBBLE_SPRING = {
  type: 'spring',
  stiffness: 460,
  damping: 24,
  mass: 0.72,
} as const;

export const APPLE_TAP_SPRING = {
  type: 'spring',
  stiffness: 480,
  damping: 20,
  mass: 0.68,
} as const;

export const APPLE_EASE_OUT = [0.22, 1, 0.36, 1] as const;

export interface BubbleInteractionConfig {
  disabled?: boolean;
  hoverScale?: number;
  tapScale?: number;
}

export function getAppleBubbleGestures({
  disabled = false,
  hoverScale = 1.03,
  tapScale = 0.89,
}: BubbleInteractionConfig = {}) {
  if (disabled) {
    return { whileHover: undefined, whileTap: undefined };
  }
  return {
    whileHover: { scale: hoverScale },
    whileTap: { scale: tapScale },
  };
}
```

### 4.2 Dual-Layer Architecture (Global CSS + Motion Component)

1. **Global CSS Layer (`src/index.css`)**: Automatically gives **every native `<button>`** Apple rubber-band press physics (`85ms` quick compress to `0.92` on `:active`, `340ms` overshoot spring rebound `cubic-bezier(0.34, 1.56, 0.64, 1)` on release). Elements driven by Framer Motion opt out via `data-motion-button="true"` (or `data-no-bubble="true"`):

```css
@layer utilities {
  .apple-bubble-btn,
  button:not(:disabled):not([data-motion-button="true"]):not([data-no-bubble="true"]) {
    transition-property: color, background-color, border-color, box-shadow, opacity, transform, scale;
    transition-duration: 200ms, 200ms, 200ms, 200ms, 180ms, 340ms, 340ms;
    transition-timing-function: ease-out, ease-out, ease-out, ease-out, ease-out,
      cubic-bezier(0.34, 1.56, 0.64, 1), cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .apple-bubble-btn:active:not(:disabled),
  button:not(:disabled):not([data-motion-button="true"]):not([data-no-bubble="true"]):active {
    scale: 0.92;
    transition-duration: 85ms;
    transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }

  .apple-bubble-pill {
    transition-property: color, background-color, border-color, box-shadow, opacity, transform, scale;
    transition-duration: 200ms, 200ms, 200ms, 200ms, 180ms, 340ms, 340ms;
    transition-timing-function: ease-out, ease-out, ease-out, ease-out, ease-out,
      cubic-bezier(0.34, 1.56, 0.64, 1), cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .apple-bubble-pill:hover:not(:disabled) { scale: 1.03; }
  .apple-bubble-pill:active:not(:disabled) {
    scale: 0.9;
    transition-duration: 85ms;
    transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    .apple-bubble-btn,
    .apple-bubble-pill,
    button:not(:disabled):not([data-motion-button="true"]):not([data-no-bubble="true"]) {
      transition-duration: 0.01ms;
    }
    .apple-bubble-btn:hover:not(:disabled),
    .apple-bubble-btn:active:not(:disabled),
    .apple-bubble-pill:hover:not(:disabled),
    .apple-bubble-pill:active:not(:disabled),
    button:not(:disabled):not([data-motion-button="true"]):not([data-no-bubble="true"]):active {
      scale: 1;
    }
  }
}
```

2. **Reusable `AppleBubbleButton` (`src/components/common/AppleBubbleButton.tsx`)**: Used for nav pills, CTAs, rail icons, pagination pills, and submit buttons. Adds spring hover/tap scaling plus an expanding radial tap ripple (`opacity: 0.4 -> 0`, `scale: 0.6 -> 1.45` in `0.36s`):

```tsx
import React, { useState } from 'react';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import { APPLE_EASE_OUT, APPLE_TAP_SPRING, getAppleBubbleGestures } from '../../utils/appleBubbleMotion';

export interface AppleBubbleButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'> {
  children?: React.ReactNode;
  hoverScale?: number;
  tapScale?: number;
  ripple?: boolean;
  rippleClassName?: string;
}

export const AppleBubbleButton = React.forwardRef<HTMLButtonElement, AppleBubbleButtonProps>(
  ({ children, className = '', disabled = false, hoverScale = 1.03, tapScale = 0.89,
     ripple = true, rippleClassName = 'bg-black/[0.06] dark:bg-white/[0.12]',
     onClick, type = 'button', transition, ...rest }, ref) => {
    const [rippleKey, setRippleKey] = useState(0);
    const gestures = getAppleBubbleGestures({ disabled, hoverScale, tapScale });

    return (
      <motion.button
        ref={ref}
        type={type}
        data-motion-button="true"
        disabled={disabled}
        whileHover={gestures.whileHover}
        whileTap={gestures.whileTap}
        transition={transition ?? { scale: APPLE_TAP_SPRING }}
        onClick={(e) => {
          if (!disabled && ripple) setRippleKey((k) => k + 1);
          onClick?.(e);
        }}
        className={`relative ${className}`}
        {...rest}
      >
        {ripple && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden z-0">
            <AnimatePresence>
              {rippleKey > 0 && (
                <motion.span
                  key={`bubble-ripple-${rippleKey}`}
                  initial={{ opacity: 0.4, scale: 0.6 }}
                  animate={{ opacity: 0, scale: 1.45 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.36, ease: APPLE_EASE_OUT }}
                  className={`absolute inset-0 rounded-[inherit] ${rippleClassName}`}
                />
              )}
            </AnimatePresence>
          </span>
        )}
        {children}
      </motion.button>
    );
  }
);
```

> **CRITICAL Rule for `AppleBubbleButton` Children**: Always place `relative z-10` on text/icon children inside `AppleBubbleButton` when mixing with a sliding `layoutId` pill (`z-0`) or ripple layer (`z-0`), so labels render crisply above the sliding background.

### 4.3 Sliding Active Pill (`layoutId`) & Page Mount Animation
- **Sliding Tab Pill**: Every horizontal segmented control (Top Nav, Sub-Tabs, Date Filters, Chart `7D/30D/90D`, Pagination active page) renders:
  ```tsx
  {isActive && (
    <motion.span
      layoutId="uniqueGroupId"
      transition={APPLE_BUBBLE_SPRING}
      className="absolute inset-0 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] z-0"
    />
  )}
  ```
- **Tab View Content Transition**: Wrap `<main>` route/tab content in:
  ```tsx
  <motion.div
    key={currentTab}
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.16, ease: 'easeOut' }}
    className="w-full"
  >
  ```

### 4.4 Framer Motion Stat Counter (`AnimatedNumber` — Zero-to-Value Slide-Up)
Summary KPI cards, hero metrics, and balance highlight cards animate numeric values **from `0` up to their live target over 3.2 seconds** on first reveal using `motion/react` (`useMotionValue` + `animate`), paired with an upward entrance slide (`y: 10 -> 0`).

- **Timing & Easing**:
  - Initial count-up from `0`: **`3.2s`** (`initialDuration = 3.2`) with **`[0.16, 1, 0.3, 1]`** (exponential ease-out so numbers accelerate quickly and decelerate silkily into their final digits).
  - Subsequent live filter/delta updates: **`1.2s`** (`updateDuration = 1.2`) transitioning smoothly from the current animated value—never resetting back to `0` mid-session.
  - Optional card stagger: `delay={0, 0.05, 0.1, 0.15}` across KPI rows.
- **Strict Scope Rule**: Use `AnimatedNumber` **exclusively on Stat Cards, Hero Metrics, and Balance Summary Cards** (`tabular-nums`). **Never** animate numbers inside `DataTable` rows, itemized ledger tables, or dense directory lists where rapid scanning requires instant static alignment.
- **Accessibility**: Honors `useReducedMotion()` automatically by snapping immediately to the final value without motion.

```tsx
export const MOTION_COUNTER_EASE = [0.16, 1, 0.3, 1] as const;

// Inside AnimatedNumber (uses motion/react useMotionValue + animate):
const motionVal = useMotionValue(prefersReducedMotion ? target : 0);

useEffect(() => {
  const fromVal = motionVal.get();
  const animDuration = fromVal === 0 ? 3.2 : 1.2;
  const controls = animate(motionVal, target, {
    duration: animDuration,
    delay,
    ease: MOTION_COUNTER_EASE,
    onUpdate: (latest) => setDisplayVal(roundAnimatedValue(latest, decimals)),
    onComplete: () => setDisplayVal(target),
  });
  return () => controls.stop();
}, [target]);

return (
  <motion.span
    initial={{ opacity: 0.35, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.55, delay, ease: APPLE_EASE_OUT }}
    className="inline-block tabular-nums"
  >
    {formatter(displayVal)}
  </motion.span>
);
```

---

## 5. Responsive Layout Shells

### 5A. Dashboard / CRM Shell (`FloatingIslandShell`)

Desktop (`xl:` ≥ 1280px) uses detached floating islands suspended over the `#F2F4F4` / `#0F1113` canvas—never a heavy full-bleed fixed sidebar or cluttered header bar.

1. **Top Fade Gradient Mask (`xl+`)**: Prevents scrolled table/card content from colliding starkly with floating top nav islands:
   ```html
   <div class="hidden xl:block pointer-events-none fixed top-0 inset-x-0 h-16 bg-gradient-to-b from-[#F2F4F4] via-[#F2F4F4]/90 to-transparent dark:from-[#0F1113] dark:via-[#0F1113]/90 z-30" />
   ```
2. **Floating Top Row (`hidden xl:flex fixed top-5 inset-x-0 px-5 z-40 items-center justify-between gap-3 pointer-events-none`)**:
   - **Left Cluster (`pointer-events-auto flex items-center gap-3`)**:
     - **Brand Logo Tile**: `w-[52px] h-[52px] rounded-[18px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] p-1` (inner image `rounded-[13px]`).
     - **Primary Nav Pill**: `h-12 rounded-full p-1 bg-white dark:bg-[#181B1F] border flex items-center gap-0.5` (Note: never set `overflow-x-auto` with unconstrained width that creates an unintended vertical/horizontal scrollbar beside the pill!). Items: `px-2.5 2xl:px-3.5 h-[38px] rounded-full text-[11px] font-bold tracking-[0.06em] uppercase whitespace-nowrap`, sliding `layoutId="desktopNavPill"` in `#EDEEEF` / `#272C33`, optional Electric Lime badge `bg-[#D4F56B] text-[#14161A] text-[10px] font-extrabold font-mono`.
   - **Right Utility Cluster (`pointer-events-auto flex items-center gap-2 2xl:gap-2.5`)**:
     - Workspace/Mode indicator pill (`h-10 px-3.5 rounded-full`), e.g., teal-tinted `DEMO MODE` pill or owner pill.
     - Primary Quick Action CTA: `h-10 px-3.5 2xl:px-4 rounded-full bg-[#D4F56B] hover:bg-[#C9EE55] text-[#14161A] font-bold text-xs tracking-wider uppercase`.
     - Profile Pill + Animated Popover (`w-56 p-2 rounded-[18px] shadow-xl`).
3. **Floating Left Vertical Rail (`hidden xl:flex fixed top-28 left-5 z-40 flex-col items-center w-[52px] p-1.5 gap-1.5 rounded-[20px]`)**:
   - Contains `40×40px` (`w-10 h-10 rounded-[14px]`) icon tiles.
   - Active tile switches to **`bg-[#D4F56B] text-[#14161A]`**; inactive uses `hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328]`.
   - Each icon exposes an immediate dark hover tooltip (`left-14 bg-[#14161A] text-white text-[11px] px-2.5 py-1 rounded-lg`).
   - Separated from utility/Settings icon at bottom by a `w-6 h-px bg-[#E3E6E8] dark:bg-[#2A2F35]` hairline divider.
4. **Bottom-Left Floating Controls (`hidden xl:flex fixed bottom-5 left-5 z-40 flex-col gap-2.5`)**:
   - `52×52px` (`w-[52px] h-[52px] rounded-[20px]`) Theme Toggle (`Sun` `#F6E7A1` / `Moon` `#14161A`) + Help Guide modal trigger.
5. **Mobile & Tablet Header (`< xl`)**:
   - Top row: Floating `44×44px` (`w-11 h-11`) Logo tile (`rounded-[16px]`) on left, `44×44px` circular `+` Quick Action and Hamburger Menu buttons on right.
   - Second row: Current Page Title (`text-[24px] sm:text-[26px] font-extrabold`) + live status line left; compact `40×40px` (`w-10 h-10 rounded-[14px]`) Theme + Alert/Quick Jump square tiles right.
6. **Mobile Floating Bottom Pill Nav (`< xl`)**:
   - `fixed bottom-3.5 inset-x-0 mx-auto w-[min(92%,380px)] h-16 bg-white/95 dark:bg-[#181B1F]/95 backdrop-blur-md rounded-full border px-3 flex items-center justify-between z-40`.
   - 4 primary destinations (`w-12 h-12 rounded-full` with sliding `layoutId="mobileNavActive"`) flanking a **centered flush `48×48px` Electric Lime `+` button** (`bg-[#D4F56B] text-[#14161A]`).
7. **Slide-Over Left Drawer (Full Menu)**:
   - `w-[85%] max-w-[330px]` with `motion.div` spring (`type: 'spring', stiffness: 360, damping: 34`), backdrop `bg-black/50 backdrop-blur-xs`, active item highlighted in `bg-[#D4F56B] text-[#14161A] rounded-[14px]`.
8. **Main Full-Width Content Canopy**:
   - `pt-4 sm:pt-6 xl:pt-[92px] pb-24 xl:pb-12 px-4 sm:px-6 xl:pl-[96px] xl:pr-6` — spacious, edge-to-edge fluidity with generous breathing room around the floating islands.

### 5B. Landing Page / Marketing Adaptation Blueprint

When building a **Landing Page** with this design system, translate the exact same tokens and spatial grammar as follows:

1. **Floating Top Navbar**: Centered or spread `fixed top-5 inset-x-0 px-5 max-w-[1240px] mx-auto z-40` housing:
   - Brand Logo Tile (`48×48px` or `52×52px`, `rounded-[16px]–[18px]`)
   - Floating Pill Navigation (`h-12 rounded-full p-1 bg-white/95 dark:bg-[#181B1F]/95 backdrop-blur-md border`) with section links (`Features`, `Workflow`, `Pricing`, `FAQ`) sharing a `layoutId="landingNavPill"` indicator.
   - Right CTA Cluster: `40×40px` `rounded-[14px]` Theme Toggle + `#D4F56B` `AppleBubbleButton` primary CTA (`Get Started` / `Book Demo`).
2. **Split-Card Hero Section (Derived from `LoginPage`)**:
   - Outer container: `max-w-[1200px] mx-auto bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[28px] sm:rounded-[34px] p-4 sm:p-6 lg:p-7 shadow-[0_12px_40px_rgba(20,22,26,0.07)] grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 relative overflow-hidden`.
   - Ambient radial corner glow inside outer card:
     `bg-[radial-gradient(circle,rgba(212,245,107,0.42)_0%,rgba(146,226,179,0.28)_38%,rgba(169,200,250,0.16)_65%,transparent_80%)] blur-2xl`
   - **Content Column (`lg:col-span-6`)**: Tight `tracking-[-0.02em]` headline (`36px–48px`), clean `16px` `#4A515B` subtitle, two `AppleBubbleButton` CTAs (`#D4F56B` Primary + `#F8F9FA` Bordered Secondary).
   - **Deep Teal Showcase Column (`lg:col-span-6`)**: `bg-[#17807D] dark:bg-[#146B69] rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 text-white relative overflow-hidden` featuring an internal radial Lime/Mint glow and either a transparent 3D visual or an interactive live metric/chart preview.
3. **Pastel Bento Feature / Metrics Grid**: 4-column (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`) cards using `#C9C3F5`, `#A9C8FA`, `#92E2B3`, `#F6E7A1` with `rounded-[20px]`, white `w-8 h-8 rounded-full bg-white/70` icon circles, and `bg-white/80 rounded-full` highlight pills.
4. **Interactive Product Showcase & Pricing**:
   - Interactive comparative bar chart preview card (`bg-white dark:bg-[#181B1F] rounded-[20px] border`) with working `7D / 30D / 90D` sliding toggle pills and clickable data bars.
   - Highlighted pricing tier in Deep Teal `#17807D` with `#D4F56B` CTA alongside clean `#FFFFFF` / `#181B1F` standard tiers.

---

## 6. Component & Interaction Pattern Library

### 6.1 Pastel KPI Stat Cards & Deep Teal Fast-Action Card

```tsx
{/* 4-Card Pastel Row */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <div className="rounded-[20px] p-5 bg-[#C9C3F5] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[150px] transition-transform hover:-translate-y-0.5">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-extrabold tracking-[0.06em] uppercase text-[#14161A]/80">
        Total Revenue
      </span>
      <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
        <DollarSign className="w-4 h-4" />
      </div>
    </div>
    <div>
      <div className="text-[24px] sm:text-[26px] font-black tracking-tight leading-none font-mono tabular-nums">
        <AnimatedNumber value={revenue} formatter={formatCurrency} />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-xs font-semibold text-[#14161A]/85">
        <span>1,240 orders</span>
        <span className="bg-white/80 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
          Last 7 Days
        </span>
      </div>
    </div>
  </div>
  {/* Repeat with #A9C8FA (Sky), #92E2B3 (Mint), #F6E7A1 (Butter) */}
</div>

{/* Deep Teal Featured Action Card (3-col sidebar in 12-col grid) */}
<div className="rounded-[20px] p-5 bg-[#17807D] dark:bg-[#146B69] text-white shadow-lg space-y-4">
  <div className="flex items-center justify-between">
    <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#D4F56B]">
      Quick Action
    </span>
    <ShoppingCart className="w-5 h-5 text-[#D4F56B]" />
  </div>
  <div>
    <h4 className="text-lg font-bold leading-tight">Create New Record</h4>
    <p className="text-xs text-white/85 mt-1">
      Short helper line explaining what happens automatically.
    </p>
  </div>
  <AppleBubbleButton
    hoverScale={1.02}
    tapScale={0.92}
    rippleClassName="bg-black/[0.08]"
    className="w-full py-2.5 rounded-full bg-[#D4F56B] hover:bg-[#C9EE55] text-[#14161A] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_1px_2px_rgba(20,22,26,0.08)] dark:shadow-none cursor-pointer"
  >
    <Plus className="relative z-10 w-4 h-4 stroke-[2.5]" />
    <span className="relative z-10">New Entry</span>
  </AppleBubbleButton>
</div>
```

### 6.2 Segmented Sub-Tab Switcher (Responsive: Accordion Card on `< sm`, Sliding Pill Bar on `sm+`)
Combine related pages into a single route using a clean segmented switcher instead of fragmenting the sidebar:
- **Desktop / Tablet (`hidden sm:inline-flex`)**: White/surface pill container `p-1 rounded-full border border-[#E3E6E8] dark:border-[#2A2F35]` with `AppleBubbleButton` items sharing `layoutId="sectionTabPill"`.
- **Mobile (`sm:hidden`)**: Stacked card `rounded-[18px] border divide-y` with `Check` icon in `#14161A` / `#D4F56B` on the active row.

### 6.3 Date Filter Pill Bar & Custom Range Picker
- **Desktop (`hidden sm:inline-flex`)**: Pill bar with presets (`Today`, `Yesterday`, `Last 7 Days`, `This Month`) + `Pick Dates` (`Calendar` icon), all sharing `layoutId="dashboardPeriodPill"` (`bg-[#EDEEEF] dark:bg-[#272C33]`).
- **Mobile (`sm:hidden`)**: Collapsible summary row (`rounded-[18px] border`) showing the active label + rotating `ChevronDown` circle (`w-7 h-7 rounded-full bg-[#F3F5F6]`) and an always-accessible `Pick Dates` trigger below a hairline divider.
- **Custom Range Form (`showCustomDate`)**: Renders as a compact horizontal pill on `sm+` (`sm:rounded-full sm:p-1.5 sm:px-3`) or stacked `rounded-[18px]` card on mobile with `#D4F56B` `Apply` pill.

### 6.4 Interactive Comparative Bar Chart
- **Card Wrapper**: `rounded-[20px] p-5 sm:p-6 bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)]`.
- **Header Controls**: Left title + `"Tap or click any bar to inspect exact figures"`; right `7D / 30D / 90D` sliding pill (`bg-[#F8F9FA] dark:bg-[#1F2328] p-1 rounded-full border`) + `#D4F56B` `Full Report` CTA pill.
- **Bars**: Paired rounded-top vertical bars (`rounded-t-[6px] max-w-[22px]`): Primary series in **Lavender `#C9C3F5`**, secondary/cost series in **Mint `#92E2B3`**, zero-value placeholder bars in `#E3E6E8` / `#2A2F35` (`height: 3px`).
- **Tap-to-Inspect Interaction**: Clicking any column highlights its column wrapper (`bg-[#F3F5F6] dark:bg-[#20242A] rounded-xl`), highlights its X-axis label in `#14161A` / `#D4F56B`, and updates a live **Bottom Readout Strip** (`rounded-[14px] bg-[#F8F9FA] dark:bg-[#20242A] border`) showing exact KPI breakdown for that day—never relying on mouse-only hover tooltips that fail on touch devices.

### 6.5 Zero-Shift Inline `ConfirmDeleteButton` (Signature Pattern)
Replaces all destructive confirmation modals. Clicking once expands the control **in place** without shifting adjacent table columns or altering row height.

**Behavioral Contract**:
1. **Fixed Outer Slot**: Wrap icon-only buttons in `<span className="inline-flex items-center justify-end w-[80px] h-[32px] shrink-0 align-middle">` so idle (`32px`) and confirming (`80px`) states occupy the exact same horizontal footprint in table cells.
2. **State 1 — Idle**: `32×32px` circle (`bg-[#EDEEEF] dark:bg-[#22262C] border`), muted `Trash2` icon, subtle rose hover tint (`hover:bg-rose-50 hover:text-rose-600`).
3. **State 2 — Tap 1 (Confirming)**: Width animates `32 -> 80` with `APPLE_BUBBLE_SPRING`; `Trash2` blurs/rotates out (`opacity: 0, scale: 0.55, rotate: -18, blur(2px)`); a rose capsule (`bg-rose-600 dark:bg-rose-500`) scales in (`0.72 -> 1`) behind `"Confirm?"` text + radial pulse ripple (`0.36s`).
4. **Auto-Revert Safety**: Automatically cancels back to Idle on **outside `pointerdown`**, **`Escape` key**, or **`15000ms` (15s) timeout**.
5. **State 3 — Tap 2**: Executes async `onConfirm()` with `disabled`/`busy` guard while optimistic UI + rollback toast handle errors.
6. **Labeled Variant**: Pass `label="Delete"` for card footers/detail modals (`px-3.5`, fixed `min-w-[68px]` crossfade slot).

```tsx
<motion.button
  type="button"
  data-motion-button="true"
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.86 }}
  animate={label ? { scale: 1 } : { width: confirming ? 80 : 32, scale: 1 }}
  transition={{ width: APPLE_BUBBLE_SPRING, scale: APPLE_TAP_SPRING }}
  className="relative h-[32px] overflow-hidden inline-flex items-center justify-center rounded-full text-[11px] font-bold shrink-0"
>
  {/* 1. AnimatePresence Rose Capsule (bg-rose-600 dark:bg-rose-500) */}
  {/* 2. Radial Tap Ripple (scale: 0.6 -> 1.45, duration: 0.36) */}
  {/* 3. Blurred Crossfade: Trash2 icon <-> "Confirm?" */}
</motion.button>
```

### 6.6 Hybrid `DataTable`, `Pagination` & Column Visibility Picker

- **Container**: `bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.05)]`.
- **Toolbar**:
  - Search input (`min-h-[40px] pl-9 rounded-[14px] bg-[#F3F5F6]/70 focus:ring-2 focus:ring-[#D4F56B]`).
  - Inline contextual `Select` filters (`grid-cols-2 sm:flex`).
  - Right-aligned `Columns` visibility popover (`w-60 rounded-[16px] shadow-2xl`) with persisted preferences, `alwaysVisible` lock, `Reset` action, and Lime count badge (`visible/total`).
- **Responsive Viewport Switch**:
  - **`md+` (`hidden md:block`)**: Full sortable `<table>` with `bg-[#F8F9FA] dark:bg-[#20242A]` uppercase `11px` header, `tabular-nums` cells (`py-3 px-3.5 text-xs`), and row hover `hover:bg-[#F3F5F6]/70`.
  - **`< md` (`md:hidden`)**: Mobile compact sort bar + stacked clean cards (`p-4 space-y-2.5`): title/subtitle + status badge at top, 2-column detail grid inside a `rounded-[12px] bg-[#F8F9FA] dark:bg-[#20242A] px-3 py-2.5` well, and right-aligned action row (including `ConfirmDeleteButton`) at bottom.
- **Stale-While-Fetching Feedback**: When paging/filtering cached server data, keep existing rows visible at `opacity-65` and display a compact `"Updating"` spinner pill in the `Pagination` footer instead of flashing empty skeletons.
- **Reusable `Pagination` Footer**:
  - Default `limit = 20`, selectable `Per page` options `[10, 20, 50, 100]` (`min-h-[34px] rounded-[10px]`).
  - Range summary (`Showing 1–20 of 148`).
  - Numbered circular page pills (`min-w-[34px] min-h-[34px] rounded-full`) with sliding Electric Lime `layoutId` active highlight (`bg-[#D4F56B] text-[#14161A]`), `Prev` / `Next` buttons (`rounded-[10px]`), and compact `Page X / Y` readout on mobile (`< sm`).
  - Client-side LRU/stale cache wrapper (`usePaginatedQuery`) caches page slices so navigating back/forth between visited pages renders instantaneously without duplicate API calls.

### 6.7 Bottom-Sheet Mobile / Centered Desktop `Modal` & Searchable Auto-Flip `Select`

- **Modal (`Modal.tsx`)**:
  - Backdrop: `fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4`.
  - Mobile renders as a **bottom sheet** (`rounded-t-[24px]`) with a top drag handle (`w-10 h-1 rounded-full bg-[#D7DBDF] dark:bg-[#373E47] mx-auto mt-2.5`); Desktop (`sm+`) renders as a centered dialog (`rounded-[22px] max-h-[90vh]`).
  - Subtle sticky header: `px-5 py-4 border-b bg-[#F3F5F6]/70 dark:bg-[#1F2328]/70` with `40×40px` circular close button and `Escape` key dismissal.
- **Select (`Select.tsx`)**:
  - Trigger: `rounded-[14px] border bg-[#F3F5F6]/70 dark:bg-[#1F2328]/80 focus:ring-2 focus:ring-[#D4F56B]`.
  - **Auto-Flip Placement**: Computes `window.innerHeight - rect.bottom`; if `< 250px` and space above is larger, automatically opens upward (`bottom-full mb-1.5`).
  - Optional inline search bar inside menu (`pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#F3F5F6]`).
  - Selected option pill highlights in **`bg-[#D4F56B] text-[#14161A] font-bold`** with trailing `Check`.

### 6.8 Glassmorphic Toasts & Form Input Standards
- **Toast Position**: `fixed bottom-24 xl:bottom-5 right-3 left-3 sm:left-auto sm:right-5 z-50` (clears mobile bottom pill nav on small screens!).
- **Toast Surface**: `p-3.5 rounded-[16px] border text-xs shadow-lg backdrop-blur-md`:
  - Success: `bg-white/95 dark:bg-[#181B1F]/95 border-[#92E2B3]` + `#2FB67C` `CheckCircle2`
  - Error: `bg-rose-50/95 dark:bg-rose-950/95 border-rose-300 dark:border-rose-700` + `AlertCircle`
- **Standard Form Inputs**:
  - Inside app cards/modals: `w-full min-h-[42px] px-3.5 py-2 rounded-[14px] border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F3F5F6]/70 dark:bg-[#1F2328]/80 text-xs focus:outline-none focus:ring-2 focus:ring-[#D4F56B]`.
  - Auth/Landing large inputs: `h-[52px] px-4 rounded-[14px] bg-[#F3F5F6] dark:bg-[#1F2328] border border-transparent focus:border-[#17807D] dark:focus:border-[#D4F56B] focus:bg-white dark:focus:bg-[#181B1F] text-sm`.

---

## 7. Quick Implementation & Maintenance Checklist

Before shipping any screen built with this system, verify:
- [ ] Page grounded on `#F2F4F4` (light) / `#0F1113` (dark), with elevated `#FFFFFF` / `#181B1F` islands.
- [ ] All buttons inherit Apple bubble press/rebound (`scale: 0.92` active) or use `AppleBubbleButton`; active tabs slide smoothly with `layoutId`.
- [ ] Stat cards & balance summary KPIs animate from `0` to target over ~3.2s via `AnimatedNumber` (`tabular-nums`), while table rows and dense lists remain static.
- [ ] Idle pills and buttons have `shadow-none` + hairline `#E3E6E8` / `#2A2F35` borders.
- [ ] Destructive row/card deletes use fixed-slot inline `ConfirmDeleteButton` (`w-[80px] h-[32px]`), never modal dialogs or `window.confirm`.
- [ ] Tables switch gracefully to structured mobile cards below `md` (`768px`) and share a single cached `Pagination` footer (`20` default, `10/20/50/100` selector).
- [ ] Inputs keep `font-size >= 16px` on `< 768px` viewports to prevent iOS Safari auto-zoom.
- [ ] Reduced-motion preferences (`prefers-reduced-motion: reduce`) disable scale and count-up animations cleanly.

> **Living Document Rule**: Whenever new UI components, tokens, or motion patterns are added or refined in this project, update `DESIGN.md` in the same session so it stays 100% synchronized.
