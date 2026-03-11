import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ── OpenRouter config ─────────────────────────────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

// Primary model → Fallback model
const PRIMARY_MODEL = "meta-llama/llama-3.1-8b-instruct";
const FALLBACK_MODEL = "meta-llama/llama-3.1-8b-instruct:free";

// ── Mayar Payment Gateway config ──────────────────────────────────────────────
const MAYAR_API_KEY = process.env.MAYAR_API_KEY || "";
const MAYAR_WEBHOOK_TOKEN = process.env.MAYAR_WEBHOOK_TOKEN || "";
const MAYAR_API_BASE = "https://api.mayar.id/hl/v1";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

/**
 * Call OpenRouter with a given model.
 * Returns the raw text content from the assistant message.
 */
async function callOpenRouter(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(OPENROUTER_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:3000",
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

  const data = await response.json() as {
    choices?: { message?: { content?: string } }[];
    error?: { message: string };
  };

  if (data.error) throw new Error(`OpenRouter error: ${data.error.message}`);

  return (data.choices?.[0]?.message?.content ?? "").trim();
}

/**
 * Strip markdown code fences and return clean JSON string.
 */
function stripMarkdown(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

/**
 * Call an external agent API.
 * Sends the user prompt and expects a JSON response.
 */
async function callExternalAgent(url: string, prompt: string, agentId: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

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

    const data = await response.json();
    return data;
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
 * Returns true if payment is valid, false otherwise.
 */
async function checkPayment(agentId: string, price: number): Promise<boolean> {
  // Free agents always pass
  if (!price || price === 0) return true;

  // If Mayar is not configured, skip payment check (dev mode)
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

  // If transactions table doesn't exist or error, allow execution (dev mode)
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
    description: "Analisis mendalam pasar bisnis: ukuran pasar, tren pertumbuhan, peluang & risiko. Output: laporan JSON terstruktur siap pakai.",
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
    description: "Buat konten marketing yang menarik: caption sosmed, headline iklan, email marketing, product description. Konversi tinggi!",
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
    description: "Interpretasi data bisnis, temukan pola tersembunyi, buat rekomendasi berbasis data. Cocok untuk laporan mingguan/bulanan.",
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
    description: "Tulis artikel SEO-friendly dengan keyword research terintegrasi. Optimalkan konten untuk ranking Google halaman pertama.",
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

async function seedAgentsIfEmpty() {
  const { data, error } = await supabase.from("agents").select("id").limit(1);
  if (error) {
    console.warn("Could not check agents table (may not exist yet):", error.message);
    return;
  }
  if (data && data.length === 0) {
    const { error: insertErr } = await supabase.from("agents").insert(SEED_AGENTS);
    if (insertErr) console.warn("Seed error:", insertErr.message);
    else console.log("✅ Seeded 4 demo agents");
  }
}

// ── Server ─────────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // GET /api/v1/agents — list all active agents
  app.get("/api/v1/agents", async (_req, res) => {
    const { data, error } = await supabase
      .from("agents")
      .select("id, name, description, skill, price, owner_email, run_count, created_at, external_api_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ agents: data });
  });

  // POST /api/v1/agents — deploy a new agent
  app.post("/api/v1/agents", async (req, res) => {
    const { name, description, skill, price, owner_email, system_prompt, model, external_api_url } = req.body;

    if (!name || !description || !skill || !owner_email) {
      return res.status(400).json({ error: "Nama, deskripsi, skill, dan email wajib diisi" });
    }

    // Either system_prompt or external_api_url must be provided
    if (!system_prompt && !external_api_url) {
      return res.status(400).json({ error: "System prompt atau External API URL harus diisi" });
    }

    const { data, error } = await supabase
      .from("agents")
      .insert([{
        name, description, skill,
        price: price || 0,
        owner_email,
        system_prompt: system_prompt || `Agent eksternal: ${name}`,
        model: model || PRIMARY_MODEL,
        is_active: true,
        run_count: 0,
        external_api_url: external_api_url || null,
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    console.log(`✅ Agent deployed: ${name}${external_api_url ? ' (external)' : ''}`);
    res.json({ agent: data });
  });

  // POST /api/v1/agents/:id/run — execute an agent
  app.post("/api/v1/agents/:id/run", async (req, res) => {
    const { id } = req.params;
    const { prompt } = req.body;

    if (!prompt) return res.status(400).json({ error: "prompt wajib diisi" });

    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("*")
      .eq("id", id)
      .single();

    if (agentErr || !agent) return res.status(404).json({ error: "Agent tidak ditemukan" });

    try {
      // ── PAYMENT CHECK (all paid agents) ──
      const paymentOk = await checkPayment(id, agent.price);
      if (!paymentOk) {
        return res.status(402).json({
          error: "Pembayaran diperlukan sebelum menggunakan agent ini.",
          requires_payment: true,
          price: agent.price,
        });
      }

      // ── EXTERNAL AGENT ROUTING ──
      if (agent.external_api_url) {
        const externalResult = await callExternalAgent(agent.external_api_url, prompt, id);

        // Increment run count
        await supabase
          .from("agents")
          .update({ run_count: (agent.run_count || 0) + 1 })
          .eq("id", id);

        console.log(`✅ External agent success: ${agent.name}`);
        return res.json({
          result: externalResult,
          agent: { id: agent.id, name: agent.name, skill: agent.skill },
          model_used: "external",
          source: "external_api",
        });
      }

      // ── INTERNAL OPENROUTER ROUTING ──
      const modelsToTry = [
        agent.model || PRIMARY_MODEL,
        FALLBACK_MODEL,
      ].filter((m, i, arr) => arr.indexOf(m) === i);

      let lastErr: unknown;

      for (const model of modelsToTry) {
        try {
          console.log(`🤖 Trying model: ${model}`);

          const raw = await callOpenRouter(model, agent.system_prompt, prompt);
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
            .eq("id", id);

          console.log(`✅ Success with model: ${model}`);
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
            console.warn(`⚠️  Model ${model} quota/rate-limit hit, trying fallback...`);
            continue;
          }

          console.error("Agent run error:", errMsg);
          return res.status(500).json({ error: errMsg });
        }
      }

      const finalMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
      console.error("All models exhausted:", finalMsg);
      return res.status(503).json({
        error: "Semua model AI sedang sibuk (quota habis). Coba lagi dalam beberapa menit.",
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Agent run error:", errMsg);
      return res.status(500).json({ error: errMsg });
    }
  });

  // DELETE /api/v1/agents/:id — hard delete an agent from database
  app.delete("/api/v1/agents/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const { data: agent, error: findErr } = await supabase
        .from("agents")
        .select("id, name")
        .eq("id", id)
        .single();

      if (findErr || !agent) return res.status(404).json({ error: "Agent tidak ditemukan" });

      // Try hard delete first
      const { error: deleteErr } = await supabase
        .from("agents")
        .delete()
        .eq("id", id);

      if (deleteErr) {
        // Fallback: soft-delete if hard delete fails (RLS/constraints)
        console.warn(`Hard delete failed, falling back to soft-delete: ${deleteErr.message}`);
        const { error: softErr } = await supabase
          .from("agents")
          .update({ is_active: false })
          .eq("id", id);

        if (softErr) return res.status(500).json({ error: softErr.message });
      }

      console.log(`🗑️  Agent deleted: ${agent.name} (${id})`);
      return res.json({ success: true, message: `Agent "${agent.name}" berhasil dihapus` });
    } catch (err) {
      console.error("Delete error:", err);
      return res.status(500).json({ error: err instanceof Error ? err.message : "Gagal menghapus agent" });
    }
  });

  // GET /api/v1/agents/:id — get single agent
  app.get("/api/v1/agents/:id", async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase.from("agents").select("*").eq("id", id).single();
    if (error) return res.status(404).json({ error: "Agent tidak ditemukan" });
    res.json({ agent: data });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // MAYAR PAYMENT GATEWAY ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════════════

  // POST /api/v1/payments/create — create Mayar payment link for an agent
  app.post("/api/v1/payments/create", async (req, res) => {
    const { agent_id, email } = req.body;

    if (!agent_id) return res.status(400).json({ error: "agent_id wajib diisi" });
    if (!email) return res.status(400).json({ error: "Email wajib diisi" });

    if (!MAYAR_API_KEY) {
      return res.status(500).json({ error: "Payment gateway belum dikonfigurasi (MAYAR_API_KEY missing)" });
    }

    // Fetch agent to get price
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("id, name, price, description")
      .eq("id", agent_id)
      .single();

    if (agentErr || !agent) return res.status(404).json({ error: "Agent tidak ditemukan" });

    if (!agent.price || agent.price === 0) {
      return res.json({ free: true, message: "Agent ini gratis, tidak perlu pembayaran" });
    }

    // Check if already paid
    const alreadyPaid = await checkPayment(agent_id, agent.price);
    if (alreadyPaid) {
      return res.json({ already_paid: true, message: "Sudah dibayar, silakan gunakan agent" });
    }

    try {
      // Create payment link via Mayar API
      const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      const mayarRes = await fetch(`${MAYAR_API_BASE}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${MAYAR_API_KEY}`,
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

      const mayarData = await mayarRes.json() as {
        data?: { id?: string; link?: string; paymentUrl?: string };
        statusCode?: number;
      };

      const paymentUrl = mayarData.data?.link || mayarData.data?.paymentUrl || "";
      const mayarTxId = mayarData.data?.id || "";

      if (!paymentUrl) {
        console.error("Mayar response missing payment URL:", JSON.stringify(mayarData));
        throw new Error("Gagal mendapatkan payment link dari Mayar");
      }

      // Save transaction to database
      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .insert([{
          topic: agent_id,
          amount: agent.price,
          status: "waiting_payment",
          payment_url: paymentUrl,
        }])
        .select()
        .single();

      if (txErr) {
        console.error("Transaction insert error:", txErr.message);
      }

      console.log(`💳 Payment created: ${agent.name} | Rp ${agent.price} | Mayar ID: ${mayarTxId}`);

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
  });

  // POST /api/v1/payments/webhook — Mayar webhook callback
  app.post("/api/v1/payments/webhook", async (req, res) => {
    // Verify webhook token if configured
    if (MAYAR_WEBHOOK_TOKEN) {
      const token = req.headers["x-callback-token"] || req.headers["x-mayar-token"];
      if (token !== MAYAR_WEBHOOK_TOKEN) {
        console.warn("⚠️  Invalid webhook token received");
        return res.status(401).json({ error: "Invalid webhook token" });
      }
    }

    const { event, data } = req.body;
    console.log(`🔔 Mayar webhook: event=${event}`, JSON.stringify(data).slice(0, 200));

    // Handle payment success events
    if (event === "payment.received" || event === "payment.success") {
      const paymentId = data?.id;
      const paymentStatus = data?.status;

      if (paymentId && (paymentStatus === "paid" || paymentStatus === "completed" || paymentStatus === "success")) {
        // Find transaction by payment_url containing the Mayar ID
        const { data: txs, error: findErr } = await supabase
          .from("transactions")
          .select("id, topic, payment_url")
          .eq("status", "waiting_payment")
          .order("created_at", { ascending: false })
          .limit(50);

        if (!findErr && txs) {
          // Match by payment URL or most recent waiting transaction
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
  });

  // GET /api/v1/payments/check/:agent_id — check payment status for an agent
  app.get("/api/v1/payments/check/:agent_id", async (req, res) => {
    const { agent_id } = req.params;

    // Get agent price
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("id, price")
      .eq("id", agent_id)
      .single();

    if (agentErr || !agent) return res.status(404).json({ error: "Agent tidak ditemukan" });

    // Free agents are always accessible
    if (!agent.price || agent.price === 0) {
      return res.json({ paid: true, free: true });
    }

    // If Mayar not configured, grant access
    if (!MAYAR_API_KEY) {
      return res.json({ paid: true, dev_mode: true });
    }

    // Check transactions
    const { data: txs, error: txErr } = await supabase
      .from("transactions")
      .select("id, status, payment_url, created_at")
      .eq("topic", agent_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (txErr) {
      return res.json({ paid: true, error: "table_error" }); // Fail open
    }

    if (txs && txs.length > 0) {
      const latest = txs[0];
      return res.json({
        paid: latest.status === "paid",
        status: latest.status,
        payment_url: latest.status === "waiting_payment" ? latest.payment_url : undefined,
      });
    }

    return res.json({ paid: false, status: "no_transaction" });
  });

  // POST /api/generate-research — dynamic execution using agent's system_prompt or external API
  app.post("/api/generate-research", async (req, res) => {
    const { agent_id, prompt, topic } = req.body;
    const userPrompt = prompt || topic;

    if (!agent_id) return res.status(400).json({ error: "agent_id wajib diisi" });
    if (!userPrompt) return res.status(400).json({ error: "prompt/topic wajib diisi" });

    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agent_id)
      .single();

    if (agentErr || !agent) return res.status(404).json({ error: "Agent tidak ditemukan" });

    try {
      // ── PAYMENT CHECK (all paid agents) ──
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
        const externalResult = await callExternalAgent(agent.external_api_url, userPrompt, agent_id);

        await supabase
          .from("agents")
          .update({ run_count: (agent.run_count || 0) + 1 })
          .eq("id", agent_id);

        console.log(`✅ [generate-research] External agent success: ${agent.name}`);
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
        return res.status(400).json({ error: "Agent belum memiliki system_prompt" });
      }

      const modelsToTry = [
        agent.model || PRIMARY_MODEL,
        FALLBACK_MODEL,
      ].filter((m, i, arr) => arr.indexOf(m) === i);

      let lastErr: unknown;

      for (const model of modelsToTry) {
        try {
          console.log(`🔬 [generate-research] Agent: ${agent.name} | Model: ${model}`);

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

          console.log(`✅ [generate-research] Success with model: ${model}`);
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
            console.warn(`⚠️  [generate-research] ${model} quota hit, trying fallback...`);
            continue;
          }

          console.error("[generate-research] error:", errMsg);
          return res.status(500).json({ error: errMsg });
        }
      }

      const finalMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
      console.error("[generate-research] All models exhausted:", finalMsg);
      return res.status(503).json({
        error: "Semua model AI sedang sibuk. Coba lagi dalam beberapa menit.",
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[generate-research] error:", errMsg);
      return res.status(500).json({ error: errMsg });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🤖 Primary model : ${PRIMARY_MODEL}`);
    console.log(`🔄 Fallback model: ${FALLBACK_MODEL}`);
    await seedAgentsIfEmpty();
  });
}

startServer();
