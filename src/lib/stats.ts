import type { DashboardStats, Filters, Repo, WorkRemaining } from "./types";
import { WORK_RANGE, daysSince, isDormant } from "./format";

export function computeStats(repos: Repo[]): DashboardStats {
  const total = repos.length;
  const archived = repos.filter(
    (r) => r.userStatus === "abandoned" || r.analysis.recommendation === "ARCHIVE",
  ).length;
  const active = repos.filter((r) => r.userStatus === "active" || !isDormant(r)).length;
  const dormant = repos.filter((r) => isDormant(r) && r.userStatus !== "abandoned").length;
  const recoverable = repos.filter(
    (r) =>
      r.analysis.resurrectionScore >= 65 &&
      r.analysis.recommendation !== "ARCHIVE" &&
      r.userStatus !== "abandoned" &&
      r.userStatus !== "finished",
  ).length;
  const potentialProducts = repos.filter(
    (r) => r.analysis.recommendation === "PRODUCTIZE" || r.analysis.commercialPotential >= 70,
  ).length;

  const remaining = repos.filter(
    (r) =>
      r.userStatus !== "finished" &&
      r.userStatus !== "abandoned" &&
      r.analysis.recommendation !== "ARCHIVE",
  );
  let daysLow = 0;
  let daysHigh = 0;
  for (const r of remaining) {
    const range = WORK_RANGE[r.analysis.workRemaining];
    daysLow += range.daysLow;
    daysHigh += range.daysHigh;
  }
  let unfinishedWorkload: WorkRemaining = "tiny";
  if (daysHigh >= 30) unfinishedWorkload = "massive";
  else if (daysHigh >= 10) unfinishedWorkload = "large";
  else if (daysHigh >= 4) unfinishedWorkload = "medium";
  else if (daysHigh >= 1) unfinishedWorkload = "small";

  return {
    total,
    active,
    dormant,
    archived,
    recoverable,
    potentialProducts,
    unfinishedWorkload,
    unfinishedDaysLow: Math.round(daysLow),
    unfinishedDaysHigh: Math.round(daysHigh),
  };
}

export function applyFilters(repos: Repo[], f: Filters): Repo[] {
  const q = f.q.trim().toLowerCase();
  return repos.filter((r) => {
    if (f.recommendation !== "all" && r.analysis.recommendation !== f.recommendation) return false;
    if (f.language !== "all" && r.language !== f.language && !Object.keys(r.languages).includes(f.language))
      return false;
    if (f.visibility === "public" && r.isPrivate) return false;
    if (f.visibility === "private" && !r.isPrivate) return false;
    if (f.work !== "all" && r.analysis.workRemaining !== f.work) return false;
    if (r.analysis.resurrectionScore < f.minScore) return false;
    if (r.analysis.commercialPotential < f.minProduct) return false;
    if (f.activity === "active" && isDormant(r)) return false;
    if (f.activity === "dormant" && !isDormant(r)) return false;
    if (f.activity === "archived") {
      if (r.userStatus !== "abandoned" && r.analysis.recommendation !== "ARCHIVE") return false;
    }
    if (q) {
      const hay = [
        r.name,
        r.description,
        r.analysis.purpose,
        r.userNotes,
        r.analysis.epitaph,
        r.frameworks.join(" "),
        r.language,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function uniqueLanguages(repos: Repo[]): string[] {
  const set = new Set<string>();
  for (const r of repos) {
    if (r.language) set.add(r.language);
  }
  return [...set].sort();
}

export function mostWorthResurrecting(repos: Repo[], n = 4) {
  return repos
    .filter(
      (r) =>
        r.userStatus !== "abandoned" &&
        r.userStatus !== "finished" &&
        r.analysis.recommendation !== "ARCHIVE",
    )
    .slice()
    .sort((a, b) => b.analysis.resurrectionScore - a.analysis.resurrectionScore)
    .slice(0, n);
}

export function easyWins(repos: Repo[], n = 4) {
  return repos
    .filter(
      (r) =>
        (r.analysis.workRemaining === "tiny" || r.analysis.workRemaining === "small") &&
        r.analysis.resurrectionScore >= 50 &&
        r.analysis.recommendation !== "ARCHIVE" &&
        r.userStatus !== "abandoned" &&
        r.userStatus !== "finished",
    )
    .sort((a, b) => b.analysis.resurrectionScore - a.analysis.resurrectionScore)
    .slice(0, n);
}

export function productOpportunities(repos: Repo[], n = 4) {
  return repos
    .filter(
      (r) =>
        (r.analysis.recommendation === "PRODUCTIZE" || r.analysis.commercialPotential >= 70) &&
        r.userStatus !== "abandoned",
    )
    .sort((a, b) => b.analysis.commercialPotential - a.analysis.commercialPotential)
    .slice(0, n);
}

export function duplicateExperiments(repos: Repo[]) {
  return repos.filter((r) => r.analysis.overlaps.some((o) => o.percent >= 40));
}

export function graveyardList(repos: Repo[]) {
  return repos
    .filter(
      (r) =>
        r.analysis.recommendation === "ARCHIVE" ||
        r.userStatus === "abandoned" ||
        r.analysis.resurrectionScore < 20,
    )
    .sort((a, b) => a.analysis.resurrectionScore - b.analysis.resurrectionScore);
}

export function queuedRepos(repos: Repo[]) {
  return repos
    .filter((r) => r.userStatus === "queued")
    .sort((a, b) => (a.queuePosition ?? 99) - (b.queuePosition ?? 99));
}

export function activityFreshness(iso: string) {
  const d = daysSince(iso);
  if (d <= 14) return "fresh";
  if (d <= 45) return "warm";
  if (d <= 180) return "cool";
  return "cold";
}
