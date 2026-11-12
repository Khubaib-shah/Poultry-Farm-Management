import { createPool } from './index.ts';

declare global {
  var _schemaReadyPromise: Promise<void> | undefined;
}

const REQUIRED_TABLES = [
  'users',
  'suppliers',
  'vehicles',
  'purchase_loads',
  'load_expenses',
  'stock_batches',
  'stock_movements',
  'dealer_transactions',
  'shops',
  'sales',
  'sale_items',
  'workers',
  'worker_payments',
  'business_expenses',
  'settings',
];

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "uid" text NOT NULL UNIQUE,
  "email" text NOT NULL,
  "name" text,
  "role" text DEFAULT 'admin' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "address" text,
  "opening_balance" numeric(14, 2) DEFAULT '0.00' NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "vehicles" (
  "id" serial PRIMARY KEY NOT NULL,
  "vehicle_number" text NOT NULL,
  "driver_name" text,
  "driver_phone" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "purchase_loads" (
  "id" serial PRIMARY KEY NOT NULL,
  "load_number" text NOT NULL UNIQUE,
  "supplier_id" integer NOT NULL REFERENCES "suppliers"("id"),
  "purchase_date" date NOT NULL,
  "total_weight_kg" numeric(10, 2) NOT NULL,
  "purchase_amount" numeric(14, 2) NOT NULL,
  "vehicle_number" text,
  "driver_name" text,
  "status" text DEFAULT 'RECEIVED' NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "load_expenses" (
  "id" serial PRIMARY KEY NOT NULL,
  "purchase_load_id" integer NOT NULL REFERENCES "purchase_loads"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "expense_date" date NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stock_batches" (
  "id" serial PRIMARY KEY NOT NULL,
  "batch_number" text NOT NULL UNIQUE,
  "purchase_load_id" integer NOT NULL UNIQUE REFERENCES "purchase_loads"("id"),
  "receiving_date" date NOT NULL,
  "received_pieces" integer NOT NULL,
  "dead_pieces" integer DEFAULT 0 NOT NULL,
  "damaged_pieces" integer DEFAULT 0 NOT NULL,
  "original_saleable_pieces" integer NOT NULL,
  "sold_pieces" integer DEFAULT 0 NOT NULL,
  "remaining_pieces" integer NOT NULL,
  "purchase_amount" numeric(14, 2) NOT NULL,
  "total_load_expenses" numeric(14, 2) DEFAULT '0.00' NOT NULL,
  "total_landed_cost" numeric(14, 2) NOT NULL,
  "cost_per_piece" numeric(10, 2) NOT NULL,
  "is_closed" boolean DEFAULT false NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id" serial PRIMARY KEY NOT NULL,
  "stock_batch_id" integer NOT NULL REFERENCES "stock_batches"("id"),
  "movement_type" text NOT NULL,
  "quantity" integer NOT NULL,
  "balance_after" integer NOT NULL,
  "unit_cost" numeric(10, 2) NOT NULL,
  "reference_type" text,
  "reference_id" integer,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dealer_transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "supplier_id" integer NOT NULL REFERENCES "suppliers"("id"),
  "transaction_date" date NOT NULL,
  "transaction_type" text NOT NULL,
  "debit_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
  "credit_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
  "balance_after" numeric(14, 2) NOT NULL,
  "reference_type" text,
  "reference_id" integer,
  "payment_method" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "shops" (
  "id" serial PRIMARY KEY NOT NULL,
  "shop_name" text NOT NULL,
  "owner_name" text,
  "phone" text,
  "address" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sales" (
  "id" serial PRIMARY KEY NOT NULL,
  "invoice_number" text NOT NULL UNIQUE,
  "sale_type" text NOT NULL,
  "sale_date" date NOT NULL,
  "shop_id" integer REFERENCES "shops"("id"),
  "total_pieces" integer NOT NULL,
  "total_amount" numeric(14, 2) NOT NULL,
  "total_cost" numeric(14, 2) NOT NULL,
  "total_profit" numeric(14, 2) NOT NULL,
  "selling_price_per_piece" numeric(10, 2) NOT NULL,
  "cost_per_piece" numeric(10, 2) NOT NULL,
  "profit_per_piece" numeric(10, 2) NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sale_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "sale_id" integer NOT NULL REFERENCES "sales"("id") ON DELETE CASCADE,
  "stock_batch_id" integer NOT NULL REFERENCES "stock_batches"("id"),
  "quantity" integer NOT NULL,
  "unit_cost" numeric(10, 2) NOT NULL,
  "total_cost" numeric(14, 2) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workers" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "notes" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "worker_payments" (
  "id" serial PRIMARY KEY NOT NULL,
  "worker_id" integer NOT NULL REFERENCES "workers"("id"),
  "amount" numeric(12, 2) NOT NULL,
  "payment_date" date NOT NULL,
  "payment_method" text DEFAULT 'CASH',
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "business_expenses" (
  "id" serial PRIMARY KEY NOT NULL,
  "category" text NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "expense_date" date NOT NULL,
  "payment_method" text DEFAULT 'CASH',
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" text NOT NULL UNIQUE,
  "value" text NOT NULL,
  "description" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
`;

export function ensureSchema(): Promise<void> {
  if (!global._schemaReadyPromise) {
    global._schemaReadyPromise = (async () => {
      const pool = createPool();
      const checkRes = await pool.query<{ cnt: number }>(
        `SELECT count(*)::int AS cnt
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = ANY($1::text[])`,
        [REQUIRED_TABLES]
      );
      if ((checkRes.rows[0]?.cnt ?? 0) < REQUIRED_TABLES.length) {
        await pool.query(SCHEMA_DDL);
      }
    })().catch((err) => {
      global._schemaReadyPromise = undefined;
      throw err;
    });
  }
  return global._schemaReadyPromise;
}
