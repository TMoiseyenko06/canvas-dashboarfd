/**
 * Convert decimal hours (e.g. 2.5) to NhNmNs display string (e.g. "2h30m0s").
 * Returns null if hours is null/undefined.
 */
export function formatDuration(hours) {
  if (hours == null) return null
  const totalSeconds = Math.round(hours * 3600)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h}h${m}m${s}s`
}
