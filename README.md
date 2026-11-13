<div align="center">
  <img src="public/assets/aistudio/check-in_ceb7ef49.webp" alt="Al-Madina Poultry Logo" width="88" height="88" />

  <h1>Al-Madina Poultry — Farm & Shop Management System</h1>

  <p>
    <strong>An enterprise-grade, mobile-first Progressive Web App (PWA) for live poultry procurement, landed-cost accounting, FIFO bird batch inventory, counter &amp; wholesale billing, dealer ledgers, and real-time Profit &amp; Loss reporting.</strong>
  </p>

  <p>
    <img src="https://img.shields.io/badge/React-19-14161A?style=flat-square&logo=react&logoColor=D4F56B" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-Strict-14161A?style=flat-square&logo=typescript&logoColor=A9C8FA" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-v4-14161A?style=flat-square&logo=tailwindcss&logoColor=92E2B3" alt="Tailwind CSS v4" />
    <img src="https://img.shields.io/badge/Zustand-Optimistic_Store-14161A?style=flat-square" alt="Zustand" />
    <img src="https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-14161A?style=flat-square&logo=postgresql&logoColor=C9C3F5" alt="PostgreSQL + Drizzle ORM" />
    <img src="https://img.shields.io/badge/PWA-Installable-14161A?style=flat-square" alt="PWA" />
  </p>

  <p>
    <a href="#-visual-tour">Visual Tour</a> •
    <a href="#-high-level-design-hld">High-Level Design (HLD)</a> •
    <a href="#-low-level-design-lld">Low-Level Design (LLD)</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-about-me">About Me</a>
  </p>
</div>

---

## ✨ Overview

Poultry trading operates on razor-thin margins, fluctuating truck weights, transit mortality, and rapid cash turnover. Generic POS software breaks down because it cannot compute true **landed cost per healthy bird** or track **First-In, First-Out (FIFO)** flock batches across split walk-in and wholesale sales.

**Al-Madina Poultry** solves this with a single unified ledger:

- **Truck-to-Batch Landed Costing:** Purchase live bird trucks by total KG weight, attach diesel/loading/driver costs, count healthy vs. dead/weak birds at arrival, and automatically lock in the true cost per saleable bird.
- **FIFO Inventory Engine:** Every walk-in counter bill or wholesale shop delivery consumes birds from the **oldest active batch first**, recording itemized batch-level COGS (`sale_items`) and immutable stock movements.
- **Zero-Double-Counting Accounting:** Cash payments sent to farm suppliers reduce the **Dealer Ledger** balance without polluting daily shop P&amp;L expenses.
- **Instant Optimistic UI & Double-Click Throttling:** All forms update UI state immediately, roll back cleanly if the server rejects a transaction, and block rapid double-clicks synchronously.
- **iPhone-Friendly Installable PWA:** Built with `16px` mobile input rules to prevent iOS tap-zoom, overflow-clamped date pickers, collapsed mobile filter cards, and Home Screen installation.

---

## 📸 Visual Tour

### 1. Shop Overview & Daily Margin Analytics
Live KPI cards (**Money From Sales**, **Birds Ready to Sell**, **Profit Before Bills**, **Profit In Hand**), interactive `7D / 30D / 90D` dual-bar sales vs. bird cost chart, day-level breakdown, and dealer balance snapshot.

![Shop Overview Dashboard](docs/images/01-overview-desktop.png)

---

### 2. Truck Purchases, Transit Costs & Arrival Counting
Manage incoming supplier loads, track vehicles waiting for bird counts (`COUNT BIRDS`), record diesel/driver/loading expenses inside each truck's cost drawer, and convert arrivals into priced stock batches.

![Truck Purchases & Arrivals](docs/images/02-truck-purchases-desktop.png)

---

### 3. FIFO Bird Stock, Batch Valuation & Profit Checker
Monitor active bird lots ordered oldest-first, inspect exact cost per bird, test selling prices before quoting customers, and audit stock adjustments or dead-bird write-offs.

![FIFO Bird Stock & Rates](docs/images/03-inventory-batches-desktop.png)

---

### 4. Walk-in Counter Quick Sale
Streamlined single-screen billing with live `Price / Bird` calculation, stock validation, and automatic FIFO deduction across oldest lots.

