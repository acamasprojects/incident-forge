import { useState, useEffect, useCallback, useRef } from "react";
import { emptyStore, normalizeStore } from "../data/model.js";

const STORE_KEY = "incident-forge-data";

/**
 * Owns the full { scenarios, runs } store, loads it from localStorage on
 * mount and debounce-persists it on every change. Same shape as Campaign
 * Forge's useCampaignStore: one hook, one mutation primitive, components
 * stay dumb.
 */
export function useExerciseStore() {
  const [loaded, setLoaded] = useState(false);
  const [store, setStore] = useState(() => emptyStore());
  const saveTimer = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setStore(normalizeStore(JSON.parse(raw)));
    } catch {
      // first run, or corrupt data — start fresh
    }
    setLoaded(true);
  }, []);

  const persist = useCallback((next) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error("Incident Forge: failed to save", e);
      }
    }, 300);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    persist(store);
  }, [store, loaded, persist]);

  /** Apply fn to a shallow copy of the store and commit what it returns. */
  const update = useCallback((fn) => {
    setStore((prev) => fn({ ...prev }));
  }, []);

  /** Swap out the whole store at once, e.g. after a JSON import. */
  const replaceStore = useCallback((next) => {
    setStore(normalizeStore(next));
  }, []);

  return { loaded, store, update, replaceStore };
}
