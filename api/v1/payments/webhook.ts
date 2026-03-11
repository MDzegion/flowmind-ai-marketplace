import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, MAYAR_WEBHOOK_TOKEN } from "../../_lib.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // Verify webhook token if configured
    if (MAYAR_WEBHOOK_TOKEN) {
        const token =
            req.headers["x-callback-token"] || req.headers["x-mayar-token"];
        if (token !== MAYAR_WEBHOOK_TOKEN) {
            console.warn("⚠️  Invalid webhook token received");
            return res.status(401).json({ error: "Invalid webhook token" });
        }
    }

    const { event, data } = req.body;
    console.log(
        `🔔 Mayar webhook: event=${event}`,
        JSON.stringify(data).slice(0, 200)
    );

    if (event === "payment.received" || event === "payment.success") {
        const paymentId = data?.id;
        const paymentStatus = data?.status;

        if (
            paymentId &&
            (paymentStatus === "paid" ||
                paymentStatus === "completed" ||
                paymentStatus === "success")
        ) {
            const { data: txs, error: findErr } = await supabase
                .from("transactions")
                .select("id, topic, payment_url")
                .eq("status", "waiting_payment")
                .order("created_at", { ascending: false })
                .limit(50);

            if (!findErr && txs) {
                for (const tx of txs) {
                    if (tx.payment_url?.includes(paymentId) || txs.length === 1) {
                        await supabase
                            .from("transactions")
                            .update({ status: "paid", updated_at: new Date().toISOString() })
                            .eq("id", tx.id);

                        console.log(`✅ Payment confirmed for agent: ${tx.topic}`);
                        break;
                    }
                }
            }
        }
    }

    return res.json({ received: true });
}
