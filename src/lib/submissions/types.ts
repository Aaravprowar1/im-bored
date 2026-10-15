import type { Category, CostType, Difficulty, EnergyLevel, Location, PeopleType } from "@/lib/activities/types";
import type { ModerationStatus } from "./state";

export interface Submission {
  id: string;
  submitter_id: string | null;
  title: string;
  description: string;
  category: Category;
  duration_minutes: number;
  difficulty: Difficulty;
  location: Location;
  energy_level: EnergyLevel;
  cost_type: CostType;
  people_type: PeopleType;
  moderation_status: ModerationStatus;
  review_notes: string | null;
  published_activity_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Columns returned to the submitter. */
export const OWNER_SUBMISSION_COLUMNS =
  "id,title,description,category,duration_minutes,difficulty,location,energy_level,cost_type,people_type,moderation_status,review_notes,published_activity_id,published_at,created_at,updated_at";

export type OwnerSubmission = Omit<Submission, "submitter_id">;