![Walk-in Shop Sales](docs/images/04-shop-sales-desktop.png)

---

### 5. Profit & Loss Financial Reporting & Excel Export
Period-filtered P&amp;L breakdown across Walk-in vs. Wholesale revenue, FIFO COGS, shop utility expenses, staff wages, dealer payments, and one-click `.xlsx` spreadsheet export.

![Profit & Loss Report](docs/images/05-reports-pnl-desktop.png)

---

### 6. Responsive iPhone & Mobile PWA Experience
Designed specifically for counter operators on mobile devices with collapsible filter drawers, stacked date pickers, 2×2 daily margin summaries, floating bottom navigation, and zero horizontal scroll.

<table>
  <tr>
    <td align="center" width="50%">
      <img src="docs/images/06-mobile-overview.png" alt="Mobile Overview" width="290" /><br/>
      <sub><strong>Mobile Overview</strong> — Collapsed period filter &amp; responsive KPI stack</sub>
    </td>
    <td align="center" width="50%">
      <img src="docs/images/07-mobile-quick-sale.png" alt="Mobile Quick Sale" width="290" /><br/>
      <sub><strong>Mobile Quick Sale</strong> — 16px no-zoom inputs &amp; contained date picker</sub>
    </td>
  </tr>
</table>

---

## 🏛 High-Level Design (HLD)

### System Architecture

```mermaid
flowchart TB
    subgraph Client["Client Layer — React 19 + Vite PWA"]
        UI["Pages & Floating Island Shell<br/>(Desktop Rail + Mobile Bottom Pill)"]
        Store["Zustand Store (useAppStore)<br/>Optimistic State + Rollback + Column Prefs"]
        Calc["Pure Domain Engines<br/>poultryMath.ts · syncCalculations.ts · submitThrottle.ts"]
        SW["Workbox Service Worker<br/>Static Asset Cache + /api/* Network Pass-Through"]
    end

    subgraph Runtime["Server Layer — Express.js / Vercel Serverless"]
        ViteDev["Local/Cloud Run: server.ts / Vite Middleware"]
        VercelFn["Vercel Production: api/index.ts"]
        Router["REST API Router (src/server/api.ts)<br/>Schema Guard · PKT (UTC+5) Dates · Atomic Mutations"]
    end

    subgraph Data["Persistence Layer — PostgreSQL"]
        Drizzle["Drizzle ORM (src/db/schema.ts)"]
        PG[("Neon / PostgreSQL<br/>15 Normalized Relational Tables")]
    end

    UI --> Store
    Store <--> Calc
    UI -. offline shell .-> SW
    Store -- "JSON over HTTPS (/api/*)" --> ViteDev
    Store -- "JSON over HTTPS (/api/*)" --> VercelFn
    ViteDev --> Router
    VercelFn --> Router
    Router --> Drizzle
    Drizzle --> PG
```

### Core Architectural Decisions

| Concern | Architectural Choice | Rationale |
| :--- | :--- | :--- |
| **Instant UI Responsiveness** | Single `GET /api/bootstrap` hydration + **Optimistic Zustand Store** | Eliminates full-page reloads and blocking skeletons; mutations appear instantly and roll back automatically on API error. |
| **Financial Consistency** | Shared **pure TypeScript math engine** (`poultryMath.ts`) imported by both client & server | Ensures optimistic previews (FIFO COGS, landed cost/bird, margins) match persisted PostgreSQL calculations down to `0.01 PKR`. |
| **Deployment Portability** | Dual-entry Express `apiRouter` (`server.ts` + `api/index.ts` + `vite.config.ts`) | Runs identically in AI Studio / Cloud Run containers, Node.js servers, and Vercel serverless functions without rewriting endpoints. |
| **Zero-Setup Database** | Idempotent DDL bootstrapper (`ensureSchema.ts`) cached in `global._schemaReadyPromise` | Automatically creates missing tables on first request against fresh Neon or PostgreSQL instances, eliminating bootstrap failures. |
| **Time Zone Integrity** | Explicit **Pakistan Standard Time (`UTC+5`)** date helper (`getPakistanDate`) | Prevents midnight boundary drift between UTC cloud servers and local shop operations. |
| **Concurrency Safety** | Synchronous `useThrottledSubmit` hook + store-level `createStoreMutationGuard` | Prevents duplicate trucks, duplicate sales, or double payments from rapid taps/double-clicks. |

