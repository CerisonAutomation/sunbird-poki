#!/usr/bin/env node
/**
 * Poki compliance audit — executes the extracted guide.
 *
 * The corpus in `docs/poki/` turns the platform's pages into numbered rules;
 * `docs/poki/requirements.json` attaches a verification method to each one.
 * This script runs them and writes `docs/poki/COMPLIANCE.md`.
 *
 *   node scripts/poki-audit.mjs            # verify + rewrite the report
 *   node scripts/poki-audit.mjs --json     # machine-readable result on stdout
 *   node scripts/poki-audit.mjs --run      # also EXECUTE command checks (builds zips, PNG gates)
 *
 * Exit code is non-zero when any rule that claims to be satisfied fails. Rules
 * that are `action` (a human/submission step), `deferred` (documented and
 * accepted) or `informational` are reported, never hidden: the point of the
 * corpus is that "not yet done" is visible, not that it passes.
 *
 * `command` checks are policy-only by default: they assert the gate exists and
 * is wired into package.json, rather than running a multi-minute build on every
 * audit. `--run` executes them (that is the pre-submission pass).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = join(root, "docs/poki");
const argv = new Set(process.argv.slice(2));
const RUN_COMMANDS = argv.has("--run");
const AS_JSON = argv.has("--json");

const KINDS = new Set(["requirement", "recommendation", "informational"]);
const STATUSES = new Set(["satisfied", "action", "deferred", "informational"]);

const requirements = JSON.parse(readFileSync(join(CORPUS, "requirements.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const scripts = pkg.scripts ?? {};

const WIRED_COMMANDS = new Set(
  Object.values(scripts)
    .flatMap((cmd) => cmd.split(/&&|\|\||;/))
    .map((part) => part.trim())
    .filter(Boolean),
);

/* --------------------------------------------------------------- checks */

