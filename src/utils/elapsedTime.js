// How long an exercise has actually been running, with paused time taken
// out. Kept pure — `now` is passed in rather than read via Date.now() here —
// so a live-ticking component just needs to re-render on an interval with a
// fresh `now`, and so this is trivial to test without mocking the clock.

/**
 * Milliseconds of actual run time so far, excluding any time spent paused.
 * Returns 0 for a run that hasn't started yet.
 */
export function elapsedMs(run, now) {
  if (run.startedAt == null) return 0;
  const end = run.status === "ended" ? run.endedAt ?? now : run.status === "paused" ? run.pausedAt ?? now : now;
  return Math.max(0, end - run.startedAt - (run.pausedMs || 0));
}

/** Formats a millisecond duration as H:MM:SS, or M:SS once it's under an hour. */
export function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
