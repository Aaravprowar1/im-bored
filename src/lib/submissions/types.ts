import type { Category, CostType, Difficulty, EnergyLevel, Location, PeopleType } from "@/lib/activities/types";
import type { ModerationStatus, PaymentStatus } from "./state";

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
  payment_status: PaymentStatus;
  moderation_status: ModerationStatus;
  amount_cents: number;
  currency: string;
  stripe_checkout_session_id: string | null;
  checkout_expires_at: string | null;
  checkout_attempts: number;
  paid_at: string | null;
  review_notes: string | null;
  published_activity_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Columns returned to the submitter (no Stripe identifiers). */
export const OWNER_SUBMISSION_COLUMNS =
  "id,title,description,category,duration_minutes,difficulty,location,energy_level,cost_type,people_type,payment_status,moderation_status,amount_cents,currency,paid_at,review_notes,published_activity_id,published_at,created_at,updated_at";

export type OwnerSubmission = Omit<
  Submission,
  "submitter_id" | "stripe_checkout_session_id" | "checkout_expires_at" | "checkout_attempts"
>;
