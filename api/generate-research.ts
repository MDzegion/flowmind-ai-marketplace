import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
    supabase,
    PRIMARY_MODEL,
    FALLBACK_MODEL,
    callOpenRouter,
    stripMarkdown,
    callExternalAgent,
    checkPayment,
} from "../_lib.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { agent_id, prompt, topic } = req.body;
    const userPrompt = prompt || topic;

    if (!agent_id) return res.status(400).json({ error: "agent_id wajib diisi" });
    if (!userPrompt)
        return res.status(400).json({ error: "prompt/topic wajib diisi" });

    const { data: agent, error: agentErr } = await supabase
        .from("agents")
        .select("*")
        .eq("id", agent_id)
        .single();

    if (agentErr || !agent)
        return res.status(404).json({ error: "Agent tidak ditemukan" });

    try {
        // ── PAYMENT CHECK ──
        const paymentOk = await checkPayment(agent_id, agent.price);
        if (!paymentOk) {
            return res.status(402).json({
                error: "Pembayaran diperlukan sebelum menggunakan agent ini.",
                requires_payment: true,
                price: agent.price,
            });
        }

        // ── EXTERNAL AGENT ROUTING ──
        if (agent.external_api_url) {
            const externalResult = await callExternalAgent(
                agent.external_api_url,
                userPrompt,
                agent_id
            );

            await supabase
                .from("agents")
                .update({ run_count: (agent.run_count || 0) + 1 })
                .eq("id", agent_id);

            console.log(
                `✅ [generate-research] External agent success: ${agent.name}`
            );
            return res.json({
                result: externalResult,
                agent: { id: agent.id, name: agent.name, skill: agent.skill },
                model_used: "external",
                source: "external_api",
            });
        }

        // ── INTERNAL OPENROUTER ROUTING ──
        const systemPrompt = agent.system_prompt;
        if (!systemPrompt) {
            return res
                .status(400)
                .json({ error: "Agent belum memiliki system_prompt" });
        }

        const modelsToTry = [
            agent.model || PRIMARY_MODEL,
            FALLBACK_MODEL,
        ].filter((m: string, i: number, arr: string[]) => arr.indexOf(m) === i);

        let lastErr: unknown;

        for (const model of modelsToTry) {
            try {
                console.log(
                    `🔬 [generate-research] Agent: ${agent.name} | Model: ${model}`
                );

                const raw = await callOpenRouter(model, systemPrompt, userPrompt);
                const cleaned = stripMarkdown(raw);

                let result: unknown;
                try {
                    result = JSON.parse(cleaned);
                } catch {
                    result = { text: cleaned };
                }

                await supabase
                    .from("agents")
                    .update({ run_count: (agent.run_count || 0) + 1 })
                    .eq("id", agent_id);

                console.log(
                    `✅ [generate-research] Success with model: ${model}`
                );
                return res.json({
                    result,
                    agent: { id: agent.id, name: agent.name, skill: agent.skill },
                    model_used: model,
                });
            } catch (err) {
                lastErr = err;
                const errMsg = err instanceof Error ? err.message : String(err);
                const isQuota =
                    errMsg.includes("429") ||
                    /\bquota\b/i.test(errMsg) ||
                    /\brate.?limit\b/i.test(errMsg) ||
                    /\btoo.?many.?request\b/i.test(errMsg);

                if (isQuota) {
                    console.warn(
                        `⚠️  [generate-research] ${model} quota hit, trying fallback...`
                    );
                    continue;
                }

                console.error("[generate-research] error:", errMsg);
                return res.status(500).json({ error: errMsg });
            }
        }

        const finalMsg =
            lastErr instanceof Error ? lastErr.message : String(lastErr);
        console.error("[generate-research] All models exhausted:", finalMsg);
        return res.status(503).json({
            error: "Semua model AI sedang sibuk. Coba lagi dalam beberapa menit.",
        });
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("[generate-research] error:", errMsg);
        return res.status(500).json({ error: errMsg });
    }
}
