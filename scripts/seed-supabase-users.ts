/**
 * Seeds Supabase with 2–3 sample users who have completed onboarding
 * and have past coursework (homework) data.
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 * Run: npx tsx scripts/seed-supabase-users.ts
 */

import { createClient } from "@supabase/supabase-js";
import { seedUsers } from "../src/data/seed-users";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local or the environment."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SAMPLE_PASSWORD = "SampleUser123!";

async function main() {
  console.log("Seeding sample users and past coursework...\n");

  for (const user of seedUsers) {
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: SAMPLE_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    });

    if (authError) {
      if (authError.message.includes("already been registered")) {
        console.log(`User ${user.email} already exists, skipping auth create.`);
        const { data: existing } = await supabase.auth.admin.listUsers();
        const existingUser = existing?.users?.find((u) => u.email === user.email);
        if (!existingUser) {
          console.error(`Could not find existing user ${user.email}. Skip or delete and re-run.`);
          continue;
        }
        await upsertProfileAndCourses(existingUser.id, user);
        continue;
      }
      console.error(`Failed to create user ${user.email}:`, authError.message);
      continue;
    }

    if (!authUser.user) {
      console.error(`No user returned for ${user.email}`);
      continue;
    }

    await upsertProfileAndCourses(authUser.user.id, user);
    console.log(`Created: ${user.fullName} (${user.email}) — password: ${SAMPLE_PASSWORD}`);
  }

  console.log("\nDone. You can log in with the emails above and password:", SAMPLE_PASSWORD);
}

async function upsertProfileAndCourses(
  userId: string,
  user: (typeof seedUsers)[0]
) {
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: user.email,
      full_name: user.fullName,
      onboarding_completed_at: user.onboardingCompletedAt,
      skills: user.onboarding.skills,
      hobbies: user.onboarding.hobbies,
      hours_per_week: user.onboarding.hoursPerWeek,
      resume_uploaded: user.onboarding.resumeUploaded,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error(`Profile upsert failed for ${user.email}:`, profileError.message);
    return;
  }

  const { error: deleteCoursesError } = await supabase
    .from("past_courses")
    .delete()
    .eq("user_id", userId);

  if (deleteCoursesError) {
    console.error(`Failed to clear existing past_courses for ${user.email}:`, deleteCoursesError.message);
  }

  const rows = user.pastCourses.map((c, i) => ({
    user_id: userId,
    title: c.title,
    category: c.category,
    progress: c.progress,
    hours: c.hours,
    rating: c.rating,
    color: c.color,
    sort_order: i,
  }));

  const { error: coursesError } = await supabase.from("past_courses").insert(rows);

  if (coursesError) {
    console.error(`Past courses insert failed for ${user.email}:`, coursesError.message);
  } else {
    console.log(`  — Profile + ${user.pastCourses.length} past courses.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
