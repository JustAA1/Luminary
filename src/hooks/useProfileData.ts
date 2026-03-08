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
      const [profileRes, profileDataRes] = await Promise.all([
        supabase.from("profiles").select("full_name, total_hours, current_streak, topics_done, overall_progress").eq("id", uid).single(),
        supabase.from("profile_data").select("*").eq("user_id", uid).maybeSingle(),
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

      setState({
        fullName,
        coursesActive,
        hoursLearned: Number(hoursLearned) || 0,
        currentStreak: Number(currentStreak) || 0,
        skillsGained: typeof skillsGained === "object" ? skillsGained : {},
        pastCoursework: Array.isArray(pastCoursework) ? pastCoursework : [],
        overallProgressPercentage: Math.min(100, Math.max(0, Number(overallProgressPercentage) || 0)),
        topicsDone: Number(topicsDone) || 0,
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
