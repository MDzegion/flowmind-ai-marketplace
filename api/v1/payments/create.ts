import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
    supabase,
    checkPayment,
    MAYAR_API_KEY,
    MAYAR_API_BASE,
    APP_URL,
} from "../../_lib.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { agent_id, email } = req.body;

    if (!agent_id) return res.status(400).json({ error: "agent_id wajib diisi" });
    if (!email) return res.status(400).json({ error: "Email wajib diisi" });

    if (!MAYAR_API_KEY) {
        return res
            .status(500)
            .json({ error: "Payment gateway belum dikonfigurasi (MAYAR_API_KEY missing)" });
    }

    const { data: agent, error: agentErr } = await supabase
        .from("agents")
        .select("id, name, price, description")
        .eq("id", agent_id)
        .single();

    if (agentErr || !agent)
        return res.status(404).json({ error: "Agent tidak ditemukan" });

    if (!agent.price || agent.price === 0) {
        return res.json({
            free: true,
            message: "Agent ini gratis, tidak perlu pembayaran",
        });
    }

    const alreadyPaid = await checkPayment(agent_id, agent.price);
    if (alreadyPaid) {
        return res.json({
            already_paid: true,
            message: "Sudah dibayar, silakan gunakan agent",
        });
    }

    try {
        const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const mayarRes = await fetch(`${MAYAR_API_BASE}/payment`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${MAYAR_API_KEY}`,
            },
            body: JSON.stringify({
                name: `FlowMind - ${agent.name}`,
                email,
                amount: agent.price,
                description: `Pembayaran untuk AI Agent: ${agent.name}`,
                redirectURL: `${APP_URL}?paid=${agent_id}`,
                expiredAt,
            }),
        });

        if (!mayarRes.ok) {
            const errBody = await mayarRes.text();
            console.error("Mayar API error:", errBody);
            throw new Error(`Mayar API HTTP ${mayarRes.status}: ${errBody}`);
        }

        const mayarData = (await mayarRes.json()) as {
            data?: { id?: string; link?: string; paymentUrl?: string };
            statusCode?: number;
        };

        const paymentUrl =
            mayarData.data?.link || mayarData.data?.paymentUrl || "";
        const mayarTxId = mayarData.data?.id || "";

        if (!paymentUrl) {
            console.error(
                "Mayar response missing payment URL:",
                JSON.stringify(mayarData)
            );
            throw new Error("Gagal mendapatkan payment link dari Mayar");
        }

        const { data: tx, error: txErr } = await supabase
            .from("transactions")
            .insert([
                {
                    topic: agent_id,
                    amount: agent.price,
                    status: "waiting_payment",
                    payment_url: paymentUrl,
                },
            ])
            .select()
            .single();

        if (txErr) {
            console.error("Transaction insert error:", txErr.message);
        }

        console.log(
            `💳 Payment created: ${agent.name} | Rp ${agent.price} | Mayar ID: ${mayarTxId}`
        );

        return res.json({
            payment_url: paymentUrl,
            transaction_id: tx?.id || null,
            agent_name: agent.name,
            amount: agent.price,
        });
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("Payment create error:", errMsg);
        return res.status(500).json({ error: errMsg });
    }
}
