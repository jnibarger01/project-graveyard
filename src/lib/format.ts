import { format, formatDistanceToNowStrict, differenceInDays } from "date-fns";
import type {
  ProjectState,
  Recommendation,
  Repo,
  UserStatus,
  WorkRemaining,
} from "./types";

export const WORK_RANGE: Record<WorkRemaining, { label: string; daysLow: number; daysHigh: number }> =
  {
    tiny: { label: "<1 day", daysLow: 0.3, daysHigh: 1 },
    small: { label: "1–3 days", daysLow: 1, daysHigh: 3 },
    medium: { label: "4–10 days", daysLow: 4, daysHigh: 10 },
    large: { label: "2–6 weeks", daysLow: 10, daysHigh: 30 },
    massive: { label: "6+ weeks", daysLow: 30, daysHigh: 60 },
  };

export const RECOMMENDATION_COPY: Record<
  Recommendation,
  { label: string; verb: string; hint: string }
> = {
  FINISH: { label: "Finish it", verb: "Finish", hint: "Worth completing" },
  ARCHIVE: { label: "Archive it", verb: "Archive", hint: "Safe to bury" },
  MERGE: { label: "Merge it", verb: "Merge", hint: "Fold into another repo" },
  OPEN_SOURCE: { label: "Open source it", verb: "Open source", hint: "Release publicly" },
  PRODUCTIZE: { label: "Turn it into a product", verb: "Productize", hint: "Commercial potential" },
  UNKNOWN: { label: "Insufficient evidence", verb: "Unknown", hint: "Needs more evidence" },
};

export const STATE_COPY: Record<ProjectState, string> = {
  idea: "Idea / prototype",
  early: "Early development",
  mvp: "Functional MVP",
  mostly_complete: "Mostly complete",
  production: "Production-ready",
  legacy: "Legacy",
  abandoned: "Abandoned",
  unknown: "Unknown",
};

export const STATUS_COPY: Record<UserStatus, string> = {
  none: "Undecided",
  active: "Active",
  snoozed: "Snoozed",
  finished: "Finished",
  abandoned: "Intentionally abandoned",
  queued: "In resurrection queue",
};

export function relativeActivity(iso: string) {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "unknown";
  }
}

export function formatShortDate(iso: string) {
  try {
    return format(new Date(iso), "MMM yyyy");
  } catch {
    return "—";
  }
}

export function formatLongDate(iso: string) {
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return "—";
  }
}

export function daysSince(iso: string) {
  try {
    return differenceInDays(new Date(), new Date(iso));
  } catch {
    return 9999;
  }
}

export function isDormant(repo: Repo) {
  if (repo.userStatus === "active" || repo.userStatus === "finished") return false;
  if (repo.userStatus === "abandoned") return true;
  return daysSince(repo.lastCommitAt) >= 45;
}

export function languageList(repo: Repo) {
  const keys = Object.keys(repo.languages);
  if (keys.length) return keys.slice(0, 4);
  return repo.language ? [repo.language] : [];
}

export function scoreTone(score: number): "high" | "mid" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}
