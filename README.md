# ShortFlow — YouTube Shorts Automation SaaS

AI-powered platform to create, schedule, and auto-publish viral YouTube Shorts. Describe a topic, pick a style, and ShortFlow writes the script, generates a voiceover, scores it for virality, and publishes it to YouTube — all on autopilot.

---

## Table of Contents

1. [What You Can Do](#what-you-can-do)
2. [Quick Start (Development)](#quick-start-development)
3. [Walkthrough with Examples](#walkthrough-with-examples)
   - [Sign Up & Log In](#1-sign-up--log-in)
   - [Create Your First Short](#2-create-your-first-short)
   - [Review & Save to Library](#3-review--save-to-library)
   - [Connect a YouTube Channel](#4-connect-a-youtube-channel)
   - [Schedule Publishing](#5-schedule-publishing)
   - [Track Analytics](#6-track-analytics)
   - [Manage Settings & Themes](#7-manage-settings--themes)
4. [Plans & Limits](#plans--limits)
5. [Project Structure](#project-structure)
6. [Environment Variables](#environment-variables)
7. [Deploy to Production](#deploy-to-production)

---

## What You Can Do

| Feature | Description |
|---|---|
| **AI Script Generation** | Enter a topic → Claude writes a hook, full script, description, and tags |
| **Viral & SEO Scoring** | Every short gets a viral score and SEO score out of 100 |
| **6 Video Styles** | Talking Head, Text Animation, B-Roll + VO, Slide Deck, Animation, Reddit Story |
| **10 Niches** | Tech, Finance, Health, Gaming, Education, Motivation, Food, Travel, True Crime, Business |
| **Voiceover Generation** | ElevenLabs integration generates an audio track from your script |
| **YouTube Auto-Publish** | OAuth-connect your channel and publish directly from the app |
| **Schedule Builder** | Set a weekly posting schedule — pick days/times and let it run |
| **Library** | All your drafts, scheduled, and published shorts in one place |
| **Analytics Dashboard** | Views, likes, comments, watch time, and subscriber growth |
| **7 Themes** | Dark, Light, Purple, Blue, Green, Rose, Amber |
| **Stripe Billing** | Free / Creator / Agency subscription tiers |

---

## Quick Start (Development)

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project (free)
- API keys: Anthropic (Claude), ElevenLabs, Stripe (optional), Google OAuth (optional for YouTube)

### 1. Database
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `backend/schema.sql`
3. Go to **Authentication → URL Configuration** and set:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: `http://localhost:3000`

### 2. Frontend
```bash
cd frontend
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev   # http://localhost:5173
```

### 3. Backend
```bash
cd backend
cp .env.example .env
# Fill in all API keys (see Environment Variables section)
npm install
npm run dev   # http://localhost:3001
```

---

## Walkthrough with Examples

### 1. Sign Up & Log In

1. Open `http://localhost:5173` (or your deployed URL)
2. Click **Sign up free** on the auth page
3. Enter your name, email, and a password (min 6 characters)
4. Check your email and click the confirmation link
5. You'll be redirected back and logged in automatically

> **Free plan** gives you 10 shorts per month — no credit card needed.

---

### 2. Create Your First Short

Navigate to **✨ Create** in the sidebar.

**Example: Tech short about Python**

| Field | Example Value |
|---|---|
| Topic | `5 Python tricks every developer should know` |
| Niche | `Tech & Programming` |
| Video Style | `Talking Head 🎤` |
| Tone | `Energetic & Engaging` |
| Duration | `45–60 seconds` |
| Language | `English` |

Click **Generate Short →** and the AI will:
1. Analyze the topic for trends
2. Write a viral hook + full script
3. Optimize title, description, and tags for YouTube SEO
4. Generate a voiceover (if ElevenLabs is configured)
5. Score it for virality and SEO

**Example output:**

```
Title:       "5 Python Tricks That Will 10x Your Code Speed"
Hook:        "You won't believe how much faster your Python can run..."
Script:      [HOOK] You won't believe...
             [MAIN] Here are the 5 tricks:
             1. List comprehensions...
             [CTA] Follow for more Python tips!
Tags:        #python #coding #programming #shorts #viral
Viral Score: 82 / 100
SEO Score:   88 / 100
```

**More topic ideas by niche:**

| Niche | Example Topic |
|---|---|
| Finance & Money | `How to save $1000 in 30 days` |
| Health & Fitness | `The 5-minute morning routine that changed my life` |
| Gaming | `3 settings pro players always use in Valorant` |
| Motivation | `One habit that separates millionaires from everyone else` |
| True Crime | `The strangest unsolved disappearance of 2023` |

---

### 3. Review & Save to Library

After generation you'll see a results card with the full script, scores, and metadata.

- Click **Save to Library →** to store it as a draft
- Click **+ New Short** to start fresh
- Go to **📚 Library** in the sidebar to see all your shorts

In the Library you can:
- Filter by status: Draft / Scheduled / Published
- Click a short to view the full script and metadata
- Delete shorts you no longer need

---

### 4. Connect a YouTube Channel

Navigate to **📺 Channels** in the sidebar.

1. Click **Connect YouTube Channel**
2. Sign in with your Google account and grant permissions
3. Your channel name, subscriber count, and thumbnail will appear

Once connected, you can select this channel when scheduling or publishing a short.

> YouTube OAuth requires a Google Cloud project with the YouTube Data API v3 enabled and OAuth credentials in your backend `.env`.

---

### 5. Schedule Publishing

Navigate to **📅 Schedule** in the sidebar.

**Example weekly schedule:**
- Monday 9:00 AM — Tech short
- Wednesday 6:00 PM — Finance short
- Friday 12:00 PM — Motivation short

1. Click a time slot on the weekly grid
2. Pick a short from your Library
3. Select which connected channel to publish to
4. Set privacy: Public / Unlisted / Private
5. Save — the backend cron job will auto-publish at the scheduled time

---

### 6. Track Analytics

Navigate to **📊 Analytics** in the sidebar.

The dashboard shows (last 30 days by default):
- Total views, likes, comments, shares
- Subscriber growth
- Watch time in minutes
- Per-short performance breakdown

> Analytics populate after publishing. For connected YouTube channels, data syncs automatically.

---

### 7. Manage Settings & Themes

Navigate to **⚙️ Settings** in the sidebar.

- **Profile** — update your name and avatar
- **Defaults** — set your default niche, tone, and language so you don't have to pick them every time
- **Notifications** — toggle alerts for published shorts, trending content, weekly reports, and YPP eligibility
- **Watermark** — add a text watermark to your videos
- **Theme** — choose from 7 color themes via the toggle in the top bar: Dark, Light, Purple, Blue, Green, Rose, Amber

---

## Plans & Limits

| Plan | Shorts/Month | Price | Features |
|---|---|---|---|
| **Free** | 10 | $0 | All core features |
| **Creator** | 50 | $19/mo | Priority generation, analytics export |
| **Agency** | Unlimited | $49/mo | Multiple channels, team seats |

Upgrade via **💳 Pricing** in the sidebar. Billing is handled by Stripe.

---

## Project Structure

```
shortflow/
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── pages/              # Dashboard, Create, Library, Schedule,
│   │   │                       # Channels, Analytics, Pricing, Settings
│   │   ├── components/         # Sidebar, Topbar, Modal
│   │   ├── hooks/              # useAuth, useTheme, useToast
│   │   ├── lib/                # supabase.js, api.js
│   │   └── styles/             # globals.css (7 themes)
│   └── package.json
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── routes/             # generate, youtube, billing,
│   │   │                       # analytics, schedule, voice
│   │   ├── middleware/         # auth.js
│   │   └── server.js
│   ├── schema.sql              # Full Supabase schema + triggers
│   └── package.json
└── docs/
    └── LAUNCH_GUIDE.md         # Step-by-step deployment guide
```

---

## Environment Variables

### Frontend (`frontend/.env`)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3001
```

### Backend (`backend/.env`)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

PORT=3001
```

---

## Deploy to Production

| Service | What | Cost |
|---|---|---|
| [Vercel](https://vercel.com) | Frontend | Free |
| [Railway](https://railway.app) | Backend | ~$5/mo |
| [Supabase](https://supabase.com) | Database + Auth | Free tier |

1. **Frontend → Vercel**: connect your GitHub repo, set root to `frontend/`, add env vars
2. **Backend → Railway**: connect repo, set root to `backend/`, add env vars
3. **Supabase**: update **Authentication → URL Configuration** with your production domain
4. Update `VITE_API_URL` in Vercel to point to your Railway backend URL

See `docs/LAUNCH_GUIDE.md` for the full step-by-step deployment guide.
