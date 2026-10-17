// Builds an after-action report for one run: everything that happened
// (injects revealed, status changes, both teams' decisions) merged into a
// single chronological timeline. Two output formats, same pattern Campaign
// Forge uses for its own exports:
// - a plain, printer-friendly HTML document (window.open + print, no PDF
//   library needed), modeled on src/utils/printPrepSheet.js
// - a raw JSON download (Blob + <a download>), modeled on App.jsx's backup
//   export

import { OBJECTIVE_OUTCOME_LABEL, OBJECTIVE_OUTCOME_COLOR } from "../data/model.js";

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const STATUS_EVENT_LABEL = { running: "Exercise running", paused: "Exercise paused", ended: "Exercise ended" };
const KIND_LABEL = { event: "Event", red: "Red Team", blue: "Blue Team" };
const KIND_COLOR = { event: "#555555", red: "#b03a2e", blue: "#1f7a4d" };

function injectById(scenario, id) {
  return scenario?.injects.find((i) => i.id === id) || null;
}

/**
 * Flattens a run's events and both decision logs into one array sorted by
 * time. This is the "merge" step — everything else just renders this list.
 */
export function buildAfterActionTimeline(run, scenario) {
  const entries = [];

  run.events.forEach((e) => {
    if (e.type === "inject_revealed") {
      const inj = injectById(scenario, e.payload.injectId);
      entries.push({ at: e.at, kind: "event", label: `Inject revealed: ${inj?.title || "Untitled"}`, detail: inj?.body || "" });
    } else if (e.type === "status_changed") {
      entries.push({ at: e.at, kind: "event", label: STATUS_EVENT_LABEL[e.payload.status] || `Status: ${e.payload.status}`, detail: "" });
    }
  });

  run.redLog.forEach((entry) => {
    const inj = entry.injectId ? injectById(scenario, entry.injectId) : null;
    entries.push({ at: entry.at, kind: "red", label: inj ? `Red Team — re: ${inj.title || "Untitled"}` : "Red Team", detail: entry.body });
  });

  run.blueLog.forEach((entry) => {
    const inj = entry.injectId ? injectById(scenario, entry.injectId) : null;
    entries.push({ at: entry.at, kind: "blue", label: inj ? `Blue Team — re: ${inj.title || "Untitled"}` : "Blue Team", detail: entry.body });
  });

  return entries.sort((a, b) => a.at - b.at);
}

export function buildAfterActionHtml(run, scenario) {
  const timeline = buildAfterActionTimeline(run, scenario);
  const title = scenario?.title || run.scenarioTitleSnapshot || "Untitled scenario";
  const fmt = (ts) => (ts ? new Date(ts).toLocaleString() : "—");

  // Prefer the run's own objective snapshot (with outcomes) — fall back to
  // the scenario's live objectives, unassessed, only for a run that predates
  // this field (objectiveOutcomes backfills to [] for those, same as any
  // other normalizeRun() backfill).
  const objectiveEntries =
    run.objectiveOutcomes.length > 0
      ? run.objectiveOutcomes
      : (scenario?.objectives || []).map((text) => ({ text, outcome: "unset" }));

  const objectivesHtml =
    objectiveEntries.length === 0
      ? ""
      : `<h2>Objectives</h2><ul class="objectives">${objectiveEntries
          .map(
            (o) =>
              `<li><span class="outcome-badge" style="color:${OBJECTIVE_OUTCOME_COLOR[o.outcome]};border-color:${OBJECTIVE_OUTCOME_COLOR[o.outcome]}">${esc(OBJECTIVE_OUTCOME_LABEL[o.outcome])}</span>${esc(o.text)}</li>`
          )
          .join("")}</ul>`;

  const timelineHtml =
    timeline.length === 0
      ? "<p>Nothing happened in this run.</p>"
      : `<ul class="timeline">${timeline
          .map(
            (t) => `
      <li style="border-left-color:${KIND_COLOR[t.kind]}">
        <span class="time">${esc(new Date(t.at).toLocaleTimeString())}</span>
        <span class="kind" style="color:${KIND_COLOR[t.kind]}">${esc(KIND_LABEL[t.kind])}</span>
        <strong>${esc(t.label)}</strong>
        ${t.detail ? `<div class="desc">${esc(t.detail).replace(/\n/g, "<br>")}</div>` : ""}
      </li>`
          )
          .join("")}</ul>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${esc(title)} — After-Action Report</title>
<style>
  body { font-family: Georgia, serif; color: #1a1a1a; max-width: 760px; margin: 40px auto; padding: 0 20px; line-height: 1.5; }
  h1 { font-size: 22px; border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; }
  h2 { font-size: 17px; margin-top: 28px; border-bottom: 1px solid #999; padding-bottom: 4px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
  ul.objectives { padding-left: 0; list-style: none; }
  ul.objectives li { margin-bottom: 6px; }
  .outcome-badge { display: inline-block; border: 1px solid; border-radius: 3px; padding: 1px 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; margin-right: 8px; }
  ul.timeline { list-style: none; padding: 0; }
  ul.timeline li { border-left: 3px solid #ccc; padding: 6px 0 6px 14px; margin-bottom: 10px; }
  .time { font-family: 'Courier New', monospace; font-size: 12px; color: #888; margin-right: 10px; }
  .kind { font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; margin-right: 8px; }
  .desc { color: #444; font-size: 13px; margin-top: 4px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>${esc(title)} — After-Action Report</h1>
  <div class="meta">
    Status: ${esc(run.status)} · Started: ${fmt(run.startedAt)} · Ended: ${fmt(run.endedAt)}<br>
    Generated ${new Date().toLocaleDateString()}
  </div>

  ${scenario?.summary ? `<h2>Summary</h2><p>${esc(scenario.summary)}</p>` : ""}
  ${objectivesHtml}

  <h2>Timeline</h2>
  ${timelineHtml}
</body>
</html>`;
}

export function printAfterActionReport(run, scenario) {
  const html = buildAfterActionHtml(run, scenario);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow pop-ups for this site to print the after-action report.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function slugify(str) {
  return String(str || "run")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Raw JSON backup of one run plus the scenario it ran, for safekeeping or sharing. */
export function exportRunJson(run, scenario) {
  const payload = { run, scenario, exportedAt: Date.now() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const datePart = new Date(run.startedAt || run.createdAt).toISOString().slice(0, 10);
  a.download = `incident-forge-${slugify(scenario?.title || run.scenarioTitleSnapshot)}-${datePart}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
