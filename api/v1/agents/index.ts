import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, PRIMARY_MODEL, seedAgentsIfEmpty } from "../../_lib.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // ── GET /api/v1/agents — list all active agents ──
    if (req.method === "GET") {
        // Auto-seed on first call
        await seedAgentsIfEmpty();

        const { data, error } = await supabase
            .from("agents")
            .select(
                "id, name, description, skill, price, owner_email, run_count, created_at, external_api_url"
            )
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ agents: data });
    }

    // ── POST /api/v1/agents — deploy a new agent ──
    if (req.method === "POST") {
        const {
            name,
            description,
            skill,
            price,
            owner_email,
            system_prompt,
            model,
            external_api_url,
        } = req.body;

        if (!name || !description || !skill || !owner_email) {
            return res
                .status(400)
                .json({ error: "Nama, deskripsi, skill, dan email wajib diisi" });
        }

        if (!system_prompt && !external_api_url) {
            return res
                .status(400)
                .json({ error: "System prompt atau External API URL harus diisi" });
        }

        const { data, error } = await supabase
            .from("agents")
            .insert([
                {
                    name,
                    description,
                    skill,
                    price: price || 0,
                    owner_email,
                    system_prompt: system_prompt || `Agent eksternal: ${name}`,
                    model: model || PRIMARY_MODEL,
                    is_active: true,
                    run_count: 0,
                    external_api_url: external_api_url || null,
                },
            ])
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        console.log(
            `✅ Agent deployed: ${name}${external_api_url ? " (external)" : ""}`
        );
        return res.json({ agent: data });
    }

    return res.status(405).json({ error: "Method not allowed" });
}
