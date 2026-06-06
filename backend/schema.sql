-- ╔══════════════════════════════════════════════════════════════╗
-- ║         SHORTFLOW — SUPABASE SQL SCHEMA                     ║
-- ║  Run this in Supabase Dashboard → SQL Editor → Run          ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── PROFILES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name              TEXT,
  email                  TEXT,
  avatar_url             TEXT,
  plan                   TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','creator','agency')),
  shorts_used            INTEGER NOT NULL DEFAULT 0,
  shorts_limit           INTEGER NOT NULL DEFAULT 10,
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  default_niche          TEXT DEFAULT 'Tech & Programming',
  default_tone           TEXT DEFAULT 'Energetic & Engaging',
  default_language       TEXT DEFAULT 'English',
  watermark_text         TEXT,
  notifications          JSONB DEFAULT '{"published":true,"trending":true,"weekly_report":true,"ypp_alert":true}'::jsonb,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── CHANNELS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  youtube_channel_id  TEXT NOT NULL,
  name                TEXT NOT NULL,
  handle              TEXT,
  thumbnail           TEXT,
  subscribers         INTEGER DEFAULT 0,
  total_views         BIGINT DEFAULT 0,
  video_count         INTEGER DEFAULT 0,
  access_token        TEXT,
  refresh_token       TEXT,
  token_expiry        TIMESTAMPTZ,
  ypp_eligible        BOOLEAN DEFAULT FALSE,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, youtube_channel_id)
);

-- ── SHORTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shorts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id          UUID REFERENCES channels(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  topic               TEXT,
  script              TEXT,
  hook                TEXT,
  description         TEXT,
  tags                TEXT[],
  niche               TEXT,
  style               TEXT,
  tone                TEXT,
  language            TEXT DEFAULT 'English',
  duration_estimate   TEXT,
  seo_score           INTEGER,
  viral_score         INTEGER,
  thumbnail_url       TEXT,
  thumbnail_prompt    TEXT,
  video_url           TEXT,
  voiceover_url       TEXT,
  youtube_video_id    TEXT,
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','generating','ready','scheduled','publishing','published','failed')),
  views               BIGINT DEFAULT 0,
  likes               INTEGER DEFAULT 0,
  comments            INTEGER DEFAULT 0,
  shares              INTEGER DEFAULT 0,
  published_at        TIMESTAMPTZ,
  scheduled_at        TIMESTAMPTZ,
  cta                 TEXT,
  key_points          TEXT[],
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── SCHEDULED POSTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  short_id        UUID NOT NULL REFERENCES shorts(id) ON DELETE CASCADE,
  channel_id      UUID REFERENCES channels(id) ON DELETE CASCADE,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  privacy         TEXT DEFAULT 'public' CHECK (privacy IN ('public','unlisted','private')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','failed','cancelled')),
  error_message   TEXT,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ANALYTICS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  short_id             UUID REFERENCES shorts(id) ON DELETE CASCADE,
  channel_id           UUID REFERENCES channels(id) ON DELETE CASCADE,
  date                 DATE NOT NULL,
  views                INTEGER DEFAULT 0,
  likes                INTEGER DEFAULT 0,
  comments             INTEGER DEFAULT 0,
  shares               INTEGER DEFAULT 0,
  subscribers_gained   INTEGER DEFAULT 0,
  watch_time_minutes   INTEGER DEFAULT 0,
  avg_view_duration    NUMERIC(5,2),
  click_through_rate   NUMERIC(5,2),
  impressions          INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(short_id, date)
);

-- ── SCHEDULE TEMPLATES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_templates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id   UUID REFERENCES channels(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour         INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
  minute       INTEGER NOT NULL DEFAULT 0,
  timezone     TEXT DEFAULT 'UTC',
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, channel_id, day_of_week, hour)
);

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shorts_user     ON shorts(user_id);
CREATE INDEX IF NOT EXISTS idx_shorts_status   ON shorts(status);
CREATE INDEX IF NOT EXISTS idx_analytics_user  ON analytics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_channels_user   ON channels(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_user  ON scheduled_posts(user_id, status);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE shorts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile"    ON profiles          FOR ALL USING (auth.uid()=id);
CREATE POLICY "own_channels"   ON channels          FOR ALL USING (auth.uid()=user_id);
CREATE POLICY "own_shorts"     ON shorts            FOR ALL USING (auth.uid()=user_id);
CREATE POLICY "own_schedule"   ON scheduled_posts   FOR ALL USING (auth.uid()=user_id);
CREATE POLICY "own_analytics"  ON analytics         FOR ALL USING (auth.uid()=user_id);
CREATE POLICY "own_templates"  ON schedule_templates FOR ALL USING (auth.uid()=user_id);

-- ── TRIGGERS ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER shorts_updated_at   BEFORE UPDATE ON shorts   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles(id,email,full_name)
  VALUES(NEW.id,NEW.email,NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Monthly reset function (call via pg_cron or external cron)
CREATE OR REPLACE FUNCTION reset_monthly_shorts()
RETURNS void AS $$ BEGIN UPDATE profiles SET shorts_used=0; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
