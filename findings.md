# Findings & Discoveries: HD Optimizer Detective v2

## 1. UI & Visual Styling Discoveries
- **CSS Variable Mismatch Resolved:** Found that `AI Models` and `4K Video` previously lacked colored outlines due to missing CSS variables (`var(--purple)` and `var(--cyan)`). Replacing these with explicit RGB-based semi-transparent borders (`rgba(139, 92, 246, 0.35)` and `rgba(59, 130, 246, 0.35)`) and radial glow shadows solved the outline rendering across all 7 treemap categories.
- **Hover Ergonomics:** Adding subtle elevation (`translateY(-2px) scale(1.015)`) and expanding glow shadow on hover provides high visual feedback without triggering layout shifts.

## 2. Category Inspector Data Aggregation
- **Data Fallback Fallacy:** Previously, the modal filtered `topHogs` by category string, which produced "No isolated sub-files detected" if top files were <10MB.
- **Multi-Source Aggregator Solution:** Combining `topHogs`, `duplicates` by file extension, and category fallback paths for the active workspace ensures every category box always displays rich, detailed file inspection data with interactive `⚡ Flag` buttons.

## 3. Backend & API Health Findings
- **Backend Architecture:** `scanner_backend.py` runs a zero-dependency `ThreadingHTTPServer` on port `8080`.
- **Health Verification:** `/api/health` returns `{"status": "ok", "mode": "real_system_backend"}`.
- **Protection Shield Integrity:** `PROTECTED_SYSTEM_PATHS` guardrails remain fully active to block unsafe system directory deletions.
