# Watertight Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform ZeroSpace v2.0 from an inconsistent prototype into a watertight, secure, and fully functional developer tool by eliminating XSS/injection vulnerabilities, synchronizing backend-frontend execution contracts, implementing real story and category review actions, and establishing automated test coverage.

**Architecture:** 
- Secure the frontend by removing raw `innerHTML` interpolations of filesystem metadata and replacing them with safe DOM builders and entity escaping.
- Realign the execution contract between `app.js` and `scanner_backend.py` so strategy purges and story candidate reviews execute real, safe filesystem operations (moving to `~/.Trash`) with transparent rejection reporting.
- Clean up dead code, add cancellation checks to cryptographic hashing loops, and restructure tests into standard `unittest` test cases runnable in CI without manual daemons.

**Tech Stack:** Native Python 3 (`http.server`, `sqlite3`, `hashlib`, `unittest`), Vanilla ES6 JavaScript, Playwright.

---

### Task 1: Automated Unit Test Harness & Test Runner

**Files:**
- Create: `tests/test_engine_unit.py`
- Modify: `scanner_backend.py`
- Test: `tests/test_engine_unit.py`

**Step 1: Write failing unit tests for core backend functions**
Create standard `unittest.TestCase` tests covering:
- `is_safe_file_path` and `is_safe_scan_path`
- `calculate_file_confidence_score`
- `unique_destination`
- `format_bytes_py`
- Hash cancellation check in `get_file_sha256`

```python
import unittest
import tempfile
import os
import shutil
from scanner_backend import (
    is_safe_file_path, is_safe_scan_path,
    calculate_file_confidence_score, format_bytes_py,
    unique_destination, get_file_sha256
)

class TestZeroSpaceEngineUnit(unittest.TestCase):
    def test_safe_file_path_blocks_system_roots(self):
        safe, msg = is_safe_file_path("/System/Library")
        self.assertFalse(safe)
        self.assertIn("locked", msg.lower())

    def test_safe_file_path_allows_workspace(self):
        with tempfile.TemporaryDirectory() as tmp:
            test_file = os.path.join(tmp, "artifact.zip")
            with open(test_file, "w") as f:
                f.write("data")
            safe, _ = is_safe_file_path(test_file)
            self.assertTrue(safe)

    def test_unique_destination_avoids_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            p1 = os.path.join(tmp, "item.txt")
            with open(p1, "w") as f: f.write("1")
            dest = unique_destination(tmp, "item.txt")
            self.assertNotEqual(p1, dest)
            self.assertTrue(dest.endswith("item (1).txt"))
```

**Step 2: Run test to verify it executes**
Run: `python3 -m unittest tests/test_engine_unit.py -v`
Expected: Passes basic tests, fails on hash cancellation test if included.

**Step 3: Add hash cancellation check to `get_file_sha256`**
In `scanner_backend.py`:
```python
def get_file_sha256(filepath, scan_id=None):
    try:
        hasher = hashlib.sha256()
        with open(filepath, 'rb') as f:
            while chunk := f.read(1024 * 1024):
                if scan_id and scan_is_cancelled(scan_id):
                    return None
                hasher.update(chunk)
        return hasher.hexdigest()
    except Exception:
        return None
```

**Step 4: Run tests to verify pass**
Run: `python3 -m unittest tests/test_engine_unit.py -v`
Expected: ALL PASS.

**Step 5: Commit**
```bash
git add tests/test_engine_unit.py scanner_backend.py
git commit -m "test: add standalone engine unit tests and hash cancellation check"
```

---

### Task 2: Fix DOM XSS & Escaping in `app.js`

**Files:**
- Modify: `app.js:1000-1900`
- Test: `tests/browser/zerospace.spec.js`

