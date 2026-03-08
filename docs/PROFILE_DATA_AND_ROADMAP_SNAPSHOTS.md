# Profile Data & Roadmap Snapshots (Supabase)

## `profile_data` table

One row per user (1:1 with `profiles.id`). Holds all the extensive dashboard/learning data that was previously hardcoded.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to `profiles.id`, UNIQUE |
| `courses_active` | jsonb | Array of course/topic names or ids currently active |
| `hours_learned` | integer | Total hours learned (can sync from past_courses or separate tracking) |
| `current_streak` | integer | Consecutive days streak |
| `skills_gained` | jsonb | Skill breakdown e.g. `{"Programming": 85, "Web Development": 72}` |
| `past_coursework` | jsonb | Array of `{ title, category, progress, hours, rating, color, sort_order }` — progress bars and star ratings |
| `overall_progress_percentage` | integer | 0–100, derived from actual courses completed |
| `topics_done` | integer | Number of topics completed in the learning path |
| `created_at`, `updated_at` | timestamptz | |

**RLS:** Users can SELECT/INSERT/UPDATE only their own row (`auth.uid() = user_id`).

Use this table (and optionally `past_courses`) to drive dashboard stats, progress page, and past coursework UI instead of hardcoded values.

---

## `roadmap_snapshots` table

One row per roadmap creation. Stores every course/topic name in that roadmap, linked to the user.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to `profiles.id` |
| `roadmap_id` | text | Optional RIQE roadmap id |
| `snapshot_at` | timestamptz | When the snapshot was taken |
| `course_names` | jsonb | Array of strings — every course/topic name in the roadmap (order preserved) |

**RLS:** Users can SELECT/INSERT only their own rows.

**When snapshots are written:**

- **RIQE API (Python):** When Supabase is configured, every time a roadmap is created or updated (`onboard`, `process_text_input`, `switch_roadmap`), the backend calls `db.save_roadmap_snapshot(user_id, roadmap_id, [node.title for node in roadmap.nodes])`, which inserts into `roadmap_snapshots`.
- **Frontend:** You can also insert a row when the app creates or receives a new roadmap (e.g. after calling the RIQE API) with the list of course/topic names.

---

## Frontend usage

- **Types:** `src/types/database.ts` defines `ProfileDataRow`, `ProfileDataInsert`, `PastCourseworkItem`, `RoadmapSnapshotRow`.
- **Seeding:** `scripts/seed-supabase-users.ts` upserts `profile_data` for each seed user (hours_learned, overall_progress_percentage, past_coursework, skills_gained from onboarding).

To drive the dashboard from `profile_data`:

1. After login, fetch `profile_data` for the current user (or create a row with defaults if missing).
2. Use `courses_active`, `hours_learned`, `current_streak`, `skills_gained`, `past_coursework`, `overall_progress_percentage`, `topics_done` for the dashboard and progress pages.
3. When the user completes coursework or the RIQE API returns an updated roadmap, update `profile_data` (and optionally insert into `roadmap_snapshots` if the frontend is the source of the new roadmap).
