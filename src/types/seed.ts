/**
 * Types for sample/seed users and their onboarding + past coursework (homework) data.
 */

export interface PastCourse {
  id: number;
  title: string;
  category: string;
  progress: number;
  hours: number;
  rating: number;
  color: string;
}

export interface OnboardingData {
  skills: Record<string, number>;
  hobbies: string[];
  hoursPerWeek: number;
  resumeUploaded: boolean;
}

export interface SeedUser {
  id: string;
  email: string;
  fullName: string;
  onboardingCompletedAt: string; // ISO date
  onboarding: OnboardingData;
  pastCourses: PastCourse[];
  hoursLearned: number;
  currentStreak: number;
  topicsDone: number;
  overallProgressPercentage: number;
}
