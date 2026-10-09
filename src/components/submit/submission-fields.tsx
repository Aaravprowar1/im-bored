"use client";

import { describedBy, Field, Input, Select, Textarea } from "@/components/ui/form";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COST_LABELS,
  COST_TYPES,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  ENERGY_LABELS,
  ENERGY_LEVELS,
  LOCATION_LABELS,
  LOCATIONS,
  PEOPLE_LABELS,
  PEOPLE_TYPES,
} from "@/lib/activities/types";

export type SubmissionDraft = {
  title: string;
  description: string;
  category: string;
  duration_minutes: string;
  difficulty: string;
  location: string;
  energy_level: string;
  cost_type: string;
  people_type: string;
};

export const EMPTY_DRAFT: SubmissionDraft = {
  title: "",
  description: "",
  category: "",
  duration_minutes: "",
  difficulty: "",
  location: "",
  energy_level: "",
  cost_type: "free",
  people_type: "",
};

function Choice({
  id,
  label,
  value,
  error,
  onChange,
  options,
}: {
  id: keyof SubmissionDraft;
  label: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <Field id={id} label={label} error={error}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy(id, error)}>
        <option value="" disabled>
          Choose…
        </option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function SubmissionFields({
  draft,
  errors,
  onChange,
}: {
  draft: SubmissionDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<SubmissionDraft>) => void;
}) {
  const opts = <T extends string>(values: readonly T[], labels: Record<T, string>): [string, string][] => values.map((v) => [v, labels[v]]);
  return (
    <div className="grid gap-5">
      <Field id="title" label="Activity title" hint={`${draft.title.trim().length}/100 characters`} error={errors.title}>
        <Input id="title" value={draft.title} maxLength={100} onChange={(e) => onChange({ title: e.target.value })} aria-invalid={Boolean(errors.title)} aria-describedby={describedBy("title", errors.title, "x")} placeholder="e.g. Make a museum of tiny things" />
      </Field>
      <Field id="description" label="Description and instructions" hint={`${draft.description.trim().length}/800 characters. Plain text only; links aren't allowed.`} error={errors.description}>
        <Textarea id="description" value={draft.description} maxLength={800} onChange={(e) => onChange({ description: e.target.value })} aria-invalid={Boolean(errors.description)} aria-describedby={describedBy("description", errors.description, "x")} placeholder="Explain what to do in a sentence or two. Add any safety notes." />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Choice id="category" label="Category" value={draft.category} error={errors.category} onChange={(v) => onChange({ category: v })} options={opts(CATEGORIES, CATEGORY_LABELS)} />
        <Field id="duration_minutes" label="Estimated duration (minutes)" error={errors.duration_minutes}>
          <Input id="duration_minutes" type="number" inputMode="numeric" min={1} max={240} value={draft.duration_minutes} onChange={(e) => onChange({ duration_minutes: e.target.value })} aria-invalid={Boolean(errors.duration_minutes)} aria-describedby={describedBy("duration_minutes", errors.duration_minutes)} />
        </Field>
        <Choice id="difficulty" label="Difficulty" value={draft.difficulty} error={errors.difficulty} onChange={(v) => onChange({ difficulty: v })} options={opts(DIFFICULTIES, DIFFICULTY_LABELS)} />
        <Choice id="location" label="Location" value={draft.location} error={errors.location} onChange={(v) => onChange({ location: v })} options={opts(LOCATIONS, LOCATION_LABELS)} />
        <Choice id="energy_level" label="Energy level" value={draft.energy_level} error={errors.energy_level} onChange={(v) => onChange({ energy_level: v })} options={opts(ENERGY_LEVELS, ENERGY_LABELS)} />
        <Choice id="cost_type" label="Does it cost money to do?" value={draft.cost_type} error={errors.cost_type} onChange={(v) => onChange({ cost_type: v })} options={opts(COST_TYPES, COST_LABELS)} />
        <Choice id="people_type" label="Suitable group size" value={draft.people_type} error={errors.people_type} onChange={(v) => onChange({ people_type: v })} options={opts(PEOPLE_TYPES, PEOPLE_LABELS)} />
      </div>
    </div>
  );
}
