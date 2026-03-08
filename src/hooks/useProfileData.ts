"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileDataRow, PastCourseworkItem } from "@/types/database";

export interface ProfileDataState {
  /** From profiles or profile_data */
  fullName: string;
  coursesActive: string[];
  hoursLearned: number;
  currentStreak: number;
  skillsGained: Record<string, number>;
  pastCoursework: PastCourseworkItem[];
  overallProgressPercentage: number;
  topicsDone: number;
  /** Past courses from the dedicated past_courses table */
  pastCourses: PastCourseworkItem[];
  /** Roadmap snapshot course names */
  roadmapCourseNames: string[];
}

const DEFAULT_STATE: ProfileDataState = {
  fullName: "",
  coursesActive: [],
  hoursLearned: 0,
  currentStreak: 0,
  skillsGained: {},
  pastCoursework: [],
  overallProgressPercentage: 0,
  topicsDone: 0,
  pastCourses: [],
  roadmapCourseNames: [],
};

export function useProfileData() {
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<ProfileDataState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (uid: string) => {
    const supabase = createClient();
    if (!supabase) {
      setState(DEFAULT_STATE);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [profileRes, profileDataRes, pastCoursesRes, snapshotRes] = await Promise.all([
        supabase.from("profiles").select("full_name, total_hours, current_streak, topics_done, overall_progress").eq("id", uid).single(),
        supabase.from("profile_data").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("past_courses").select("*").eq("user_id", uid).order("sort_order", { ascending: true }),
        supabase.from("roadmap_snapshots").select("course_names").eq("user_id", uid).order("snapshot_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const profile = profileRes.data;
      const pd = profileDataRes.data as ProfileDataRow | null;

      const fullName = profile?.full_name ?? "";
      const pastCoursework = (Array.isArray(pd?.past_coursework) ? pd.past_coursework : []) as PastCourseworkItem[];
      const skillsGained = (pd?.skills_gained as Record<string, number>) ?? {};
      const coursesActive = (pd?.courses_active as string[]) ?? [];
      const hoursLearned = pd?.hours_learned ?? profile?.total_hours ?? 0;
      const currentStreak = pd?.current_streak ?? profile?.current_streak ?? 0;
      const overallProgressPercentage = pd?.overall_progress_percentage ?? profile?.overall_progress ?? 0;
      const topicsDone = pd?.topics_done ?? profile?.topics_done ?? 0;

      // Past courses from dedicated table
      const pastCourses: PastCourseworkItem[] = (pastCoursesRes.data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as number | undefined,
        title: (row.title as string) ?? "",
        category: (row.category as string) ?? "Quant",
        progress: Number(row.progress) || 0,
        hours: Number(row.hours) || 0,
        rating: Number(row.rating) || 0,
        color: (row.color as string) ?? "#46b533",
        sort_order: Number(row.sort_order) || 0,
      }));

      // Roadmap snapshot course names
      const roadmapCourseNames: string[] = Array.isArray(snapshotRes.data?.course_names)
        ? (snapshotRes.data.course_names as string[])
        : [];

      setState({
        fullName,
        coursesActive,
        hoursLearned: Number(hoursLearned) || 0,
        currentStreak: Number(currentStreak) || 0,
        skillsGained: typeof skillsGained === "object" ? skillsGained : {},
        pastCoursework: Array.isArray(pastCoursework) ? pastCoursework : [],
        overallProgressPercentage: Math.min(100, Math.max(0, Number(overallProgressPercentage) || 0)),
        topicsDone: Number(topicsDone) || 0,
        pastCourses,
        roadmapCourseNames,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
      setState(DEFAULT_STATE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const getInitial = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        setUserId(user.id);
        await fetchData(user.id);
      } else {
        setUserId(null);
        setState(DEFAULT_STATE);
        setLoading(false);
      }
    };
    getInitial();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) fetchData(uid);
      else setState(DEFAULT_STATE);
    });
    return () => subscription.unsubscribe();
  }, [fetchData]);

  return { userId, ...state, loading, error, refetch: userId ? () => fetchData(userId) : undefined };
}
