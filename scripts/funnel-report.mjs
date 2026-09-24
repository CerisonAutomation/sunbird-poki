#!/usr/bin/env node
/**
 * One-command funnel report: `pnpm funnel:report`.
 *
 * Reads `GET /mp/v1/telemetry/funnel` from the social server and prints the
 * first-run path the way a playtest debrief wants it: how many sessions reached
 * each stage, what fraction fell out between one stage and the next, where they
 * said they stalled, and the single worst step.
 *
 *     node scripts/funnel-report.mjs                       # http://127.0.0.1:8790
 *     SOCIAL_URL=https://sunbird-social.example node scripts/funnel-report.mjs
 *     node scripts/funnel-report.mjs http://127.0.0.1:9011 --json
 *
 * Two honest caveats, printed with the report:
 *
 *   • Portal builds send no telemetry to this backend at all (portal compliance
 *     forbids it), so during a Poki playtest the funnel to read is Poki's own
 *     dashboard — our `measure("player", "funnel-<stage>", "reached")` events
 *     feed it. This report is for the direct build and for local sessions.
 *   • The counters are in-memory and per-process by design: the sink refuses to
 *     become a tracking system, so a restart resets the funnel. Read it as a
 *     trend for the sessions since boot, never as a historical record.
 *   • Ingest is rate-limited per IP (10 writes per window, then HTTP 429 and the
 *     beacon is dropped — `sendBeacon` cannot retry). A whole playtest cohort
 *     behind one NAT therefore under-reports in absolute terms. Read the shape
 *     of the funnel and the worst step, not the session count. Verified live:
 *     40 synthetic sessions from one address landed 16.
 */
import { fileURLToPath } from "node:url";

const DEFAULT_URL = "http://127.0.0.1:8790";
/** Mirrors `MIN_SAMPLE` in server/src/telemetry/TelemetryService.ts: below this
 * many sessions at the previous stage the server reports no rate at all. */
const MIN_SAMPLE = 5;

/**
 * Render a funnel report as a fixed-width table. Pure so it can be tested (and
 * so `--json` is the only branch that touches the network shape).
 */
export function formatFunnel(report) {
  const lines = [];
  const pct = (v) => (v === null || v === undefined ? "   —  " : `${(v * 100).toFixed(1).padStart(5)}%`);
  lines.push("Sunbird first-run funnel — sessions since the sink started");
  lines.push("");
  lines.push(`  devices (denominator)  ${report.devices}`);
  lines.push(`  entered the path       ${report.entered}`);
  lines.push(`  reported a stall       ${report.stalled}`);
  lines.push("");
  lines.push("  #  stage            reached   kept    lost  stalled");
  for (const [i, step] of report.steps.entries()) {
    lines.push(
      `  ${String(i).padStart(2)}  ${step.stage.padEnd(15)} ${String(step.reached).padStart(7)} ` +
        `${pct(step.conversion)}  ${pct(step.dropOff)}  ${String(step.stalled).padStart(7)}`,
    );
  }
  lines.push("");
  if (report.worst) {
    lines.push(
      `  worst step: ${report.worst.stage} — ${(report.worst.dropOff * 100).toFixed(1)}% lost ` +
        `(${report.worst.reached} of ${report.worst.of} continued)`,
    );
  } else if (report.steps.length > 1) {
    lines.push(`  no rate reported yet: every step is below ${MIN_SAMPLE} sessions at the previous stage`);
  } else {
    lines.push("  nothing to report — no funnel events have reached this sink");
  }
  lines.push("");
  lines.push("  Portal builds send no telemetry here (compliance); read Poki's own");
  lines.push("  dashboard for portal traffic. Counters reset on restart, by design,");
  lines.push("  and ingest is rate-limited per IP — read the shape, not the totals.");
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const base = (args.find((a) => !a.startsWith("--")) ?? process.env.SOCIAL_URL ?? DEFAULT_URL).replace(/\/$/, "");
  const url = `${base}/mp/v1/telemetry/funnel`;

  let report;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    report = await res.json();
  } catch (err) {
    console.error(`funnel report: could not read ${url}`);
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    console.error("  Is the social server running? (tsx server/src/index.ts)");
    process.exitCode = 1;
    return;
  }

  if (asJson) console.log(JSON.stringify(report, null, 2));
  else console.log(formatFunnel(report));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void main();
