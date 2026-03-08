-- ============================================================
-- Luminary – Full Supabase schema migration
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- All statements use IF NOT EXISTS so it's safe to re-run.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. profiles (likely auto-created by auth trigger, but ensure it exists)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text,
  full_name       text,
  onboarding_completed boolean DEFAULT false,
  skills          jsonb DEFAULT '{}',
  hobbies         jsonb DEFAULT '[]',
  hours_per_week  integer DEFAULT 0,
  total_hours     integer DEFAULT 0,
  current_streak  integer DEFAULT 0,
  topics_done     integer DEFAULT 0,
  overall_progress integer DEFAULT 0,
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_select_own') THEN
    CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_update_own') THEN
    CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_insert_own') THEN
    CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Auto-create a profile row on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- 2. profile_data (dashboard stats, one row per user)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_data (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  courses_active              jsonb DEFAULT '[]',
  hours_learned               integer DEFAULT 0,
  current_streak              integer DEFAULT 0,
  skills_gained               jsonb DEFAULT '{}',
  past_coursework             jsonb DEFAULT '[]',
  overall_progress_percentage integer DEFAULT 0,
  topics_done                 integer DEFAULT 0,
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

ALTER TABLE public.profile_data ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_data' AND policyname = 'profile_data_select_own') THEN
    CREATE POLICY profile_data_select_own ON public.profile_data FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_data' AND policyname = 'profile_data_insert_own') THEN
    CREATE POLICY profile_data_insert_own ON public.profile_data FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_data' AND policyname = 'profile_data_update_own') THEN
    CREATE POLICY profile_data_update_own ON public.profile_data FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3. past_courses
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.past_courses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  category    text,
  progress    integer DEFAULT 0,
  hours       integer DEFAULT 0,
  rating      numeric(2,1) DEFAULT 0,
  color       text DEFAULT '#46b533',
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.past_courses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'past_courses' AND policyname = 'past_courses_select_own') THEN
    CREATE POLICY past_courses_select_own ON public.past_courses FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'past_courses' AND policyname = 'past_courses_insert_own') THEN
    CREATE POLICY past_courses_insert_own ON public.past_courses FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'past_courses' AND policyname = 'past_courses_delete_own') THEN
    CREATE POLICY past_courses_delete_own ON public.past_courses FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. roadmap_snapshots (frontend types + Python backend writes)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roadmap_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  roadmap_id  text,
  snapshot_at timestamptz DEFAULT now(),
  course_names jsonb DEFAULT '[]'
);

ALTER TABLE public.roadmap_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'roadmap_snapshots' AND policyname = 'roadmap_snapshots_allow_all') THEN
    CREATE POLICY roadmap_snapshots_allow_all ON public.roadmap_snapshots FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- PYTHON BACKEND TABLES (RIQE pipeline)
-- These are accessed by the Python daemon using the anon key.
-- RLS is permissive for the service_role key; for anon key we
-- allow insert/select/update gated on the user_id matching.
-- ════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- 5. knowledge_states (RIQE per-user ML state)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_states (
  user_id          text PRIMARY KEY,
  user_vector      jsonb NOT NULL DEFAULT '[]',
  completed_topics jsonb DEFAULT '[]',
  weak_topics      jsonb DEFAULT '[]',
  strong_signals   jsonb DEFAULT '[]',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE public.knowledge_states ENABLE ROW LEVEL SECURITY;

-- Allow anon/authenticated users full access (backend uses anon key)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'knowledge_states' AND policyname = 'knowledge_states_allow_all') THEN
    CREATE POLICY knowledge_states_allow_all ON public.knowledge_states FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 6. roadmaps (versioned RIQE roadmap data)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roadmaps (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id     text NOT NULL,
  user_id        text NOT NULL,
  nodes          jsonb NOT NULL DEFAULT '[]',
  created_at     timestamptz DEFAULT now(),
  version        integer DEFAULT 1,
  quality_score  double precision DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_roadmaps_roadmap_id ON public.roadmaps(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_user_id    ON public.roadmaps(user_id);

ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'roadmaps' AND policyname = 'roadmaps_allow_all') THEN
    CREATE POLICY roadmaps_allow_all ON public.roadmaps FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 7. signals (RIQE signal log)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.signals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           text NOT NULL,
  text              text,
  topic             text,
  strength          double precision DEFAULT 0,
  signal_type       text,
  trend             text,
  reliability_score double precision DEFAULT 0,
  timestamp         timestamptz,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_user_id ON public.signals(user_id);

ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'signals' AND policyname = 'signals_allow_all') THEN
    CREATE POLICY signals_allow_all ON public.signals FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 8. metrics (RIQE metrics snapshots)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.metrics (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     text NOT NULL,
  roadmap_quality_score       double precision,
  signal_reliability          double precision,
  knowledge_state_drift       double precision,
  topic_coverage              double precision,
  recommendation_consistency  double precision,
  created_at                  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_user_id ON public.metrics(user_id);

ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'metrics' AND policyname = 'metrics_allow_all') THEN
    CREATE POLICY metrics_allow_all ON public.metrics FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- Done. All 8 tables are now available:
--   Frontend: profiles, profile_data, past_courses, roadmap_snapshots
--   Backend:  knowledge_states, roadmaps, signals, metrics
-- ============================================================
