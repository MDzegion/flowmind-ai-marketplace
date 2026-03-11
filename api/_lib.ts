import { createClient } from "@supabase/supabase-js";

// ── Supabase ─────────────────────────────────────────────────────────────────
export const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── OpenRouter config ────────────────────────────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

export const PRIMARY_MODEL = "meta-llama/llama-3.1-8b-instruct";
export const FALLBACK_MODEL = "meta-llama/llama-3.1-8b-instruct:free";

// ── Mayar Payment Gateway config ─────────────────────────────────────────────
export const MAYAR_API_KEY = process.env.MAYAR_API_KEY || "";
export const MAYAR_WEBHOOK_TOKEN = process.env.MAYAR_WEBHOOK_TOKEN || "";
export const MAYAR_API_BASE = "https://api.mayar.id/hl/v1";
export const APP_URL = process.env.APP_URL || "https://flowmind-ai-marketplace.vercel.app";

/**
 * Call OpenRouter with a given model.
 */
export async function callOpenRouter(
    model: string,
    systemPrompt: string,
    userPrompt: string
): Promise<string> {
    const response = await fetch(OPENROUTER_BASE_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": APP_URL,
            "X-Title": "FlowMind AI",
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
        }),
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`OpenRouter HTTP ${response.status}: ${errBody}`);
    }

    const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
        error?: { message: string };
    };

    if (data.error) throw new Error(`OpenRouter error: ${data.error.message}`);

    return (data.choices?.[0]?.message?.content ?? "").trim();
}

/**
 * Strip markdown code fences and return clean JSON string.
 */
export function stripMarkdown(raw: string): string {
    return raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
}

/**
 * Call an external agent API.
 */
export async function callExternalAgent(
    url: string,
    prompt: string,
    agentId: string
): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        console.log(`🔗 Calling external agent API: ${url}`);
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-FlowMind-Agent-Id": agentId,
                "X-FlowMind-Source": "flowmind.ai",
            },
            body: JSON.stringify({ prompt, agent_id: agentId }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`External API HTTP ${response.status}: ${errBody}`);
        }

        return await response.json();
    } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
            throw new Error("External API timeout: tidak ada respons dalam 30 detik");
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Check payment status for a paid agent via transactions table.
 */
export async function checkPayment(
    agentId: string,
    price: number
): Promise<boolean> {
    if (!price || price === 0) return true;

    if (!MAYAR_API_KEY) {
        console.warn("⚠️  Payment check skipped: MAYAR_API_KEY not set (dev mode)");
        return true;
    }

    const { data, error } = await supabase
        .from("transactions")
        .select("id, status")
        .eq("topic", agentId)
        .eq("status", "paid")
        .limit(1);

    if (error) {
        console.warn("Payment check skipped (table error):", error.message);
        return true;
    }

    return data && data.length > 0;
}

// ── Seed agents data ─────────────────────────────────────────────────────────
const SEED_AGENTS = [
    {
        name: "Market Research Pro",
        description:
            "Analisis mendalam pasar bisnis: ukuran pasar, tren pertumbuhan, peluang & risiko. Output: laporan JSON terstruktur siap pakai.",
        skill: "market-research",
        price: 25000,
        owner_email: "platform@flowmind.ai",
        system_prompt: `Anda adalah Konsultan Bisnis Senior spesialis riset pasar.
WAJIB jawab dengan JSON murni tanpa markdown fence.
Format:
{
  "market_size": 1000000000,
  "growth_rate": 15,
  "confidence_score": 92,
  "summary": "Ringkasan eksekutif",
  "insights": ["insight 1","insight 2","insight 3","insight 4"],
  "opportunities": ["peluang 1","peluang 2","peluang 3"],
  "risks": ["risiko 1","risiko 2","risiko 3"]
}`,
        model: PRIMARY_MODEL,
    },
    {
        name: "Copywriting AI",
        description:
            "Buat konten marketing yang menarik: caption sosmed, headline iklan, email marketing, product description. Konversi tinggi!",
        skill: "copywriting",
        price: 15000,
        owner_email: "platform@flowmind.ai",
        system_prompt: `Anda adalah Copywriter Senior berpengalaman 10 tahun.
WAJIB jawab dengan JSON murni tanpa markdown fence.
Format:
{
  "headline": "Headline utama yang powerful",
  "subheadline": "Subheadline pendukung",
  "body_copy": "Body copy lengkap 2-3 paragraf",
  "cta": "Call-to-action text",
  "social_caption": "Caption untuk sosmed (IG/FB)",
  "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"]
}`,
        model: PRIMARY_MODEL,
    },
    {
        name: "Data Analyst AI",
        description:
            "Interpretasi data bisnis, temukan pola tersembunyi, buat rekomendasi berbasis data. Cocok untuk laporan mingguan/bulanan.",
        skill: "data-analysis",
        price: 30000,
        owner_email: "platform@flowmind.ai",
        system_prompt: `Anda adalah Data Analyst Senior dengan keahlian statistik bisnis.
WAJIB jawab dengan JSON murni tanpa markdown fence.
Format:
{
  "summary": "Ringkasan temuan utama",
  "key_metrics": [{"name": "Metric 1", "value": "...", "trend": "up/down/stable"}],
  "patterns": ["pola 1","pola 2","pola 3"],
  "recommendations": ["rekomendasi 1","rekomendasi 2","rekomendasi 3"],
  "forecast": "Proyeksi ke depan berdasarkan data"
}`,
        model: PRIMARY_MODEL,
    },
    {
        name: "SEO Content Writer",
        description:
            "Tulis artikel SEO-friendly dengan keyword research terintegrasi. Optimalkan konten untuk ranking Google halaman pertama.",
        skill: "seo-writing",
        price: 20000,
        owner_email: "platform@flowmind.ai",
        system_prompt: `Anda adalah SEO Specialist dan Content Writer ahli.
WAJIB jawab dengan JSON murni tanpa markdown fence.
Format:
{
  "title": "Judul artikel SEO-optimized",
  "meta_description": "Meta description 150-160 karakter",
  "keywords": ["keyword utama","keyword LSI 1","keyword LSI 2","keyword LSI 3"],
  "outline": ["H2: Section 1","H2: Section 2","H2: Section 3","H2: Section 4"],
  "intro": "Paragraf pembuka 100 kata",
  "content_tips": ["tip SEO 1","tip SEO 2","tip SEO 3"]
}`,
        model: PRIMARY_MODEL,
    },
];

export async function seedAgentsIfEmpty() {
    const { data, error } = await supabase.from("agents").select("id").limit(1);
    if (error) {
        console.warn("Could not check agents table:", error.message);
        return;
    }
    if (data && data.length === 0) {
        const { error: insertErr } = await supabase.from("agents").insert(SEED_AGENTS);
        if (insertErr) console.warn("Seed error:", insertErr.message);
        else console.log("✅ Seeded 4 demo agents");
    }
}