**Step 1: Implement universal HTML entity escaping & DOM sanitization helper**
In `app.js`:
```javascript
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

**Step 2: Replace raw innerHTML interpolations with escaped content**
Update all instances where filesystem paths, file names, and category names are rendered:
1. `duplicatesListContainer.innerHTML` (`escapeHtml(group.name)`, `escapeHtml(file.path)`)
2. `topHogsTableBody.innerHTML` (`escapeHtml(hog.path)`, `escapeHtml(hog.type)`, `escapeHtml(hog.category)`)
3. `previewTableBody.innerHTML` (`escapeHtml(f.path)`, `escapeHtml(strat.name)`)
4. `modalCategoryTableBody.innerHTML` (`escapeHtml(item.path)`, `escapeHtml(item.name)`)
5. `storyModalTableBody.innerHTML` (`escapeHtml(item.path)`, `escapeHtml(item.name)`)
6. Remove inline `onclick="revealInFinder('${pathEscaped}')"` in favor of `data-path` attributes and event delegation.

**Step 3: Write Playwright test checking XSS resilience**
In `tests/browser/zerospace.spec.js`, add a test case where a fixture file is created with an XSS name:
`<img src=x onerror=window.__xss_detected=true>.dat`
Verify `window.__xss_detected` is undefined after scan.

**Step 4: Run browser tests**
Run: `npm run test:browser` (with server running)
Expected: PASS with zero console errors or XSS execution.

**Step 5: Commit**
```bash
git add app.js tests/browser/zerospace.spec.js
git commit -m "fix(security): sanitize filesystem metadata to prevent DOM XSS"
```

---

### Task 3: Secure & Safe Shell Script Generation (`clean_junk.sh`)

**Files:**
- Modify: `app.js:1278-1304`
- Modify: `tests/test_engine_unit.py`

**Step 1: Write test for script generation escaping**
In `tests/test_engine_unit.py`:
Test that bash script generator escapes paths with spaces, single quotes, double quotes, and shell substitutions.

**Step 2: Update `generateScriptContent` in `app.js`**
- Replace dangerous `rm -f "${f.path}"` with safe move-to-trash:
```javascript
function shellEscape(str) {
  return "'" + String(str).replace(/'/g, "'\\''") + "'";
}

function generateScriptContent() {
  let lines = [
    "#!/usr/bin/env bash",
    "# ZeroSpace v2.0 - Verified Clutter Cleanup Script",
    "# Safety: Moves reviewed files to ~/.Trash instead of permanent deletion",
    "set -e",
    "TRASH_DIR=\"$HOME/.Trash\"",
    "mkdir -p \"$TRASH_DIR\"",
    ""
  ];

  (caseData.duplicates || []).forEach(g => {
    (g.files || []).forEach(f => {
      if (f.selected) {
        lines.push(`mv -n ${shellEscape(f.path)} \"$TRASH_DIR/\"`);
      }
    });
  });

  (caseData.strategies || []).forEach(s => {
    if (s.enabled && s.targetDir) {
      lines.push(`# Strategy: ${s.name}`);
      lines.push(`find ${shellEscape(s.targetDir)} -mindepth 1 -delete`);
    }
  });

  return lines.join("\n");
}
```

**Step 3: Verify output script syntax**
Generate a script with edge-case paths and verify `bash -n` syntax check passes:
`bash -n /tmp/generated_script.sh`

**Step 4: Commit**
```bash
git add app.js
git commit -m "fix(script): safe bash path escaping and Trash preservation in script export"
```

---

### Task 4: Fix Execution Engine Contract & Rejection Visibility

**Files:**
- Modify: `scanner_backend.py:554-735`
- Modify: `app.js:430-472`
- Test: `test_edge_cases.py`

**Step 1: Harmonize Strategy Payload**
In `scanner_backend.py`:
- Allow safe workspace strategy purges without requiring manual environment variables for local workspace strategies (e.g. purging `node_modules`, `__pycache__`, `.DS_Store` within the audited workspace root).
- Ensure backend accepts `{ action: 'strategy', targetDir: '...' }` safely.

In `app.js:executeCleanup`:
- Send `targetDir` instead of `command`:
```javascript
(caseData.strategies || []).forEach(s => {
  if (s.enabled && s.targetDir) {
    items.push({ targetDir: s.targetDir, action: 'strategy', name: s.name });
  }
});
```

**Step 2: Transparent UI Reporting for Rejections**
In `app.js:executeCleanup`:
- Inspect `result.log`. Count `BLOCKED` and `REJECTED` items.
- If rejections occurred, display warning toasts and log details to console, instead of a misleading 100% success toast:
```javascript
const rejections = (result.log || []).filter(l => l.startsWith('BLOCKED:') || l.startsWith('REJECTED:'));
if (rejections.length > 0) {
  showToast(`${rejections.length} items were blocked by safety shield. Check console for details.`, 'warning');
}
```

**Step 3: Test via `test_edge_cases.py`**
Verify that strategy requests with `targetDir` in workspace execute cleanly, while dangerous paths remain blocked.

**Step 4: Commit**
```bash
git add scanner_backend.py app.js test_edge_cases.py
git commit -m "fix(execution): synchronize strategy payload and report rejections accurately"
```

---

### Task 5: Wire Digital Archaeologist Story Inspector to Execution

**Files:**
- Modify: `app.js:1820-1925`
- Modify: `index.html:728-775`
- Test: `tests/browser/zerospace.spec.js`

**Step 1: Wire Action Selection and State Persistence**
In `app.js`:
- Store active item actions on story items (`item.selected = true/false`, `item.action = 'trash' | 'compress' | 'archive'`).
- In `selectStoryItemAction(path, action, chipId, idx)`, update the item in `caseData.archaeologistStories`.

**Step 2: Connect Modal "Execute Reclaim" Button**
In `app.js`:
- Implement `executeStoryReclaim(storyId)`: collects only the selected/active items of that specific story and posts them to `/api/execute`.
- Update `index.html` `btnStoryExecute` to call `executeStoryReclaim()`.

**Step 3: Implement Real Item Flagging in Category Inspector**
In `app.js`:
- Replace dummy `flagInspectorItem(path)` with actual state tracking:
```javascript
if (!caseData.flaggedItems) caseData.flaggedItems = new Set();
if (caseData.flaggedItems.has(path)) {
  caseData.flaggedItems.delete(path);
  showToast(`Removed from review: ${path}`, 'info');
} else {
  caseData.flaggedItems.add(path);
  showToast(`Flagged for review: ${path}`, 'success');
}
recalculateStats();
```
- Include flagged items in the Express Reclaim Preview.

**Step 4: Verify in Browser via Playwright**
Test: Open story inspector -> toggle item action -> execute reclaim -> verify request dispatched to `/api/execute`.

**Step 5: Commit**
```bash
git add app.js index.html tests/browser/zerospace.spec.js
git commit -m "feat: wire Story Inspector and Category Inspector to live execution state"
```

---

### Task 6: Purge Dead Code & Align Documentation

**Files:**
- Modify: `scanner_backend.py:1136-1153`
- Modify: `task_plan.md`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`

**Step 1: Clean up `scanner_backend.py`**
- Remove uninvoked dead function `query_apfs_spotlight_indexed_files`.
- Clarify documentation around `calculate_file_confidence_score` (it is a 10-heuristic ranking rule-set, not a 20-signal AI model).

**Step 2: Update documentation**
- Correct `task_plan.md` to accurately reflect the actual SQLite-backed 2-pass indexing engine.
- Update `ARCHITECTURE.md` and `README.md` with true system descriptions and zero phantom claims.

**Step 3: Verification**
Run:
- `python3 -m py_compile scanner_backend.py`
- `node --check app.js`
- `python3 -m unittest tests/test_engine_unit.py -v`
- `python3 test_cli.py`

**Step 4: Commit**
```bash
git add scanner_backend.py task_plan.md README.md ARCHITECTURE.md
git commit -m "docs(arch): eliminate phantom architecture claims and purge dead spotlight code"
```

---

### Task 7: Full End-to-End Regression & Watertight Verification Loop

**Files:**
- Run: All test suites and Playwright browser tests.

**Step 1: Execute Python Unit & CLI suites**
Run: `python3 -m unittest tests/test_engine_unit.py`
Run: `python3 test_cli.py`
Run: `python3 test_edge_cases.py`

**Step 2: Execute Browser Test Suite**
Run: `npx playwright test`

**Step 3: Verify Zero Regressions**
Confirm all tests exit code `0`.
Confirm clean console logs with zero unhandled exceptions.
