import { z } from "zod";
import {
  CATEGORIES,
  COST_TYPES,
  DIFFICULTIES,
  ENERGY_LEVELS,
  LOCATIONS,
  PEOPLE_TYPES,
} from "@/lib/activities/types";
import { screenSubmission } from "@/lib/submissions/safety";

const collapse = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/[ \t]+/g, " ").trim();

export const uuidSchema = z.string().uuid();

export const submissionFieldsSchema = z
  .object({
    title: z
      .string()
      .transform(collapse)
      .pipe(z.string().min(5, "Title must be at least 5 characters.").max(100, "Title must be 100 characters or fewer.")),
    description: z
      .string()
      .transform((s) => collapse(s).replace(/\n{3,}/g, "\n\n"))
      .pipe(
        z
          .string()
          .min(20, "Describe the activity in at least 20 characters.")
          .max(800, "Keep the description to 800 characters or fewer."),
      ),
    category: z.enum(CATEGORIES, { message: "Choose a category." }),
    duration_minutes: z.coerce
      .number({ message: "Enter a duration in minutes." })
      .int("Use whole minutes.")
      .min(1, "Duration must be at least 1 minute.")
      .max(240, "Activities must take 240 minutes or less."),
    difficulty: z.enum(DIFFICULTIES, { message: "Choose a difficulty." }),
    location: z.enum(LOCATIONS, { message: "Choose a location." }),
    energy_level: z.enum(ENERGY_LEVELS, { message: "Choose an energy level." }),
    cost_type: z.enum(COST_TYPES, { message: "Choose whether it costs money." }),
    people_type: z.enum(PEOPLE_TYPES, { message: "Choose a group size." }),
  })
  .superRefine((value, ctx) => {
    const screen = screenSubmission(`${value.title}\n${value.description}`);
    if (!screen.ok) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: `This activity can't be accepted (${screen.reason}). Activities must be safe, legal and kind.`,
      });
    }
  });

/** Create request. Any amount, currency, status or user id sent by the client is ignored (stripped). */
export const createSubmissionSchema = submissionFieldsSchema.and(z.object({ client_request_id: uuidSchema }));

export type SubmissionFields = z.infer<typeof submissionFieldsSchema>;

export const profileUpdateSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, "Use 3 to 24 lowercase letters, numbers or underscores.")
    .optional(),
  display_name: z
    .string()
    .transform(collapse)
    .pipe(z.string().max(40, "Display name must be 40 characters or fewer."))
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional(),
  avatar_url: z
    .string()
    .trim()
    .max(500)
    .refine((s) => s === "" || /^https:\/\/[^\s]+$/.test(s), "Avatar must be an https:// image URL.")
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional(),
  show_on_leaderboard: z.boolean().optional(),
});

export const moderationSchema = z.object({
  action: z.enum(["approve", "reject", "request_changes", "refund"]),
  notes: z.string().max(2000).optional().nullable(),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use 72 characters or fewer.")
  .regex(/[a-zA-Z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");
