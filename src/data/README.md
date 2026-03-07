# Sample users & seed data

This folder holds **2–3 sample users** who have completed onboarding and have **past homework** (coursework) data for development and demos.

## Seed users

| Name          | Email                     | Focus                          |
|---------------|---------------------------|---------------------------------|
| **Alex Rivera**   | alex.rivera@example.com   | Web dev, Python, data science   |
| **Jordan Chen**   | jordan.chen@example.com   | Math, data science, ML          |
| **Sam Williams**  | sam.williams@example.com  | Design, front-end               |

Each user has:

- **Onboarding**: skills (programming, math, etc.), interests/hobbies, hours per week, resume uploaded (or not).
- **Past courses**: list of courses with title, category, progress %, hours, rating, and color for UI.

## Using the data in the app

- **TypeScript**: Import from `@/data/seed-users` (e.g. `seedUsers`, `getSeedUserById`, `getSeedUserByEmail`).
- **Database**: Run the seed script so these users and their data exist in Supabase (see below).

## Seeding Supabase

1. Ensure Supabase is configured (`.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
2. Add **`SUPABASE_SERVICE_ROLE_KEY`** (from Supabase Dashboard → Settings → API) to `.env.local` (do not commit it).
3. Apply the migration that creates `profiles` and `past_courses` (already applied if you use the Supabase MCP or run migrations).
4. Run:

   ```bash
   npm run seed
   ```

   This creates the 3 auth users (if they don’t exist), their profiles, and their past coursework. Default password for all: **`SampleUser123!`**.

5. Log in with any of the sample emails and that password to see that user’s past homework on the home page.
