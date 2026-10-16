// Search/filter/tag helpers backing every list in the app. Multi-word
// queries match across fields (not just one literal substring), results
// rank by relevance, and a near-miss query can still surface "did you mean"
// suggestions. Copied unchanged from Campaign Forge — fully generic, no
// domain coupling.

/** Lowercase, whitespace-split query into individual search terms. */
export function tokenize(str) {
  return (str || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** How well one token matches one field value. Higher = better match. */
function tokenScore(token, value) {
  if (!value) return 0;
  const v = String(value).toLowerCase();
  if (v === token) return 4; // whole field is exactly the token
  const words = v.split(/\s+/);
  if (words.includes(token)) return 3; // token is a whole word in the field
  if (words.some((w) => w.startsWith(token))) return 2; // a word starts with the token
  if (v.includes(token)) return 1; // token appears somewhere (mid-word, partial)
  return 0;
}

/**
 * Scores an entity against a query. `fields` is an array of
 * { value, weight?, label? } — weight boosts important fields (e.g. title)
 * over minor ones (e.g. body); label is what gets reported back in
 * matchedFields so the UI can show "matched via: tags".
 *
 * Every token must match *something* (AND logic) or the score is 0.
 * An empty query always scores 1 (matches everything, no ranking signal).
 */
export function scoreEntity(query, fields) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return { score: 1, matchedFields: [] };

  let total = 0;
  const matchedFields = new Set();
  for (const token of tokens) {
    let best = 0;
    let bestLabel = null;
    for (const f of fields) {
      const s = tokenScore(token, f.value) * (f.weight ?? 1);
      if (s > best) {
        best = s;
        bestLabel = f.label;
      }
    }
    if (best === 0) return { score: 0, matchedFields: [] };
    total += best;
    if (bestLabel) matchedFields.add(bestLabel);
  }
  return { score: total, matchedFields: Array.from(matchedFields) };
}

/**
 * Filters + ranks a list of items. `fieldsFn(item)` builds the weighted
 * field list per item; `extraFilter(item)` applies non-search filters
 * (visibility/tag chips etc.) before scoring. Returns
 * [{ item, score, matchedFields }], sorted best-match-first, with original
 * order preserved as a tiebreaker (stable sort) when the query is empty.
 */
export function searchAndFilter(items, { search, fieldsFn, extraFilter }) {
  const tokens = tokenize(search);
  const results = [];
  for (const item of items) {
    if (extraFilter && !extraFilter(item)) continue;
    const { score, matchedFields } = scoreEntity(search, fieldsFn(item));
    if (tokens.length > 0 && score === 0) continue;
    results.push({ item, score, matchedFields });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

/** Standard Levenshtein (edit) distance between two strings. */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[n];
}

/**
 * "Did you mean…" — nearest-spelling candidates for a query that matched
 * nothing. Tolerance scales with word length so short names aren't overly
 * lenient and long ones aren't overly strict.
 */
export function suggestClosest(query, candidates, max = 3) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const unique = Array.from(new Set(candidates.filter(Boolean)));
  return unique
    .map((c) => ({ c, d: levenshtein(q, c.toLowerCase()) }))
    .filter(({ c, d }) => d > 0 && d <= Math.max(2, Math.ceil(c.length * 0.4)))
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map(({ c }) => c);
}

/** True if itemTags contains every tag in activeTags (AND logic). No active tags = always true. */
export function hasAllTags(itemTags, activeTags) {
  if (!activeTags || activeTags.length === 0) return true;
  const set = new Set(itemTags || []);
  return activeTags.every((t) => set.has(t));
}

/** Sorted list of every unique tag used across a collection of entities. */
export function collectTags(items) {
  const set = new Set();
  items.forEach((item) => (item.tags || []).forEach((t) => set.add(t)));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Toggle a value in/out of an array, returning a new array. */
export function toggleValue(arr, value) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}