---

## ⚙️ Low-Level Design (LLD)

### 1. Relational Database Schema (15 Tables)

Defined in `src/db/schema.ts` with Drizzle ORM and foreign-key integrity:

```mermaid
erDiagram
    SUPPLIERS ||--o{ PURCHASE_LOADS : supplies
    SUPPLIERS ||--o{ DEALER_TRANSACTIONS : has_ledger
    PURCHASE_LOADS ||--o{ LOAD_EXPENSES : incurs
    PURCHASE_LOADS ||--o| STOCK_BATCHES : converts_to
    STOCK_BATCHES ||--o{ STOCK_MOVEMENTS : logs
    STOCK_BATCHES ||--o{ SALE_ITEMS : consumed_by
    SHOPS ||--o{ SALES : buys_wholesale
    SALES ||--o{ SALE_ITEMS : itemized_fifo
    WORKERS ||--o{ WORKER_PAYMENTS : receives

    PURCHASE_LOADS {
        serial id PK
        text load_number UK
        int supplier_id FK
        date purchase_date
        numeric total_weight_kg
        numeric purchase_amount
        text status
    }
    STOCK_BATCHES {
        serial id PK
        text batch_number UK
        int purchase_load_id FK
        int received_pieces
        int dead_pieces
        int damaged_pieces
        int original_saleable_pieces
        int remaining_pieces
        numeric total_landed_cost
        numeric cost_per_piece
        boolean is_closed
    }
    SALES {
        serial id PK
        text invoice_number UK
        text sale_type
        date sale_date
        int shop_id FK
        int total_pieces
        numeric total_amount
        numeric total_cost
        numeric total_profit
    }
    DEALER_TRANSACTIONS {
        serial id PK
        int supplier_id FK
        date transaction_date
        text transaction_type
        numeric debit_amount
        numeric credit_amount
        numeric balance_after
    }
```

<details>
<summary><strong>Complete Table Inventory (15 Tables)</strong></summary>

1. `users` — User account metadata (`uid`, `email`, `name`, `role`)
2. `suppliers` — Farm dealers & opening payables
3. `vehicles` — Transport fleet numbers & driver directory
4. `purchase_loads` — Incoming live bird truck records (`PENDING_RECEIVING` / `RECEIVED` / `CLOSED`)
5. `load_expenses` — Truck-specific transit costs (`Fuel`, `Transportation`, `Loading`, `Unloading`, `Driver Expense`, `Other`)
6. `stock_batches` — Saleable bird lots with locked `cost_per_piece` and `remaining_pieces`
7. `stock_movements` — Immutable stock audit trail (`STOCK_IN`, `SALE_OUT`, `WHOLESALE_OUT`, `DAMAGE`, `ADJUSTMENT`)
8. `dealer_transactions` — Double-entry payable ledger (`PURCHASE_DEBIT`, `PAYMENT_CREDIT`, etc.) with running `balance_after`
9. `shops` — Wholesale buyer chicken shops
10. `sales` — Unified walk-in (`OWN_SHOP`) and bulk (`WHOLESALE`) invoices (`INV-*` / `WHL-*`)
11. `sale_items` — Per-batch FIFO consumption breakdown linking `sales` to `stock_batches`
12. `workers` — Shop staff profiles
13. `worker_payments` — Staff wage & allowance disbursements
14. `business_expenses` — General shop overheads (`Electricity`, `Rent`, `Maintenance`, `Food`, `Tea`, `Cleaning`, `Other`)
15. `settings` — Key-value shop configuration (`businessName`, `lowStockThreshold`, price checker presets)

</details>

---

### 2. FIFO Sale Execution & Landed Cost Flow

