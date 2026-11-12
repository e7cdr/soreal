export const STALE_THRESHOLD_DAYS = 15;

export function daysOld(createdAt) {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const diffMs = now - date;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function isStale(createdAt, threshold = STALE_THRESHOLD_DAYS) {
  const days = daysOld(createdAt);
  return days !== null && days >= threshold;
}

export function formatDaysAgo(days) {
  if (days === null) return null;
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
