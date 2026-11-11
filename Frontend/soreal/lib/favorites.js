const FAVORITES_KEY = "soreal_favorites";

export function getFavorites() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addFavorite(propertyId) {
  if (typeof window === "undefined") return;
  const favs = getFavorites();
  if (!favs.includes(propertyId)) {
    favs.push(propertyId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  }
}

export function removeFavorite(propertyId) {
  if (typeof window === "undefined") return;
  const favs = getFavorites().filter((id) => id !== propertyId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
}

export function isFavorite(propertyId) {
  if (typeof window === "undefined") return false;
  return getFavorites().includes(propertyId);
}
