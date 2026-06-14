# ShortFlow — AI-Powered YouTube Shorts Automation

Create, voice, and publish viral YouTube Shorts on autopilot. Enter a topic, pick a voice, and ShortFlow generates the script (Claude AI), voiceover (ElevenLabs), video (Canvas + FFmpeg), and publishes to YouTube — all from one dashboard.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [What You Can Do](#what-you-can-do)
3. [Quick Start](#quick-start)
4. [Full Workflow — Step by Step](#full-workflow--step-by-step)
   - [Sign Up](#1-sign-up)
   - [Create a Short with AI](#2-create-a-short-with-ai)
   - [Generate Video + Voiceover](#3-generate-video--voiceover)
   - [Publish to YouTube](#4-publish-to-youtube)
   - [Connect YouTube Channel](#5-connect-youtube-channel)
   - [Schedule Posts](#6-schedule-posts)
   - [Track Performance](#7-track-performance)
5. [Architecture](#architecture)
6. [Environment Variables](#environment-variables)
7. [Deploy to Production](#deploy-to-production)
8. [Plans & Billing](#plans--billing)

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + Vite + Tailwind CSS v4 | SPA with glass-morphism dark UI |
| **UI** | Lucide React + Framer Motion | Icons + page transitions |
| **Auth + DB** | Supabase (Postgres + Auth + Storage) | Users, shorts, channels, media files |
| **AI Scripts** | Claude Sonnet 4.6 (Anthropic API) | Script generation, SEO scoring |
| **Voiceover** | ElevenLabs (Turbo v2) | 6 voices — 3 male, 3 female |
| **Video** | @napi-rs/canvas + FFmpeg | 1080x1920 HD video with timed text scenes |
| **YouTube** | Google OAuth 2.0 + YouTube Data API v3 | Channel connection + video upload |
| **Payments** | Stripe (Checkout + Webhooks) | Free / Creator / Agency plans |
| **Frontend Host** | Vercel | Free tier |
| **Backend Host** | Railway | ~$5/mo |

---

## What You Can Do

| Feature | Description |
|---|---|
| **AI Script Generation** | Enter a topic → Claude writes hook, script, description, tags, SEO score, viral score |
| **6 Voice Options** | Choose male or female — Josh, Arnold, Adam, Rachel, Domi, Bella |
| **1080p Video Generation** | Canvas renders styled scenes → FFmpeg assembles HD MP4 with voiceover |
| **YouTube Auto-Publish** | OAuth-connect your channel → publish directly with privacy settings |
| **Library Management** | All drafts, generating, ready, scheduled, published, and failed shorts |
| **Schedule Builder** | Set weekly posting slots — auto-publish at scheduled times |
| **Analytics Dashboard** | Views, likes, comments, watch time, subscriber growth |
| **Stripe Billing** | Free (10/mo), Creator ($19/mo, 50), Agency ($49/mo, unlimited) |
| **Modern UI** | Dark glass-morphism design with Tailwind, Lucide icons, Framer Motion animations |

---

## Quick Start

### Prerequisites
- Node.js 18+
- [Supabase](https://supabase.com) project (free)
- [Anthropic](https://console.anthropic.com) API key ($5 credit)
- [ElevenLabs](https://elevenlabs.io) API key (free or $5 credits)
- [Google Cloud](https://console.cloud.google.com) project with YouTube Data API v3

### 1. Database
```bash
# Create a Supabase project, then run the schema:
# Supabase Dashboard → SQL Editor → paste backend/schema.sql → Run

# Also create a storage bucket:
# Supabase Dashboard → Storage → New bucket → "shorts-media" (public)

# Authentication → URL Configuration:
#   Site URL: http://localhost:5173
#   Redirect URLs: http://localhost:5173
```

### 2. Frontend
```bash
cd frontend
cp .env.example .env
# Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
npm install
npm run dev   # → http://localhost:5173
```

### 3. Backend
```bash
cd backend
cp .env.example .env
# Set all API keys (see Environment Variables below)
npm install
npm run dev   # → http://localhost:3001
```

---

## Full Workflow — Step by Step

### 1. Sign Up

1. Open the app → click **Sign up free**
2. Enter name, email, password (min 6 characters)
3. Check email → click confirmation link
4. Redirected to Dashboard — you're logged in

> Free plan: 10 shorts/month, no credit card needed.

---

### 2. Create a Short with AI

Navigate to **Create** in the sidebar.

**Example inputs:**

| Field | Value |
|---|---|
| Topic | `5 Python tricks every developer should know` |
| Niche | Tech & Programming |
| Style | Talking Head |
| Tone | Energetic & Engaging |
| Duration | 45–60 seconds |

Click **Generate Short** → Claude AI writes:

```
Title:       "5 Python Tricks That Will 10x Your Code Speed"
Hook:        "Stop writing slow Python. Here's what senior devs actually do..."
Script:      [HOOK] Stop writing slow Python...
             [MAIN] Trick 1: List comprehensions instead of loops...
             Trick 2: Use walrus operator...
             Trick 3: F-strings over format()...
             [CTA] Follow for daily Python tips!
Tags:        #python #coding #shorts #viral #programming
SEO Score:   88 / 100
Viral Score: 82 / 100
Key Points:  ["List comprehensions", "Walrus operator", "F-strings"]
```

The short is saved to your Library as a **draft**.

**Topic ideas by niche:**

| Niche | Topic |
|---|---|
| Finance | `How to save $1000 in 30 days` |
| Health | `The 5-minute morning routine that changed my life` |
| Gaming | `3 settings pro players always use in Valorant` |
| Motivation | `One habit that separates millionaires from everyone else` |
| True Crime | `The strangest unsolved disappearance of 2023` |
| Food | `The $2 meal that tastes like a $50 restaurant dish` |

---

### 3. Generate Video + Voiceover

In the **Library**, click a draft short → you'll see a detail modal.

1. **Choose a voice** — toggle Male/Female, then pick one:
   - **Male**: Josh (deep), Arnold (strong), Adam (calm)
   - **Female**: Rachel (warm), Domi (energetic), Bella (soft)
2. Click **Generate Video**
3. Wait ~1-2 minutes — the pipeline:
   - Sends script to ElevenLabs → generates MP3 voiceover
   - Uploads audio to Supabase Storage
   - Renders 5 timed scene frames with @napi-rs/canvas:
     - Scene 1: Hook (attention grabber)
     - Scenes 2-4: Key points with step numbers
     - Scene 5: Call-to-action
   - FFmpeg combines frames + audio → 1080x1920 MP4
   - Uploads video to Supabase Storage
4. Status changes to **ready** → video preview appears in the modal

---

### 4. Publish to YouTube

Once a video is **ready**:

1. Select your connected channel from the dropdown
2. Choose privacy: **Public** / **Unlisted** / **Private**
3. Click **Publish Now**
4. OAuth token auto-refreshes → video uploads to YouTube
5. Status changes to **published** → YouTube link appears

---

### 5. Connect YouTube Channel

Navigate to **Channels** in the sidebar.

1. Click **Add YouTube Channel**
2. Google OAuth prompt → sign in and grant permissions
3. Channel name, subscribers, and thumbnail appear
4. Channel is now available for publishing

**Requirements:**
- Google Cloud project with YouTube Data API v3 enabled
- OAuth 2.0 credentials (Web application type)
- Redirect URI: `https://your-backend-url/api/youtube/callback`
- Add yourself as a Test User in the OAuth consent screen (while in testing mode)

---

### 6. Schedule Posts

Navigate to **Schedule** in the sidebar.

- Set weekly posting slots (day + time)
- Pick a short from your Library
- Choose which channel to publish to
- Backend cron job auto-publishes at scheduled times

---

### 7. Track Performance

Navigate to **Analytics** in the sidebar.

- Views, likes, comments, shares (last 30 days)
- Subscriber growth
- Watch time
- Per-short performance breakdown

---

## Architecture

```
shortflow/
├── frontend/                        # React 18 + Vite + Tailwind CSS v4
│   ├── src/
│   │   ├── pages/                   # Dashboard, Create, Library, Schedule,
│   │   │                            # Channels, Analytics, Pricing, Settings, Auth
│   │   ├── components/              # Sidebar (Lucide icons), Topbar, Modal
│   │   ├── hooks/                   # useAuth, useTheme, useToast
│   │   ├── lib/                     # supabase.js (client), api.js (backend calls)
│   │   └── styles/                  # globals.css (Tailwind + glass-morphism tokens)
│   ├── vite.config.js               # Vite + @tailwindcss/vite plugin
│   └── package.json
├── backend/                         # Node.js + Express
│   ├── src/
│   │   ├── routes/
│   │   │   ├── generate.js          # Claude AI script generation
│   │   │   ├── video.js             # ElevenLabs + Canvas + FFmpeg pipeline
│   │   │   ├── publish.js           # YouTube upload with token refresh
│   │   │   ├── youtube.js           # OAuth flow + channel sync
│   │   │   ├── voice.js             # ElevenLabs voiceover API
│   │   │   ├── billing.js           # Stripe checkout + webhooks
│   │   │   ├── schedule.js          # Scheduled posts
│   │   │   └── analytics.js         # YouTube analytics sync
│   │   ├── middleware/auth.js       # Supabase JWT verification
│   │   └── server.js               # Express app + CORS + rate limiting
│   ├── schema.sql                   # Supabase Postgres schema + RLS policies
│   ├── nixpacks.toml                # Railway build config (FFmpeg)
│   └── package.json
└── docs/
    └── LAUNCH_GUIDE.md
```

### Video Generation Pipeline

```
Topic → Claude AI → Script + Hook + Key Points + SEO Score
                         ↓
              ElevenLabs Turbo v2 → MP3 Voiceover
                         ↓
              @napi-rs/canvas → PNG Frames (5 scenes)
                         ↓
              FFmpeg concat + audio → 1080x1920 MP4
                         ↓
              Supabase Storage → video_url
                         ↓
              YouTube Data API v3 → Published Short
```

---

## Environment Variables

### Frontend (`frontend/.env`)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3001/api          # Local
# VITE_API_URL=https://your-backend.railway.app/api  # Production
```

### Backend (`backend/.env`)
```bash
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key      # NOT the anon key

# AI
ANTHROPIC_API_KEY=sk-ant-...                    # Claude Sonnet 4.6

# Voiceover
ELEVENLABS_API_KEY=...                          # ElevenLabs API

# YouTube
YOUTUBE_CLIENT_ID=...                           # Google Cloud OAuth
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REDIRECT_URI=http://localhost:3001/api/youtube/callback

# Payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CREATOR_PRICE_ID=price_...
STRIPE_AGENCY_PRICE_ID=price_...

# App
PORT=3001
FRONTEND_URL=http://localhost:5173
```

---

## Deploy to Production

| Service | What | Cost |
|---|---|---|
| [Vercel](https://vercel.com) | Frontend | Free |
| [Railway](https://railway.app) | Backend | ~$5/mo |
| [Supabase](https://supabase.com) | DB + Auth + Storage | Free tier |
| [ElevenLabs](https://elevenlabs.io) | Voiceover | Free / $5 credits |
| [Anthropic](https://console.anthropic.com) | Claude AI | ~$5/mo |

### Steps

1. **Supabase** — create project, run `schema.sql`, create `shorts-media` storage bucket (public)
2. **Railway** — deploy from GitHub, root: `backend/`, add all backend env vars
3. **Vercel** — deploy from GitHub, root: `frontend/`, add frontend env vars
4. **Google Cloud** — create OAuth credentials, set redirect URI to Railway URL
5. Update `VITE_API_URL` in Vercel to `https://your-backend.railway.app/api`
6. Update `FRONTEND_URL` in Railway to `https://your-app.vercel.app`
7. Update Supabase Auth URL Configuration with production domain

See `docs/LAUNCH_GUIDE.md` for the full step-by-step guide.

---

## Plans & Billing

| Plan | Shorts/Month | Price | Features |
|---|---|---|---|
| **Free** | 10 | $0 | All core features, 1 channel |
| **Creator** | 50 | $19/mo | Priority generation, analytics export |
| **Agency** | Unlimited | $49/mo | Multiple channels, team seats |

Billing via Stripe. Upgrade from the **Pricing** page in the sidebar.

---

## What Changed in the Latest Redesign

| Before | After |
|---|---|
| Inline styles everywhere | **Tailwind CSS v4** with design tokens |
| Emoji icons | **Lucide React** icon library |
| No page transitions | **Framer Motion** AnimatePresence |
| Basic dark theme | **Glass-morphism** dark UI (backdrop-blur, transparency) |
| Mock data fallback | **Real Supabase data** only |
| Creatomate cloud rendering | **Canvas + FFmpeg** (no external API, no watermark, full 1080p) |
| No voice selection | **6 ElevenLabs voices** with Male/Female picker |
| No video preview | **In-modal video player** before publishing |
| Token expired on publish | **Auto-refresh** OAuth tokens before upload |
| `localhost` API URL in prod | **Proper env var** configuration |
