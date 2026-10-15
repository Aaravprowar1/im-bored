// Single source of truth for activity enums. The SQL check constraints in
// supabase/migrations mirror these lists exactly (see tests/db/schema.test.ts).

export const CATEGORIES = [
  "creative",
  "brain",
  "physical",
  "outdoors",
  "indoors",
  "gaming",
  "learn",
  "mischief",
  "social",
  "music",
  "productivity",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const DIFFICULTIES = ["easy", "medium", "hard", "insane"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const LOCATIONS = ["indoors", "outdoors", "computer", "anywhere"] as const;
export type Location = (typeof LOCATIONS)[number];

export const ENERGY_LEVELS = ["low", "medium", "high"] as const;
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];

export const COST_TYPES = ["free", "paid"] as const;
export type CostType = (typeof COST_TYPES)[number];

export const PEOPLE_TYPES = ["alone", "with_friends", "either"] as const;
export type PeopleType = (typeof PEOPLE_TYPES)[number];

export const ACTIVITY_STATUSES = ["draft", "published", "archived"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export interface Activity {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: Category;
  duration_minutes: number;
  difficulty: Difficulty;
  location: Location;
  energy_level: EnergyLevel;
  cost_type: CostType;
  people_type: PeopleType;
  xp_reward: number;
  is_chaos: boolean;
  is_featured: boolean;
  status: ActivityStatus;
  safety_note: string | null;
  upvotes: number;
  downvotes: number;
  created_at: string;
  updated_at: string;
}

/** The subset of fields that is safe and useful to send to browsers. */
export type PublicActivity = Pick<
  Activity,
  | "id"
  | "title"
  | "description"
  | "category"
  | "duration_minutes"
  | "difficulty"
  | "location"
  | "energy_level"
  | "cost_type"
  | "people_type"
  | "xp_reward"
  | "is_chaos"
  | "is_featured"
  | "safety_note"
  | "upvotes"
  | "downvotes"
>;

export const PUBLIC_ACTIVITY_COLUMNS =
  "id,title,description,category,duration_minutes,difficulty,location,energy_level,cost_type,people_type,xp_reward,is_chaos,is_featured,safety_note,upvotes,downvotes" as const;

export const CATEGORY_LABELS: Record<Category, string> = {
  creative: "Creative",
  brain: "Brain",
  physical: "Physical",
  outdoors: "Outdoors",
  indoors: "Indoors",
  gaming: "Gaming",
  learn: "Learn",
  mischief: "Mischief",
  social: "Social",
  music: "Music",
  productivity: "Productivity",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  insane: "Insane",
};

export const LOCATION_LABELS: Record<Location, string> = {
  indoors: "Indoors",
  outdoors: "Outdoors",
  computer: "Computer",
  anywhere: "Anywhere",
};

export const ENERGY_LABELS: Record<EnergyLevel, string> = {
  low: "Low energy",
  medium: "Medium energy",
  high: "High energy",
};

export const COST_LABELS: Record<CostType, string> = {
  free: "Free",
  paid: "Costs money",
};

export const PEOPLE_LABELS: Record<PeopleType, string> = {
  alone: "Alone",
  with_friends: "With friends",
  either: "Solo or group",
};

/** Default XP by difficulty, used for seeds and approved submissions. */
export const XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 10,
  medium: 20,
  hard: 35,
  insane: 50,
};