function read(rel) {
  const path = join(root, rel);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function checkFile(verify) {
  return existsSync(join(root, verify.path))
    ? { ok: true, detail: verify.path }
    : { ok: false, detail: `missing file ${verify.path}` };
}

function checkGrep(verify, absent = false) {
  const text = read(verify.path);
  if (text === null) return { ok: false, detail: `missing file ${verify.path}` };
  const found = new RegExp(verify.pattern, "m").test(text);
  if (absent) {
    return found
      ? { ok: false, detail: `${verify.path} still matches /${verify.pattern}/` }
      : { ok: true, detail: `${verify.path} has no /${verify.pattern}/` };
  }
  return found
    ? { ok: true, detail: `${verify.path} matches /${verify.pattern}/` }
    : { ok: false, detail: `${verify.path} does not match /${verify.pattern}/` };
}

function checkTest(verify) {
  const missing = existsSync(join(root, verify.path)) ? null : `missing ${verify.path}`;
  if (missing) return { ok: false, detail: missing };
  if (verify.pattern) {
    const text = read(verify.path);
    if (!new RegExp(verify.pattern, "m").test(text ?? "")) {
      return { ok: false, detail: `${verify.path} has no case matching /${verify.pattern}/` };
    }
  }
  return { ok: true, detail: verify.pattern ? `${verify.path} (pinned: /${verify.pattern}/)` : verify.path };
}

function checkBarrel(verify) {
  const barrel = JSON.parse(readFileSync(join(root, "src/i18n/translations.barrel.json"), "utf8"));
  const entries = Object.values(barrel.barrel ?? {});
  if (!entries.length) return { ok: false, detail: "translation barrel is empty" };
  const gaps = [];
  // The runtime intentionally keeps the compact legacy pack names (`pt` and
  // `zh`) while the player-facing selector uses canonical BCP-47 names.
  // Treat those aliases as the same shipped locale for Poki coverage.
  const sourceLocale = { "pt-BR": "pt", "zh-CN": "zh" };
  for (const locale of verify.locales) {
    const covered = entries.filter((entry) => {
      const value = entry.translations?.[locale] ?? entry.translations?.[sourceLocale[locale]];
      return typeof value === "string" && value.trim().length > 0;
    }).length;
    if (covered !== entries.length) gaps.push(`${locale} ${covered}/${entries.length}`);
  }
  return gaps.length
    ? { ok: false, detail: `incomplete locales: ${gaps.join(", ")}` }
    : { ok: true, detail: `${verify.locales.length} locales × ${entries.length} strings complete` };
}

function checkCommand(verify) {
  const scriptFile = verify.cmd.match(/node\s+(scripts\/[\w.-]+)/)?.[1];
  const wiredToPkg = WIRED_COMMANDS.has(verify.cmd);
  if (scriptFile && !existsSync(join(root, scriptFile))) {
    return { ok: false, detail: `gate script ${scriptFile} is missing` };
  }
  if (!scriptFile && !wiredToPkg) {
    return { ok: false, detail: `"${verify.cmd}" is not a repo script` };
  }
  const requires = (verify.requires ?? []).filter((file) => !existsSync(join(root, file)));
  if (!RUN_COMMANDS) {
    const note = requires.length ? ` (needs ${requires.join(", ")} — run with --run after build:portals)` : "";
    return { ok: true, detail: `gate wired: ${verify.cmd}${note}`, deferredRun: requires.length > 0 };
  }
  if (requires.length) {
    return { ok: false, detail: `cannot execute: ${requires.join(", ")} missing — run pnpm build:portals first` };
  }
  try {
    execFileSync(verify.cmd, { cwd: root, shell: true, stdio: "pipe" });
    return { ok: true, detail: `executed: ${verify.cmd}`, executed: true };
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim().split("\n").slice(-6).join(" / ");
    return { ok: false, detail: `"${verify.cmd}" failed: ${output}`, executed: true };
  }
}

function runVerify(rule) {
  const verify = rule.verify ?? { type: "manual" };
  switch (verify.type) {
    case "file":
      return checkFile(verify);
    case "grep":
      return checkGrep(verify);
    case "grepAbsent":
      return checkGrep(verify, true);
    case "test":
      return checkTest(verify);
    case "barrel":
      return checkBarrel(verify);
    case "command":
      return checkCommand(verify);
    case "manual":
      return { ok: true, detail: verify.note ?? "manual/attested", manual: true };
    default:
      return { ok: false, detail: `unknown verify type ${verify.type}` };
  }
}

/* ---------------------------------------------------------------- audit */

const groupById = new Map(requirements.groups.map((g) => [g.id, g]));
const problems = [];
const results = [];

for (const rule of requirements.rules) {
  const group = groupById.get(rule.group);
  if (!group) problems.push(`${rule.id}: unknown group ${rule.group}`);
  if (!rule.id.startsWith(`${rule.group}-`)) problems.push(`${rule.id}: id does not match group ${rule.group}`);
  if (!KINDS.has(rule.kind)) problems.push(`${rule.id}: unknown kind ${rule.kind}`);
  if (!STATUSES.has(rule.status)) problems.push(`${rule.id}: unknown status ${rule.status}`);

  const result = runVerify(rule);
  // A rule that claims to be satisfied and cannot be verified is a failure.
  const enforced = rule.status === "satisfied" && !result.ok;
  if (enforced) problems.push(`${rule.id}: ${result.detail}`);
  results.push({ rule, result, enforced });
}

const counts = results.reduce(
  (acc, { rule, result }) => {
    acc.total += 1;
    acc.status[rule.status] = (acc.status[rule.status] ?? 0) + 1;
    if (rule.kind === "requirement") acc.requirements += 1;
    if (rule.status === "satisfied" && result.ok) acc.verified += 1;
    if (rule.status === "action") acc.actions += 1;
    if (rule.status === "deferred") acc.deferred += 1;
    return acc;
  },
  { total: 0, requirements: 0, verified: 0, actions: 0, deferred: 0, status: {} },
);

/* --------------------------------------------------------------- report */

function mdEscape(text) {
  return text.replace(/\|/g, "\\|");
}

function renderReport() {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push("# Poki compliance report");
  lines.push("");
  lines.push(`**Generated:** ${date} by \`pnpm poki:audit\` — do not edit by hand.`);
  lines.push(
    `**Result:** ${problems.length === 0 ? "✅ every satisfied rule verified" : `❌ ${problems.length} problem(s)`} · ${counts.verified}/${counts.total} rules verified · ${counts.requirements} of them hard requirements.`,
  );
  lines.push("");
  lines.push(
    `**Scope:** the extracted guide corpus in this folder (\`requirements.json\`, version ${requirements.version}). Rules marked *action* are human/submission steps, *deferred* are accepted gaps with a recorded reason — both are listed so nothing is silently skipped.`,
  );
  lines.push("");
  lines.push("| Status | Rules |");
  lines.push("|---|---|");
  lines.push(`| satisfied | ${counts.status.satisfied ?? 0} |`);
  lines.push(`| action (submission step) | ${counts.status.action ?? 0} |`);
  lines.push(`| deferred (accepted) | ${counts.status.deferred ?? 0} |`);
  lines.push(`| informational | ${counts.status.informational ?? 0} |`);
  lines.push("");

  if (problems.length) {
    lines.push("## Problems");
    lines.push("");
    for (const problem of problems) lines.push(`- ${problem}`);
    lines.push("");
  }

  for (const group of requirements.groups) {
    const groupRules = results.filter((r) => r.rule.group === group.id);
    if (!groupRules.length) continue;
    lines.push(`## ${group.id} — ${group.title}`);
    lines.push("");
    lines.push(`*Source page: [\`${group.file}\`](./${group.file})*`);
    lines.push("");
    lines.push("| Rule | Kind | Requirement | Status | Verification |");
    lines.push("|---|---|---|---|---|");
    for (const { rule, result } of groupRules) {
      const badge =
        rule.status === "satisfied"
          ? result.ok
            ? result.executed
              ? "✅ verified (executed)"
              : result.manual
                ? "✅ attested"
                : "✅"
            : "❌"
          : rule.status === "action"
            ? "📋 action"
            : rule.status === "deferred"
              ? "⏸ deferred"
              : "ℹ️ info";
      lines.push(
        `| \`${rule.id}\` | ${rule.kind} | ${mdEscape(rule.rule)} | ${badge} | ${mdEscape(result.detail)} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Actions and accepted gaps");
  lines.push("");
  lines.push("| Rule | Status | What remains |");
  lines.push("|---|---|---|");
  for (const { rule } of results) {
    if (rule.status !== "action" && rule.status !== "deferred") continue;
    lines.push(
      `| \`${rule.id}\` | ${rule.status} | ${mdEscape(rule.verify?.note ?? rule.evidence ?? "")} |`,
    );
  }
  lines.push("");
  lines.push("## Evidence index");
  lines.push("");
  lines.push("| Rule | Evidence |");
  lines.push("|---|---|");
  for (const { rule } of results) {
    if (!rule.evidence) continue;
    lines.push(`| \`${rule.id}\` | ${mdEscape(rule.evidence)} |`);
  }
  lines.push("");
  return lines.join("\n");
}

const report = renderReport();
writeFileSync(join(CORPUS, "COMPLIANCE.md"), report);

if (AS_JSON) {
  console.log(
    JSON.stringify(
      {
        problems,
        counts,
        results: results.map(({ rule, result }) => ({
          id: rule.id,
          kind: rule.kind,
          status: rule.status,
          ok: result.ok,
          detail: result.detail,
        })),
      },
      null,
      2,
    ),
  );
} else {
  console.log(`Poki compliance audit — ${counts.verified}/${counts.total} rules verified (${counts.requirements} requirements)`);
  console.log(`  satisfied ${counts.status.satisfied ?? 0} · action ${counts.actions} · deferred ${counts.deferred} · informational ${counts.status.informational ?? 0}`);
  for (const group of requirements.groups) {
    const groupRules = results.filter((r) => r.rule.group === group.id);
    const failed = groupRules.filter((r) => r.enforced).length;
    const mark = failed ? "❌" : "✓";
    console.log(`  ${mark} ${group.id.padEnd(5)} ${group.title} — ${groupRules.length} rules`);
  }
  if (problems.length) {
    console.error(`\n❌ POKI AUDIT FAILED\n${problems.map((p) => `  • ${p}`).join("\n")}\n`);
  } else {
    console.log("\n✅ every satisfied rule verified — docs/poki/COMPLIANCE.md rewritten\n");
  }
}

process.exit(problems.length ? 1 : 0);
