import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../../../_lib.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id } = req.query;
    const agentId = Array.isArray(id) ? id[0] : id;

    // ── GET /api/v1/agents/:id — get single agent ──
    if (req.method === "GET") {
        const { data, error } = await supabase
            .from("agents")
            .select("*")
            .eq("id", agentId)
            .single();

        if (error) return res.status(404).json({ error: "Agent tidak ditemukan" });
        return res.json({ agent: data });
    }

    // ── DELETE /api/v1/agents/:id — delete agent ──
    if (req.method === "DELETE") {
        try {
            const { data: agent, error: findErr } = await supabase
                .from("agents")
                .select("id, name")
                .eq("id", agentId)
                .single();

            if (findErr || !agent)
                return res.status(404).json({ error: "Agent tidak ditemukan" });

            const { error: deleteErr } = await supabase
                .from("agents")
                .delete()
                .eq("id", agentId);

            if (deleteErr) {
                console.warn(
                    `Hard delete failed, falling back to soft-delete: ${deleteErr.message}`
                );
                const { error: softErr } = await supabase
                    .from("agents")
                    .update({ is_active: false })
                    .eq("id", agentId);

                if (softErr) return res.status(500).json({ error: softErr.message });
            }

            console.log(`🗑️  Agent deleted: ${agent.name} (${agentId})`);
            return res.json({
                success: true,
                message: `Agent "${agent.name}" berhasil dihapus`,
            });
        } catch (err) {
            console.error("Delete error:", err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : "Gagal menghapus agent",
            });
        }
    }

    return res.status(405).json({ error: "Method not allowed" });
}
