# Task Plan: HD Optimizer Detective v2 Enhancements & Integrity Verification

## Goal Statement
Enhance HD Optimizer Detective v2 UI and backend drill-down features according to user specifications without breaking any existing functionality, verifying zero regressions across all core features (Scan, Duplicate Locker, Treemap, Category Inspector, Terminal Script Generation, and System Protection Shield).

## Architecture & Requirements Baseline
- **Tech Stack:** Vanilla JS + CSS3 HTML5 frontend (`app.js`, `styles.css`, `index.html`), zero-dependency multi-threaded Python 3 backend (`scanner_backend.py`).
- **Core Requirements:**
  1. Semi-transparent dark mode glow borders across all treemap categories (`rgba(R, G, B, 0.35)`).
  2. Enhanced Category Inspector modal drill-down supporting all 7 categories with real/scanned file aggregation and interactive `⚡ Flag` buttons.
  3. Strict zero-regression guarantee across existing scan, duplicate selection, script export, and HTTP APIs.

## Phases & Tasks

### Phase 1: Planning & Baseline Verification
- [x] Create persistent planning files (`task_plan.md`, `findings.md`, `progress.md`).
- [x] Audit current codebase structure and active endpoints (`/api/health`, `/api/scan`, `/api/drives`, `/api/system_hud`).

### Phase 2: Feature & UX Implementation Verification
- [x] Validate semi-transparent glowing borders styling in `app.js` and `styles.css`.
- [x] Validate Category Inspector file aggregator in `app.js` and table header in `index.html`.
- [x] Ensure hover effects and flag action handlers are fully functional without JS syntax errors.

### Phase 3: Comprehensive Regression & Integration Testing
- [x] Verify backend HTTP server compilation (`python3 -m py_compile scanner_backend.py`).
- [x] Verify API endpoints return valid JSON response formats.
- [x] Verify frontend script generation (`clean_junk.sh`) produces valid bash syntax.

### Phase 4: Final Reporting & Closure
- [x] Summarize plan execution in `progress.md` and `findings.md`.
- [x] Report completion back to user with clickable file references.

### Phase 5: UI/UX Visual Polish (Soft Glows, Gradients & Micro-Animations)
- [x] Add subtle linear gradients and top-highlight strokes to Bento tiles and cards.
- [x] Add soft ambient glow effects to buttons, dial gauges, and status chips.
- [x] Add micro-animations (active press scale, hover sheen pass, soft breathing pulse on indicators).
- [x] Fixed grid span regression (.bento-span-8, .bento-span-4, etc.) to restore 12-column Bento layout.
- [x] Verified visual layout via live browser subagent screenshot.

### Phase 6: Mouseleave Motion Calibration
- [x] Remove reverse sheen sweep on mouseleave (`transition: none` on exit).
- [x] Remove trailing `transform` ease-back shift on treemap/bento cards on cursor leave.
- [x] Verify instant crisp exit feedback in browser.

### Phase 7: Apple-Style Interactive Storage Bar Component
- [x] Build multi-segmented Apple Storage Bar component with 2026 dark glass visual styling.
- [x] Add color-coded legend tags with live size calculation (Dev, AI Models, Media, PyCache, VMs, Archives, System).
- [x] Implement `filterByStorageCategory()` click handler to filter view & trigger Category Inspector drill-down.
- [x] Add `✕ Clear Filter` state to restore unfiltered treemap dashboard view.
- [x] Verify interactivity and layout in browser.

### Phase 8: Pure Real Disk Data Integrity (Purge Fake Mock Fallbacks)
- [x] Remove hardcoded mock path fallback arrays (`Windows11_23H2_x64.iso`, `Ubuntu_24.04_LTS.vmdk`) from `app.js`.
- [x] Update `scanner_backend.py` to aggregate real file sizes and `scannedItems` array across all categories.
- [x] Update `openCategoryInspector()` to query strictly real disk audit items or render clean empty state.
- [x] Verify backend compilation and API health.

### Phase 9: Blazing-Fast APFS Spotlight & Parallel Multi-Threaded Indexing Engine
- [x] Implement Engine A: APFS Native Spotlight (`mdfind`) B-Tree Indexer for 0.05s instant querying on macOS.
- [x] Implement Engine B: Multi-Threaded Parallel `os.scandir` Worker Pool (`ThreadPoolExecutor(max_workers=16)`).
- [x] Implement Live File Verification & True Byte Audit (verifying file size & `os.path.exists()` before returning).
- [x] Verify execution speed and 100% data truthfulness.

