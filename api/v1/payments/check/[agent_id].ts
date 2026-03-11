import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, MAYAR_API_KEY } from "../../../_lib";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { agent_id } = req.query;
    const agentId = Array.isArray(agent_id) ? agent_id[0] : agent_id;

    const { data: agent, error: agentErr } = await supabase
        .from("agents")
        .select("id, price")
        .eq("id", agentId)
        .single();

    if (agentErr || !agent)
        return res.status(404).json({ error: "Agent tidak ditemukan" });

    if (!agent.price || agent.price === 0) {
        return res.json({ paid: true, free: true });
    }

    if (!MAYAR_API_KEY) {
        return res.json({ paid: true, dev_mode: true });
    }

    const { data: txs, error: txErr } = await supabase
        .from("transactions")
        .select("id, status, payment_url, created_at")
        .eq("topic", agentId)
        .order("created_at", { ascending: false })
        .limit(1);

    if (txErr) {
        return res.json({ paid: true, error: "table_error" });
    }

    if (txs && txs.length > 0) {
        const latest = txs[0];
        return res.json({
            paid: latest.status === "paid",
            status: latest.status,
            payment_url:
                latest.status === "waiting_payment" ? latest.payment_url : undefined,
        });
    }

    return res.json({ paid: false, status: "no_transaction" });
}