```mermaid
sequenceDiagram
    actor User as Counter Operator
    participant Form as Page Form + useThrottledSubmit
    participant Store as useAppStore (Optimistic)
    participant Math as poultryMath.ts
    participant API as POST /api/sales/own-shop
    participant DB as PostgreSQL (Drizzle)

    User->>Form: Click "Save Sale" (rapid taps blocked synchronously)
    Form->>Store: createOwnShopSale(payload)
    Store->>Math: consumeBatchesFifo(activeBatches, qty)
    Math-->>Store: batchAllocations + totalFifoCost
    Store->>Math: calculateSaleMetrics(cash, qty, totalFifoCost)
    Store-->>User: Instant optimistic invoice + stock update

    Store->>API: POST /api/sales/own-shop
    API->>DB: Load open stock_batches ORDER BY id ASC
    API->>Math: consumeBatchesFifo(...)
    alt Insufficient stock
        API-->>Store: 400 Bad Request
        Store-->>User: Rollback snapshot + Error toast
    else Stock available
        API->>DB: Insert sales + sale_items + stock_movements
        API->>DB: Decrement remaining_pieces & close depleted lots
        API-->>Store: 201 Created (persisted Sale + Batch state)
        Store->>Store: Replace optimistic temp row with DB record
    end
```

### 3. Key Financial Formulas (`src/utils/poultryMath.ts`)

- **Purchase Rate / KG:** `purchaseAmount / totalWeightKg`
- **Saleable Birds:** `max(0, receivedPieces - deadPieces - damagedPieces)`
- **Total Landed Cost:** `purchaseAmount + sum(loadExpenses)`
- **Cost Per Healthy Bird:** `totalLandedCost / originalSaleablePieces`
- **Net Profit In Hand (`calculatePnl`):**
  ```text
  Gross Profit = Total Revenue - FIFO Bird COGS
  Net Profit   = Gross Profit - (Shop General Expenses + Staff Wages)
  ```
  > *Note:* Truck transit costs (`load_expenses`) are capitalized into `total_landed_cost` (and thus FIFO COGS when birds sell), while supplier payments (`dealer_transactions`) settle accounts payable—preventing double-counting in `Net Profit`.

---

### 4. REST API Surface (`src/server/api.ts`)

<details>
<summary><strong>Expand Full Endpoint Reference (30+ Endpoints)</strong></summary>

| Domain | Method & Route | Responsibility |
| :--- | :--- | :--- |
| **Hydration & Health** | `GET /api/health` | DB connectivity probe & suppliers count |
| | `GET /api/bootstrap` | Single-payload hydration of all 11 collections + settings |
| | `POST /api/seed` | Seeds realistic multi-day poultry demo data (`?force=true` resets) |
| **Purchases & Costs** | `GET / POST /api/purchases` | List trucks or create new truck load + auto dealer debit |
| | `GET /api/purchases/:id` | Truck detail with expenses & linked stock batch |
| | `POST /api/purchases/:id/expenses` | Add truck transit cost & recalculate landed cost/bird |
| | `DELETE /api/purchases/:id/expenses/:expenseId` | Remove truck cost & recalculate landed cost/bird |
| | `POST /api/purchases/:id/receive` | Count unloaded/dead/damaged birds into FIFO stock batch |
| **FIFO Inventory** | `GET /api/inventory/batches` | Active & closed batches ordered FIFO (`id ASC`) |
| | `GET /api/inventory/movements` | Stock movement audit log |
| | `POST /api/inventory/adjust` | Manual recount / mortality adjustment + movement entry |
| **Sales & Shops** | `GET /api/sales`, `GET /api/sales/:id` | Sales history & itemized FIFO batch breakdown |
| | `POST /api/sales/own-shop` | Walk-in counter sale with atomic FIFO stock deduction |
| | `POST /api/sales/wholesale` | Wholesale delivery to buyer chicken shop + FIFO deduction |
| | `GET / POST /api/shops` | Manage wholesale buyer shops & aggregate deliveries |
| **Suppliers & Ledger** | `GET / POST / PUT /api/suppliers` | Manage farm suppliers with computed live payables |
| | `GET /api/dealer-ledger` | Filterable double-entry ledger across all dealers |
| | `POST /api/dealer-ledger/payment` | Record cash/bank/cheque payment & recompute running balance |
| **Staff & Overheads** | `GET / POST / PUT /api/workers` | Manage shop workers |
| | `GET / POST /api/workers/:id/payments` | Record wages, daily *bhatta*, or overtime |
| | `GET /api/worker-payments` | Global staff payments feed |
| | `GET / POST / DELETE /api/expenses` | Record general shop expenses |
| **Analytics & Config** | `GET /api/dashboard`, `GET /api/reports` | Period KPIs, dual-bar series, P&amp;L aggregation |
| | `GET / POST /api/settings` | Persist shop name, location, rate presets, low-stock alert threshold |

