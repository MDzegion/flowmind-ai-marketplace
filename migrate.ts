// Migration: create/fix transactions table in Supabase
// Run with: node node_modules/.bin/tsx migrate.ts

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Use supabase-js v2 sql method (available in newer versions)
// Falls back to rpc if sql is not available
async function runMigration() {
    console.log("Running migration...");

    // Try using the sql tagged template (supabase-js >=2.39)
    try {
        const result = await (supabase as any).sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        topic text NOT NULL DEFAULT '',
        amount integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'waiting_payment',
        payment_url text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='topic') THEN
          ALTER TABLE transactions ADD COLUMN topic text NOT NULL DEFAULT '';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='amount') THEN
          ALTER TABLE transactions ADD COLUMN amount integer NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='status') THEN
          ALTER TABLE transactions ADD COLUMN status text NOT NULL DEFAULT 'waiting_payment';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='payment_url') THEN
          ALTER TABLE transactions ADD COLUMN payment_url text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='created_at') THEN
          ALTER TABLE transactions ADD COLUMN created_at timestamptz DEFAULT now();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='updated_at') THEN
          ALTER TABLE transactions ADD COLUMN updated_at timestamptz DEFAULT now();
        END IF;
      END $$;
    `;
        console.log("Migration result:", result);
    } catch (e: any) {
        // If sql method not available, try to insert a test row to see full schema error
        console.log("sql method error:", e.message);

        // Try a direct insert to diagnose the exact missing columns
        const { data, error } = await supabase
            .from("transactions")
            .insert([{ topic: "test", amount: 1000, status: "waiting_payment" }])
            .select()
            .single();

        if (error) {
            console.log("Insert test error:", error.message, error.details, error.hint);
        } else {
            console.log("Insert test worked! Row:", data);
            // Clean up test row
            await supabase.from("transactions").delete().eq("id", data.id);
            console.log("Table already has correct schema!");
        }
    }
}

runMigration().catch(console.error);
