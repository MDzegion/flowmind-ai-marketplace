# 🧠 FlowMind AI — Agent Marketplace

Platform marketplace untuk AI Agent berbasis OpenRouter. Deploy, jual, dan gunakan AI agent untuk berbagai kebutuhan bisnis: riset pasar, copywriting, analisis data, SEO content, dan lainnya.

## ✨ Fitur

- **Marketplace AI Agent** — Browse dan gunakan berbagai AI agent siap pakai
- **Deploy Agent** — Buat dan deploy agent custom dengan system prompt sendiri
- **External Agent API** — Integrasikan agent eksternal via API URL
- **Payment Gateway** — Monetisasi agent berbayar via [Mayar](https://mayar.id)
- **Multi-Model Fallback** — Primary model + fallback otomatis jika quota habis

## 🛠 Tech Stack

- **Frontend:** React + TypeScript + Vite + Motion (Framer Motion)
- **Backend:** Express.js + TypeScript (tsx)
- **AI Engine:** OpenRouter API (LLaMA 3.1 8B)
- **Database:** Supabase (PostgreSQL)
- **Payment:** Mayar Payment Gateway

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- Akun [Supabase](https://supabase.com) (free tier OK)
- API Key [OpenRouter](https://openrouter.ai)

### Setup

1. Clone repository:
   ```bash
   git clone https://github.com/MDzegion/flowmind-ai-marketplace.git
   cd flowmind-ai-marketplace
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy dan isi environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` dan isi dengan API keys kamu.

4. Jalankan app:
   ```bash
   npm run dev
   ```

5. Buka http://localhost:3000

## 📁 Struktur Project

```
├── server.ts          # Express backend + API routes
├── migrate.ts         # Database migration script
├── src/
│   ├── App.tsx        # Main React app
│   ├── components/    # UI components (ResultView, ui)
│   ├── theme.ts       # Design tokens & theme
│   ├── types.ts       # TypeScript types
│   └── utils.ts       # Utility functions
├── .env.example       # Template environment variables
├── package.json
└── vite.config.ts
```

## 🔑 Environment Variables

| Variable | Deskripsi |
|---|---|
| `GEMINI_API_KEY` | API key Google Gemini (opsional) |
| `OPENROUTER_API_KEY` | API key OpenRouter untuk AI models |
| `APP_URL` | URL aplikasi (default: http://localhost:3000) |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key Supabase |
| `MAYAR_API_KEY` | API key Mayar payment gateway |
| `MAYAR_WEBHOOK_TOKEN` | Webhook token untuk verifikasi callback Mayar |

## 📄 License

MIT

---

Built with ❤️ by [FlowMind.ai](https://github.com/MDzegion)
