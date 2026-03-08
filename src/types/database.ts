/**
 * Supabase table types: profile_data, roadmap_snapshots.
 * Use these when reading/writing from the frontend or API routes.
 */

export interface PastCourseworkItem {
  id?: number;
  title: string;
  category: string;
  progress: number;
  hours: number;
  rating: number;
  color: string;
  sort_order?: number;
}

export interface ProfileDataRow {
  id: string;
  user_id: string;
  courses_active: string[];
  hours_learned: number;
  current_streak: number;
  skills_gained: Record<string, number>;
  past_coursework: PastCourseworkItem[];
  overall_progress_percentage: number;
  topics_done: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileDataInsert {
  user_id: string;
  courses_active?: string[];
  hours_learned?: number;
  current_streak?: number;
  skills_gained?: Record<string, number>;
  past_coursework?: PastCourseworkItem[];
  overall_progress_percentage?: number;
  topics_done?: number;
}

export interface RoadmapSnapshotRow {
  id: string;
  user_id: string;
  roadmap_id: string | null;
  snapshot_at: string;
  course_names: string[];
}
