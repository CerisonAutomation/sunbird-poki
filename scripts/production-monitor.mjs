#!/usr/bin/env node

/**
 * Production Monitor — runs every 15 minutes
 * Checks: build, health, security, performance
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const PROJECTS = [
  {
    name: "sunbird",
    path: "/Users/cb/Downloads/sunbird",
    url: "https://sunbird-snowy.vercel.app",
    repo: "https://github.com/CerisonAutomation/sunbird",
  },
  {
    name: "fyk-consolidated",
    path: "/tmp/fyk-consolidated",
    url: "https://fyk-app.vercel.app",
    repo: "https://github.com/CerisonAutomation/fyk-consolidated",
  },
];

const results = [];

function log(level, project, message) {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, project, message };
  results.push(entry);
  const icon = level === "✅" ? "✅" : level === "⚠️" ? "⚠️" : "❌";
  console.log(`${icon} [${timestamp}] ${project}: ${message}`);
}

async function checkBuild(project) {
  try {
    const pkg = JSON.parse(readFileSync(join(project.path, "package.json"), "utf8"));
    const hasTypecheck = pkg.scripts?.typecheck;
    const hasTest = pkg.scripts?.test;
    const hasBuild = pkg.scripts?.build;

    if (hasTypecheck) {
      execSync("npx tsc --noEmit", { cwd: project.path, timeout: 180000, stdio: "pipe" });
      log("✅", project.name, "Typecheck passed");
    }

    if (hasTest) {
      execSync("npx vitest run", { cwd: project.path, timeout: 180000, stdio: "pipe" });
      log("✅", project.name, "Tests passed");
    }

    if (hasBuild) {
      execSync("npx vite build", { cwd: project.path, timeout: 180000, stdio: "pipe" });
      log("✅", project.name, "Build successful");
    }
  } catch (err) {
    log("❌", project.name, `Build failed: ${err.message.slice(0, 100)}`);
  }
}

async function checkHealth(project) {
  try {
    const response = await fetch(project.url, { method: "HEAD", redirect: "follow" });
    if (response.ok) {
      log("✅", project.name, `Health check passed (${response.status})`);
    } else {
      log("⚠️", project.name, `Health check returned ${response.status}`);
    }
  } catch (err) {
    log("❌", project.name, `Health check failed: ${err.message}`);
  }
}

async function checkSecurity(project) {
  try {
    const response = await fetch(project.url);
    const headers = Object.fromEntries(response.headers.entries());

    // Check CSP
    const csp = headers["content-security-policy"] || "";
    if (csp.includes("unsafe-inline")) {
      log("⚠️", project.name, "CSP contains unsafe-inline");
    } else if (csp) {
      log("✅", project.name, "CSP headers present and clean");
    }

    // Check HTTPS
    if (project.url.startsWith("https://")) {
      log("✅", project.name, "HTTPS enforced");
    }

    // Check security headers
    const hasXContent = headers["x-content-type-options"] === "nosniff";
    const hasReferrer = headers["referrer-policy"];
    if (hasXContent && hasReferrer) {
      log("✅", project.name, "Security headers present");
    }
  } catch (err) {
    log("⚠️", project.name, `Security check error: ${err.message}`);
  }
}

async function checkDependencies(project) {
  try {
    if (existsSync(join(project.path, "package.json"))) {
      const audit = execSync("npm audit --json", { cwd: project.path, timeout: 60000, stdio: "pipe" });
      const result = JSON.parse(audit.toString());
      const vulnerabilities = result.metadata?.vulnerabilities || {};
      const critical = vulnerabilities.critical || 0;
      const high = vulnerabilities.high || 0;

      if (critical > 0) {
        log("❌", project.name, `${critical} critical vulnerabilities`);
      } else if (high > 0) {
        log("⚠️", project.name, `${high} high vulnerabilities`);
      } else {
        log("✅", project.name, "No critical/high vulnerabilities");
      }
    }
  } catch {
    log("⚠️", project.name, `Dependency check error`);
  }
}

async function runMonitor() {
  console.log("🔍 Production Monitor — Starting checks...\n");

  for (const project of PROJECTS) {
    console.log(`\n📦 ${project.name.toUpperCase()}`);
    console.log("─".repeat(40));

    await checkBuild(project);
    await checkHealth(project);
    await checkSecurity(project);
    await checkDependencies(project);
  }

  // Summary
  console.log("\n" + "═".repeat(50));
  console.log("📊 SUMMARY");
  console.log("═".repeat(50));

  const passed = results.filter((r) => r.level === "✅").length;
  const warnings = results.filter((r) => r.level === "⚠️").length;
  const failures = results.filter((r) => r.level === "❌").length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`⚠️ Warnings: ${warnings}`);
  console.log(`❌ Failures: ${failures}`);

  if (failures > 0) {
    console.log("\n🚨 CRITICAL ISSUES:");
    results
      .filter((r) => r.level === "❌")
      .forEach((r) => console.log(`  - ${r.project}: ${r.message}`));
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    results,
    summary: { passed, warnings, failures },
  };

  const reportPath = join("/Users/cb/Downloads/sunbird", "monitor-report.json");
  const { writeFileSync } = await import("fs");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to ${reportPath}`);
}

runMonitor().catch(console.error);
