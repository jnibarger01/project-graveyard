import { useEffect, useRef } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadGraveyard, saveGraveyard, seedDemoIfEmpty } from "@/lib/server/graveyard";
import { useGraveyard } from "./store";

export async function persistGraveyard() {
  try {
    const { repos, settings } = useGraveyard.getState();
    await saveGraveyard({ data: { repos, settings } });
  } catch {
    /* guest, or unauthorized — local store is enough */
  }
}

export function useGraveyardBootstrap() {
  const { user, isPending } = useCurrentUserState();
  const replaceAll = useGraveyard((s) => s.replaceAll);
  const booted = useRef(false);

  useEffect(() => {
    const result = useGraveyard.persist.rehydrate();
    void Promise.resolve(result).finally(() => {
      useGraveyard.getState().setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (isPending || booted.current) return;
    if (!user) return;
    booted.current = true;
    void (async () => {
      try {
        const existing = await loadGraveyard();
        if (existing.repos.length > 0) {
          replaceAll(existing.repos, existing.settings);
        } else {
          const seeded = await seedDemoIfEmpty();
          replaceAll(seeded.repos, seeded.settings);
        }
      } catch {
        /* keep local demo */
      }
    })();
  }, [user, isPending, replaceAll]);
}