</details>

---

### 5. Project Structure

```text
├── api/
│   └── index.ts                 # Vercel serverless handler wrapping Express apiRouter
├── docs/images/                 # README visual showcase screenshots
├── public/assets/aistudio/      # Brand logo, favicons, Apple touch & Android PWA icons
├── src/
│   ├── components/
│   │   ├── common/              # DataTable, Modal, Select, PWAInstallButton, OfflineIndicator, Toast
│   │   └── shell/               # FloatingIslandShell (desktop rail + mobile pill nav + drawer)
│   ├── context/                 # ThemeContext (Light/Dark persistence)
│   ├── db/
│   │   ├── index.ts             # Singleton PostgreSQL connection pool (DATABASE_URL / SSL)
│   │   ├── schema.ts            # Drizzle ORM 15-table relational schema + relations
│   │   └── ensureSchema.ts      # Idempotent startup DDL schema verifier/creator
│   ├── hooks/
│   │   ├── usePWAInstall.ts     # Cross-platform beforeinstallprompt + iOS A2HS detection
│   │   └── useThrottledSubmit.ts# Synchronous double-submit guard hook
│   ├── pages/                   # 11 feature views (Dashboard, Purchases, Inventory, Sales, etc.)
│   ├── server/
│   │   └── api.ts               # Express API router (30+ endpoints)
│   ├── services/
│   │   └── api.ts               # Typed frontend fetch client
│   ├── store/
│   │   └── useAppStore.ts       # Optimistic Zustand store with rollback & mutation guards
│   ├── types/                   # Shared TypeScript interfaces
│   └── utils/                   # Pure domain logic + node:test suites (poultryMath, syncCalculations, submitThrottle, pwaInstall, formatters)
├── server.ts                    # Production Node/Express entrypoint
├── vercel.json                  # Vercel SPA + /api/* serverless rewrite rules
└── vite.config.ts               # Vite + Tailwind v4 + Express dev middleware + Workbox PWA
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** `20+`
- A **PostgreSQL** database (such as **Neon** serverless PostgreSQL or local PostgreSQL)

### 1. Clone & Install

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and add your PostgreSQL connection string:

```env
APP_URL="http://localhost:3000"
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
```

### 3. Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`. The database tables are automatically verified/bootstrapped on first API request (`ensureSchema.ts`), and you can load sample business data anytime from **Settings → Fill Sample Data**.

### 4. Verify Build, Types & Unit Tests

```bash
# TypeScript strict check
npm run lint

# Run unit tests (FIFO math, landed cost, P&L, throttle, PWA install)
npx tsx --test src/utils/*.test.ts

# Production build & start
npm run build
npm start
```

### 5. Deploying to Vercel + Neon

1. Push the repository to GitHub and import it in **Vercel**.
2. Add `DATABASE_URL` (your Neon pooled connection string ending with `?sslmode=require`) in **Vercel → Settings → Environment Variables**.
3. `vercel.json` automatically builds `dist/` via `npm run build` and routes `/api/*` requests to `api/index.ts`.

---

## 👨‍💻 About Me

Hi, I'm **Khubaib Shah** (`syedkhubaibshah@icloud.com`) — a software engineer focused on building practical, resilient full-stack web applications that replace messy paper registers with fast, trustworthy software.

While building **Al-Madina Poultry**, my goal was to make real-world business accounting feel effortless on both a shop desktop and a counter operator's iPhone:
- Designing **domain-accurate financial engines** (FIFO batch consumption, landed cost allocation, and non-double-counted dealer ledgers) backed by automated unit tests.
- Obsessing over **perceived speed and mobile ergonomics** — optimistic UI updates, double-tap throttling, offline-capable PWA packaging, and responsive touch-friendly controls.

If you'd like to collaborate, discuss system architecture, or customize this platform, feel free to reach out at **syedkhubaibshah@icloud.com**.
