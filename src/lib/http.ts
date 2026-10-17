import { NextResponse } from "next/server";

export type ErrorCode =
  | "not_configured"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "conflict"
  | "rate_limited"
  | "server_error";

const STATUS: Record<ErrorCode, number> = {
  not_configured: 503,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 400,
  conflict: 409,
  rate_limited: 429,
  server_error: 500,
};

/** Consistent JSON error shape: { error: { code, message, fields? } }. Never includes internals. */
export function apiError(code: ErrorCode, message: string, fields?: Record<string, string>) {
  return NextResponse.json(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status: STATUS[code], headers: { "Cache-Control": "no-store" } },
  );
}

export function apiOk<T>(data: T, init?: { status?: number; cache?: "private" | "public-short" | "public-day" }) {
  const cache =
    init?.cache === "public-short"
      ? "public, s-maxage=30, max-age=0, must-revalidate"
      : init?.cache === "public-day"
        ? "public, s-maxage=86400, max-age=3600, stale-while-revalidate=86400"
        : "private, no-store";
  return NextResponse.json(data, { status: init?.status ?? 200, headers: { "Cache-Control": cache } });
}

/** Maps a Postgres/PostgREST error raised by our SQL functions to an API error. */
export function fromDbError(error: { message?: string; code?: string } | null) {
  const msg = error?.message ?? "";
  if (msg.includes("not_authenticated")) return apiError("unauthenticated", "Please sign in first.");
  if (msg.includes("not_admin")) return apiError("forbidden", "You don't have access to that.");
  if (msg.includes("account_suspended")) return apiError("forbidden", "This account is suspended.");
  if (msg.includes("invalid_vote")) return apiError("invalid_input", "That isn't a valid vote.");
  if (msg.includes("activity_not_found")) return apiError("not_found", "That activity isn't available.");
  if (msg.includes("submission_not_found")) return apiError("not_found", "Submission not found.");
  if (msg.includes("no_daily_challenge")) return apiError("not_found", "There's no challenge today.");
  if (msg.includes("rate_limited")) return apiError("rate_limited", "Too many submissions today. Try again tomorrow.");
  if (msg.includes("invalid_transition")) return apiError("conflict", "That action isn't allowed in the current state.");
  if (msg.includes("reason_required")) return apiError("invalid_input", "Please include a note for the submitter.");
  if (msg.includes("date_in_past")) return apiError("invalid_input", "Pick today or a future date.");
  if (msg.includes("challenge_already_completed")) return apiError("conflict", "Someone has already completed that day's challenge.");
  if (error?.code === "23505") return apiError("conflict", "That already exists.");
  console.error("Database error", { code: error?.code });
  return apiError("server_error", "Something went wrong. Please try again.");
}