### Phase 10: Express Reclaim Deletion Audit Data Sync
- [x] Auto-flag duplicate copies and active strategies when opening `Deletion Audit Preview` modal from `Reclaimable Space` tile.
- [x] Sync total reclaimable capacity label in modal (e.g. `40.55 GB`) with individual breakdown rows.
- [x] Support 1-click execution of both duplicate copy deletion and tactical junk strategy commands.
- [x] Verify modal data sync in browser.

### Phase 11: Dynamic Path-Connected Apple Storage Bar (Premium Space Saver Engine)
- [x] Connect Storage Bar title & capacity header to current selected drive/path (`scanPathInput.value`).
- [x] Implement `renderAppleStorageBar(data, targetPath)` in `app.js` to compute dynamic proportional segment widths.
- [x] Dynamically update legend chips (`.legend-chip`) with exact real byte counts (`formatBytes`).
- [x] Hide/mute 0-byte categories in the current path so the bar represents 100% true active clutter.
- [x] Verify dynamic bar re-rendering across path selection in browser.

### Phase 12: Comprehensive macOS Storage Bar Engine (Zero Empty State)
- [x] Integrate `shutil.disk_usage(root_dir)` in `scanner_backend.py` to retrieve total, used, and free disk bytes.
- [x] Catch all scanned files under robust categories (Dev, AI Models, Media, VMs, Archives, Apps & System Data, Free Space).
- [x] Render real multi-colored storage bar matching native macOS System Settings across all drives (~, /, custom).
- [x] Verify bar rendering in browser.

### Phase 13: Modal Layout & Horizontal Scroll Elimination
- [x] Expand `.modal-card` width from `780px` to `1050px` (`max-width: 1050px; width: 92vw;`).
- [x] Set `table-layout: fixed; width: 100%;` on modal tables with explicit column width allocations.
- [x] Set `word-break: break-all;` on path columns to wrap long file paths cleanly without horizontal scrollbars.
- [x] Verify zero horizontal scrollbars across Category Inspector and Deletion Audit modals.

### Phase 14: The Digital Archaeologist & 20-Signal Safety Engine
- [x] Build 20-Signal Confidence Weighting Engine in `scanner_backend.py` (0–100% confidence score + "Explain WHY" reasons array).
- [x] Group scanned disk clutter into Narrative Cleanup Stories (AI Workspace Debris, Installation Relics, Project Graveyard, Forgotten Downloads, Version Graveyard, Forgotten Relics).
- [x] Add `tabArchaeologist` ("Digital Archaeologist") view to `index.html` with liquid glass Story Cards and 3-Action Safety Buttons (Delete 🟢 | Compress 🟡 | Archive 🔵).
- [x] Add Story Inspector Modal (`modalStoryInspector`) displaying item confidence scores and "Future Probability" metrics.
- [x] Verify Digital Archaeologist functionality and UI in browser.

### Phase 15: Error Isolation & Defensive Null-Safe Rendering (Fix Misleading Toast Bug)
- [x] Separate API fetch error handling from UI rendering error handling in `runRealSystemDriveScan()`.
- [x] Wrap all array iterations (`duplicates`, `strategies`, `treemapNodes`, `scannedItems`, `archaeologistStories`) in defensive `Array.isArray()` checks.
- [x] Log exact UI stack trace to console when rendering exceptions occur instead of masking as "Backend connection offline".
- [x] Verify error isolation and clean scan handling in browser.

### Phase 27: ZeroSpace Rebranding & Open-Source Git Repository
- [x] Initialize Git repository in project root with clean commit history.
- [x] Rebrand UI branding in `index.html` to **ZeroSpace — Intelligent macOS APFS Engine**.
- [x] Update `scanner_backend.py`, `app.js`, `test_suite.py`, `launch.sh`, and `pyproject.toml` with **ZeroSpace** name.
- [x] Update `README.md`, `ARCHITECTURE.md`, `LICENSE` (MIT), and `SECURITY.md` for ZeroSpace.
- [x] Execute `test_suite.py` and commit 100% passing codebase to Git.

## Key Decisions & Constraints
- **Zero External Dependencies:** Keep Python backend and JS frontend free of external library bloat.
- **Backward Compatibility:** Preserve existing API contracts (`/api/scan`, `/api/execute`, `/api/drives`, `/api/system_hud`).
