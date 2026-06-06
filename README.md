# ShortFlow — YouTube Shorts Automation SaaS

AI-powered platform to create, schedule, and auto-publish viral YouTube Shorts.

## Quick Start (Development)

### 1. Frontend
cd frontend
cp .env.example .env        # fill in your Supabase keys
npm install
npm run dev                  # runs on http://localhost:5173

### 2. Backend
cd backend
cp .env.example .env        # fill in all API keys
npm install
npm run dev                  # runs on http://localhost:3001

### 3. Database
- Create a Supabase project at https://supabase.com
- Run backend/schema.sql in the SQL editor

## Project Structure

shortflow/
├── frontend/               # React + Vite SPA
│   ├── src/
│   │   ├── pages/          # Dashboard, Create, Library, Schedule, Channels, Analytics, Pricing, Settings
│   │   ├── components/     # Sidebar, Topbar, Modal
│   │   ├── hooks/          # useAuth, useTheme, useToast
│   │   ├── lib/            # supabase.js, api.js
│   │   └── styles/         # globals.css (7 themes)
│   └── package.json
├── backend/                # Node.js + Express API
│   ├── src/
│   │   ├── routes/         # generate, youtube, billing, analytics, schedule, voice
│   │   ├── middleware/     # auth.js
│   │   └── server.js
│   ├── schema.sql          # Full Supabase schema
│   └── package.json
└── docs/
    └── LAUNCH_GUIDE.md     # Step-by-step launch instructions

## Features

- AI script + hook + SEO generation (Claude)
- 7 color themes, 6 video styles
- YouTube OAuth + auto-publishing
- Stripe subscription billing (Free/Creator/Agency)
- Analytics dashboard
- Weekly schedule builder
- ElevenLabs voiceover
- Row-level security (users see only their data)
- Free tier: 10 shorts/month

## Deploy

See docs/LAUNCH_GUIDE.md for full deployment steps.
- Frontend → Vercel (free)
- Backend  → Railway ($5/mo)
- Database → Supabase (free tier)
