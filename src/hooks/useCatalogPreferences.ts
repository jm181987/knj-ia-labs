import { useCallback, useEffect, useState } from "react";

const FAVORITES_KEY = "knj.catalog.favorites.v1";
const RECENTS_KEY = "knj.catalog.recents.v1";
const MAX_RECENTS = 8;

function readIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(ids));
}

export function useCatalogPreferences() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readIds(FAVORITES_KEY));
  const [recentIds, setRecentIds] = useState<string[]>(() => readIds(RECENTS_KEY));

  useEffect(() => writeIds(FAVORITES_KEY, favoriteIds), [favoriteIds]);
  useEffect(() => writeIds(RECENTS_KEY, recentIds), [recentIds]);

  const toggleFavorite = useCallback((modelId: string) => {
    setFavoriteIds((current) =>
      current.includes(modelId)
        ? current.filter((id) => id !== modelId)
        : [modelId, ...current],
    );
  }, []);

  const recordRecent = useCallback((modelId: string) => {
    setRecentIds((current) => [modelId, ...current.filter((id) => id !== modelId)].slice(0, MAX_RECENTS));
  }, []);

  return {
    favoriteIds,
    recentIds,
    toggleFavorite,
    recordRecent,
  };
}
