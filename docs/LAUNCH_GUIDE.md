# ShortFlow — Complete Launch Guide

## Overview
ShortFlow is a YouTube Shorts automation SaaS:
- Frontend: React + Vite + Tailwind CSS v4 + Lucide + Framer Motion  →  Vercel (free)
- Backend:  Node.js + Express  →  Railway ($5/mo)
- Database: Supabase (Postgres + Auth + Storage)  →  free tier
- AI:       Anthropic Claude Sonnet 4.6  →  ~$5/mo
- Voiceover: ElevenLabs Turbo v2  →  free / $5 credits
- Video:    @napi-rs/canvas + FFmpeg  →  1080p HD, no watermark
- YouTube:  Google OAuth + YouTube Data API v3
- Payments: Stripe

---

## STEP 1 — Supabase Setup (Free)

1. Go to https://supabase.com  →  Create new project
2. Copy your Project URL and anon key (Settings → API)
3. Copy the service_role key (backend only — never expose in frontend)
4. SQL Editor → paste contents of backend/schema.sql → Run
5. Authentication → Settings → Enable Email sign-ups

---

## STEP 2 — Anthropic API Key

1. https://console.anthropic.com  →  Create API key
2. Add to backend .env:  ANTHROPIC_API_KEY=sk-ant-...
3. Model used: claude-sonnet-4-6

---

## STEP 3 — YouTube Data API

1. https://console.cloud.google.com  →  New project
2. Enable APIs: YouTube Data API v3, YouTube Analytics API
3. Credentials → OAuth 2.0 → Web application
   Redirect URI: https://your-backend.railway.app/api/youtube/callback
4. Copy Client ID + Secret to backend .env

---

## STEP 4 — Stripe Payments

1. https://dashboard.stripe.com  →  Create account
2. Create two Subscription Products:
   - Creator Plan: $19/month
   - Agency Plan:  $79/month
3. Copy Price IDs to backend .env
4. Webhooks → Add endpoint:
   URL: https://your-backend.railway.app/api/billing/webhook
   Events: checkout.session.completed, customer.subscription.deleted
5. Copy Webhook Signing Secret

---

## STEP 5 — ElevenLabs Voiceover (Optional)

1. https://elevenlabs.io  →  Create account
2. Profile → API Key → add to ELEVENLABS_API_KEY

---

## STEP 6 — Deploy Backend (Railway)

1. https://railway.app  →  New Project → Deploy from GitHub
2. Root directory: /backend
3. Add ALL environment variables from backend/.env.example
4. Note your Railway URL (e.g. https://shortflow-api.railway.app)

Backend .env variables needed:
  PORT=3001
  FRONTEND_URL=https://your-app.vercel.app
  SUPABASE_URL=https://xxxx.supabase.co
  SUPABASE_SERVICE_KEY=service_role_key
  ANTHROPIC_API_KEY=sk-ant-...
  YOUTUBE_CLIENT_ID=...
  YOUTUBE_CLIENT_SECRET=...
  YOUTUBE_REDIRECT_URI=https://your-api.railway.app/api/youtube/callback
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_CREATOR_PRICE_ID=price_...
  STRIPE_AGENCY_PRICE_ID=price_...
  ELEVENLABS_API_KEY=...

---

## STEP 7 — Deploy Frontend (Vercel)

1. https://vercel.com  →  Import GitHub repo
2. Root directory: /frontend
3. Frontend .env variables:
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_URL=https://your-api.railway.app/api
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
4. Deploy → copy your Vercel URL
5. Update FRONTEND_URL in Railway to your Vercel URL

---

## STEP 8 — Custom Domain (~$10/year)

1. Buy domain: Namecheap, GoDaddy, or Cloudflare Registrar
2. Vercel: Settings → Domains → Add your domain
3. Follow DNS instructions (SSL is automatic)
4. Update FRONTEND_URL + YouTube redirect URI to use new domain

---

## STEP 9 — Monthly Usage Reset

Free users get 10 shorts/month. Reset on the 1st:

Option A — Supabase pg_cron (enable in Dashboard → Database → Extensions):
  SELECT cron.schedule('reset-monthly', '0 0 1 * *', 'SELECT reset_monthly_shorts()');

Option B — cron-job.org (free):
  POST https://your-api.railway.app/api/admin/reset
  Schedule: 0 0 1 * *
  Add X-Admin-Secret header for security

---

## STEP 10 — Launch Checklist

  [ ] Supabase schema.sql executed
  [ ] Anthropic API key working (test generate endpoint)
  [ ] YouTube OAuth credentials created
  [ ] Stripe products + webhook configured
  [ ] Backend live on Railway + health check passes
  [ ] Frontend live on Vercel + auth flow works
  [ ] Custom domain pointing correctly
  [ ] End-to-end test: signup → generate → pricing → checkout
  [ ] Monthly reset cron scheduled
  [ ] Add Crisp chat for support (https://crisp.chat — free)

---

## Revenue Projections

  100 users:  80 free, 15 Creator, 5 Agency  =  $680/mo MRR
  500 users:  ~80% free, rest paying          =  ~$3,100/mo MRR
  1000 users                                  =  ~$6,200/mo MRR
  5000 users                                  =  ~$46,500/mo MRR

## Growth Channels

1. Use ShortFlow itself — create content about ShortFlow
2. Reddit: r/SideProject, r/Entrepreneur, r/YoutubeCreators
3. ProductHunt launch (Tuesday for max traffic)
4. YouTube demo: "I published 30 Shorts in 1 hour"
5. Affiliate program: 30% recurring commission
6. Free tier is genuinely useful — drives word of mouth

---

## Tech Stack Reference

  react 18 + react-router-dom 6  →  SPA routing
  @supabase/supabase-js           →  auth + database client
  vite 5                          →  build tool + dev server
  express 4 + helmet + cors       →  REST API
  @anthropic-ai/sdk               →  Claude AI
  googleapis                      →  YouTube API
  stripe                          →  payments
  express-rate-limit              →  API protection
