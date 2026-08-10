#!/usr/bin/env bash
# Run from an agent or pre-PR hook to produce a local, machine-readable report.
set -euo pipefail

ROOT="${1:-.}"
REPORT="${2:-zerospace-report.json}"

hd-detective scan "$ROOT" --json > "$REPORT"
echo "ZeroSpace report written to $REPORT"
python3 - "$REPORT" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as report_file:
    report = json.load(report_file)
summary = report['summary']
print(f"Files indexed: {summary['totalFiles']:,}")
print(f"Review stories: {summary['reviewStories']:,}")
print(f"Duplicate groups: {summary['duplicateGroups']:,}")
print(f"Findings: {summary['findingCount']:,}")
PY
echo "Use jq '.findings[:10]' $REPORT to inspect the highest-signal findings when jq is available."
