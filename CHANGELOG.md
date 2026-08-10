# Changelog

All notable changes to **HD Optimizer Detective** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-08-07

### 🌟 Added
- **CleanMyMac v5 Liquid Glass Design System**: Deep obsidian darkmode (`#05070c`), frosted glass containers (`backdrop-filter: blur(20px)`), hairline metallic borders, and SVG vector iconography.
- **System Protection Shield (`is_safe_file_path`)**: Absolute path validation preventing deletion of OS folders (`/System`, `/usr`, `/bin`, `/etc`, `/Applications`, `~/.ssh`).
- **Big File Radar**: Dedicated large & old files scanner with size filters (>100MB, >500MB, >1GB, >5GB) and age filters (>30d, >90d, >365d).
- **Move to Trash Safe Mode**: Support for moving flagged items to `~/.Trash/` instead of unrecoverable unlinking.
- **Interactive Treemap Category Inspector**: Modal drill-down for storage treemap blocks.
- **JSON & CSV Audit Exporters**: Top header bar triggers to export scan reports.
- **Expanded Developer Strategies**: Xcode DerivedData, Cargo registry caches, Pip wheel caches, and Homebrew formula.
- **Localhost Security Lockdown**: Bound server strictly to `127.0.0.1` and hardened CORS origin checks.

---

## [1.0.0] - 2026-07-31

### 🚀 Initial Release
- Basic 2-pass SHA-256 duplicate detection.
- Simple Python HTTP backend.
- Storage treemap layout.
