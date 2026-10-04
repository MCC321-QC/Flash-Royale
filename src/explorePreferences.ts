const categoryOnlineOnlyKey = "flashroyale.y8CategoryShowOnlineOnly";

export type CategoryOnlineOnlyPreferences = Record<string, boolean>;

export function readCategoryOnlineOnlyPreferences(storage: Pick<Storage, "getItem">): CategoryOnlineOnlyPreferences {
  try {
    const saved = storage.getItem(categoryOnlineOnlyKey);
    if (!saved) return {};
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid Y8 category preferences.");
    }
    const preferences: CategoryOnlineOnlyPreferences = {};
    for (const [category, enabled] of Object.entries(parsed)) {
      if (!/^[a-z0-9_-]+$/.test(category) || typeof enabled !== "boolean") {
        throw new Error("Invalid Y8 category preference.");
      }
      preferences[category] = enabled;
    }
    return preferences;
  } catch (error) {
    console.warn("Could not read Y8 category preferences:", error);
    return {};
  }
}

export function includeCategoryOnlineOnlyGames(preferences: CategoryOnlineOnlyPreferences, category: string): boolean {
  return !category || preferences[category] !== false;
}

export function saveCategoryOnlineOnlyPreference(
  storage: Pick<Storage, "setItem">,
  preferences: CategoryOnlineOnlyPreferences,
  category: string,
  enabled: boolean,
): CategoryOnlineOnlyPreferences {
  if (!category || !/^[a-z0-9_-]+$/.test(category)) throw new Error("Select a Y8 category before changing its preference.");
  const next = { ...preferences, [category]: enabled };
  storage.setItem(categoryOnlineOnlyKey, JSON.stringify(next));
  return next;
}
