import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cloneDemoRepos, DEFAULT_SETTINGS } from "./demo-data";
import type { Filters, GraveyardSettings, Repo, UserStatus } from "./types";

export const EMPTY_FILTERS: Filters = {
  q: "",
  recommendation: "all",
  language: "all",
  visibility: "all",
  activity: "all",
  work: "all",
  minScore: 0,
  minProduct: 0,
};

type GraveyardStore = {
  repos: Repo[];
  settings: GraveyardSettings;
  filters: Filters;
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  replaceAll: (repos: Repo[], settings?: GraveyardSettings) => void;
  resetDemo: () => void;
  updateRepo: (id: string, patch: Partial<Repo>) => void;
  setStatus: (id: string, status: UserStatus) => void;
  setNotes: (id: string, notes: string) => void;
  setSnooze: (id: string, until: string | undefined) => void;
  enqueue: (id: string) => void;
  dequeue: (id: string) => void;
  moveQueue: (id: string, dir: -1 | 1) => void;
  overrideAnalysis: (id: string, rec: Repo["analysis"]["recommendation"]) => void;
  setHumor: (on: boolean) => void;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
};

function nextQueuePosition(repos: Repo[]) {
  const used = repos.filter((r) => r.userStatus === "queued").map((r) => r.queuePosition ?? 0);
  return (used.length ? Math.max(...used) : 0) + 1;
}

export const useGraveyard = create<GraveyardStore>()(
  persist(
    (set, get) => ({
      repos: cloneDemoRepos(),
      settings: { ...DEFAULT_SETTINGS },
      filters: { ...EMPTY_FILTERS },
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      replaceAll: (repos, settings) =>
        set({
          repos,
          settings: settings ?? get().settings,
        }),
      resetDemo: () =>
        set({
          repos: cloneDemoRepos(),
          settings: { ...DEFAULT_SETTINGS },
        }),
      updateRepo: (id, patch) =>
        set({
          repos: get().repos.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        }),
      setStatus: (id, status) =>
        set({
          repos: get().repos.map((r) => {
            if (r.id !== id) return r;
            const queuePosition =
              status === "queued" ? (r.queuePosition ?? nextQueuePosition(get().repos)) : null;
            return { ...r, userStatus: status, queuePosition };
          }),
        }),
      setNotes: (id, notes) =>
        set({
          repos: get().repos.map((r) => (r.id === id ? { ...r, userNotes: notes } : r)),
        }),
      setSnooze: (id, until) =>
        set({
          repos: get().repos.map((r) =>
            r.id === id
              ? {
                  ...r,
                  userStatus: until ? "snoozed" : r.userStatus === "snoozed" ? "none" : r.userStatus,
                  snoozedUntil: until,
                }
              : r,
          ),
        }),
      enqueue: (id) => {
        const repos = get().repos;
        const pos = nextQueuePosition(repos);
        set({
          repos: repos.map((r) =>
            r.id === id ? { ...r, userStatus: "queued" as const, queuePosition: pos } : r,
          ),
        });
      },
      dequeue: (id) =>
        set({
          repos: get().repos.map((r) =>
            r.id === id ? { ...r, userStatus: "none" as const, queuePosition: null } : r,
          ),
        }),
      moveQueue: (id, dir) => {
        const queued = get()
          .repos.filter((r) => r.userStatus === "queued")
          .sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0));
        const idx = queued.findIndex((r) => r.id === id);
        const swap = queued[idx + dir];
        if (idx < 0 || !swap) return;
        const aPos = queued[idx]!.queuePosition ?? idx;
        const bPos = swap.queuePosition ?? idx + dir;
        set({
          repos: get().repos.map((r) => {
            if (r.id === id) return { ...r, queuePosition: bPos };
            if (r.id === swap.id) return { ...r, queuePosition: aPos };
            return r;
          }),
        });
      },
      overrideAnalysis: (id, rec) =>
        set({
          repos: get().repos.map((r) =>
            r.id === id
              ? {
                  ...r,
                  analysis: {
                    ...r.analysis,
                    recommendation: rec,
                    recommendationReason: `You overrode the recommendation to ${rec}.`,
                  },
                }
              : r,
          ),
        }),
      setHumor: (on) => set({ settings: { ...get().settings, humorEnabled: on } }),
      setFilters: (patch) => set({ filters: { ...get().filters, ...patch } }),
      resetFilters: () => set({ filters: { ...EMPTY_FILTERS } }),
    }),
    {
      name: "project-graveyard.v1",
      skipHydration: true,
      partialize: (s) => ({ repos: s.repos, settings: s.settings }),
    },
  ),
);
