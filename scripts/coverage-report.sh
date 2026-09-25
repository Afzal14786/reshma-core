#!/usr/bin/env bash
# ──────────────────────────────────────────────
# Aggregate Coverage Report
# ──────────────────────────────────────────────
# Runs each test suite with coverage, saves per-suite HTML reports,
# then prints an aggregated summary table.
#
# Usage:
#   chmod +x scripts/coverage-report.sh
#   ./scripts/coverage-report.sh               # all suites
#   ./scripts/coverage-report.sh unit security # specific suites
# ──────────────────────────────────────────────

set -uo pipefail

SUITES=("$@")
if [ ${#SUITES[@]} -eq 0 ]; then
  SUITES=(unit integration security e2e workers)
fi

COMPOSE_FILE="docker/test/docker-compose.test.yml"
REPORT_DIR="coverage/aggregate"
mkdir -p "$REPORT_DIR"

# Service name per suite — unit uses test-runner, others use test-<suite>
service_name() {
  case "$1" in
    unit) echo "test-runner" ;;
    *)    echo "test-$1" ;;
  esac
}

print_header() {
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "  $1"
  echo "════════════════════════════════════════════════════════════════"
}

for suite in "${SUITES[@]}"; do
  print_header "Running $suite suite with coverage..."

  # Clean up everything html-related from prior runs
  rm -f coverage/coverage-summary.json 2>/dev/null || true
  rm -rf coverage/lcov-report 2>/dev/null || true

  # Run Jest — using --coverage only, letting the base config's
  # coverageReporters array produce html + text-summary + json-summary
  docker compose -f "$COMPOSE_FILE" --profile "$suite" run --rm \
    "$(service_name "$suite")" \
    npx jest --config "jest.config.${suite}.ts" \
    --coverage \
    --runInBand || true

  if [ -f "coverage/coverage-summary.json" ]; then
    cp "coverage/coverage-summary.json" "$REPORT_DIR/${suite}-summary.json"
  fi

  # Persist the HTML report before the next suite overwrites it
  if [ -d "coverage/lcov-report" ]; then
    mkdir -p "coverage/html/${suite}"
    cp -r coverage/lcov-report/. "coverage/html/${suite}/"
  fi
done

print_header "Aggregate Coverage Report"

node - "$REPORT_DIR" "${SUITES[@]}" <<'NODE'
const fs = require("fs");
const path = require("path");

const reportDir = process.argv[2];
const suites = process.argv.slice(3);

const rows = [];
let count = 0;
const totals = { statements: 0, branches: 0, functions: 0, lines: 0 };

for (const suite of suites) {
  const file = path.join(reportDir, `${suite}-summary.json`);
  if (!fs.existsSync(file)) continue;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const t = data.total;
  rows.push({
    suite,
    statements: t.statements.pct,
    branches: t.branches.pct,
    functions: t.functions.pct,
    lines: t.lines.pct,
  });
  totals.statements += t.statements.pct;
  totals.branches += t.branches.pct;
  totals.functions += t.functions.pct;
  totals.lines += t.lines.pct;
  count++;
}

function color(pct) {
  if (pct >= 80) return "\x1b[32m";
  if (pct >= 60) return "\x1b[33m";
  return "\x1b[31m";
}
const RESET = "\x1b[0m";
function bar(pct) {
  const w = 22;
  const filled = Math.round((pct / 100) * w);
  return "█".repeat(filled) + "░".repeat(w - filled);
}
const pad = (s, w) => String(s).padEnd(w).slice(0, w);
const padr = (s, w) => String(s).padStart(w);

console.log("");
console.log(
  pad("Suite", 14) +
    padr("Stmts %", 10) + padr("Branch %", 10) +
    padr("Funcs %", 10) + padr("Lines %", 10) + "  Visual"
);
console.log("─".repeat(86));

for (const r of rows) {
  console.log(
    pad(r.suite, 14) +
      padr(color(r.statements) + r.statements.toFixed(1) + RESET, 18) +
      padr(color(r.branches) + r.branches.toFixed(1) + RESET, 18) +
      padr(color(r.functions) + r.functions.toFixed(1) + RESET, 18) +
      padr(color(r.lines) + r.lines.toFixed(1) + RESET, 18) +
      "  " + color(r.lines) + bar(r.lines) + RESET
  );
}
console.log("─".repeat(86));

if (count > 0) {
  const avg = {
    statements: totals.statements / count,
    branches: totals.branches / count,
    functions: totals.functions / count,
    lines: totals.lines / count,
  };
  console.log(
    pad("AVERAGE", 14) +
      padr(color(avg.statements) + avg.statements.toFixed(1) + RESET, 18) +
      padr(color(avg.branches) + avg.branches.toFixed(1) + RESET, 18) +
      padr(color(avg.functions) + avg.functions.toFixed(1) + RESET, 18) +
      padr(color(avg.lines) + avg.lines.toFixed(1) + RESET, 18) +
      "  " + color(avg.lines) + bar(avg.lines) + RESET
  );
}

console.log("");
console.log("Legend: \x1b[32m█ ≥ 80%\x1b[0m  \x1b[33m█ 60–80%\x1b[0m  \x1b[31m█ < 60%\x1b[0m");
console.log("");
console.log(`📊 Per-suite HTML reports saved to: coverage/html/`);
console.log(`   Open: coverage/html/unit/index.html`);
console.log(`         coverage/html/integration/index.html`);
console.log("");
NODE