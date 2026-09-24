import { useMemo, useSyncExternalStore } from "react";
import { getPackVersion, subscribePacks, t as translate } from "./index";

/**
 * React binding for the pack-based translation registry.
 *
 * Packs arrive asynchronously (every locale except English lazy-loads), so
 * the hook subscribes to the pack registry version and re-derives its `t`
 * when a pack lands — a switch renders correctly on the tick after the pack
 * is resident, never with half-updated text.
 */
export function useTranslations(locale?: string) {
  // Registry version covers both reactivity paths: a fresh pack arriving and
  // a switch to an already-resident pack (setLocale notifies on both).
  const version = useSyncExternalStore(subscribePacks, getPackVersion, getPackVersion);

  return useMemo(() => {
    void version;
    void locale;
    return {
      t: (key: string, params?: Record<string, string | number>, defaultText?: string): string =>
        translate(key, params, defaultText),
    };
  }, [version, locale]);
}
