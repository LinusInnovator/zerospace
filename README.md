<div align="center">

# ⚡ ZeroSpace v2.0
### *A local storage detective for agent-heavy development*

[![License: MIT](https://img.shields.io/badge/License-MIT-00f2fe.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Python: 3.9+](https://img.shields.io/badge/Python-3.9%2B-38ef7d.svg?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Backend Dependencies](https://img.shields.io/badge/Backend-Python%20stdlib-ff007f.svg?style=for-the-badge)](#architecture)
[![macOS Protected](https://img.shields.io/badge/System%20Shield-Protected-00f2fe.svg?style=for-the-badge&logo=apple&logoColor=white)](https://apple.com)

Coding agents make experiments cheap: parallel worktrees, cloned projects, repeated dependencies, build output, model files, and forgotten prototypes accumulate quickly. **ZeroSpace** inspects a chosen storage scope, surfaces general clutter, verifies exact duplicates with full-file SHA-256, and explains why an item may be worth reviewing.

Agent-heavy developers are the intended audience, not a restriction on the scan. Every file reached in the selected scope participates in size, age, and exact-duplicate analysis; named categories such as dependencies, models, archives, and caches are highlights rather than an allowlist.

It is an experimental, open-source developer tool—not a consumer Mac cleaner. Scans and paths stay local, nothing is changed automatically, and normal cleanup moves reviewed items to Trash.

</div>

---

## What it does

- **Digital Archaeologist:** rule-based explanations for repeated dependencies, caches, checkpoints, generated assets, installers, and forgotten experiments.
- **Exact duplicate evidence:** size and 8 KB header prefilter followed by full-file SHA-256 verification.
- **Big File Radar and treemap:** inspect large or stale files across the chosen storage scope.
- **Finder integration:** reveal every candidate before taking action.
- **Review-first cleanup:** nothing is selected automatically; normal removal moves items to `~/.Trash`.
- **User-controlled policies:** local Settings persist compression mode, confidence/savings/size thresholds, excluded extensions and paths, confirmation requirements, archive destination, and optional global-cache analysis. Settings never bypass backend safety gates.
- **Local reports:** export scan results as JSON or CSV.
- **Protection Shield:** blocks mutations to macOS system and sensitive user paths.
- **Fast reload snapshots:** page load reuses a server-memory snapshot for up to 10 minutes; **Scan Scope** always forces a fresh scan.
- **Exhaustive, bounded-memory enumeration:** every accessible file in the selected scope is counted. Duplicate candidates are indexed in a temporary on-disk SQLite database, while RAM retains only bounded UI samples and top files.
- **Real progress and cancellation:** the UI reports backend file/folder counts, and cancelling signals the scanner itself to stop—not only the browser request.

ZeroSpace does not use a machine-learning model. Its candidate scores are transparent heuristics for ranking review—not probabilities or guarantees that a file is safe to remove.

---

## Current limitations and trust model

To ensure complete transparency as an open-source GitHub project, **ZeroSpace v2.0** explicitly documents the following technical scope and system boundaries:

1. **Developer distribution:** this repository runs a Python localhost service and browser UI. It is not currently a signed or notarized `.app`.

2. **Localhost service:** the backend binds only to `127.0.0.1`, validates browser origins and Host headers for the selected port, and serves the UI locally. Stop it with `Ctrl-C` when finished.

3. **Permissions:** scan a specific workspace first. Scanning protected locations may require Full Disk Access for Terminal/Python; ZeroSpace does not need it for ordinary project folders.

   A completed report identifies how many directories could not be read. A root-volume scan remains on the startup volume and does not descend into separately mounted volumes under `/Volumes`.

4. **Conservative actions:** permanent deletion and advanced compression, migration, snapshot, and strategy operations are disabled by default. Review-first mode supports moving confirmed items to Trash.

5. **No safety guarantees:** duplicate content verification does not prove that a particular path is unused. Always inspect location and context before removal. ZeroSpace is not backup software or a notarized consumer cleaner.

### Distribution status

The repository is the supported distribution today. The included Homebrew formula is a development `--HEAD` formula; stable signed and notarized releases are not currently published.

---

## ⚡ Quick Start

### Run from Terminal
Clone and run the backend using Python 3. The backend uses only the Python standard library; the UI currently loads fonts and icons from public CDNs.

```bash
git clone https://github.com/LinusInnovator/zerospace.git
cd zerospace

# Start the localhost workspace inspector
./launch.sh
```

Open the URL printed by `launch.sh` (normally **`http://127.0.0.1:8080`**; it selects the next free localhost port if needed), choose a project/workspace folder, and scan. Use `Ctrl-C` in Terminal to stop the service.

---

## 🏗️ Project Architecture

```
hd-optimizer-detective/
├── scanner_backend.py   # Multi-threaded Python HTTP Server, sysctl hardware query, Protection Shield, os.walk audit engine
├── index.html           # 2026 Bento Grid 2.0 structure & Phosphor Duotone vector icons
├── styles.css           # Deep obsidian darkmode design system & backdrop glass utilities
├── app.js               # Reactive UI controller, SHA-256 smart selection & modal state managers
├── launch.sh            # Auto-launch script with port availability checks
├── ARCHITECTURE.md      # Detailed system architecture & API specifications
├── CONTRIBUTING.md      # Guidelines for open-source contributors
├── SECURITY.md          # Security policy & System Protection Shield rules
├── CHANGELOG.md         # Release history
└── Formula/             # Homebrew package formula
```

- **Backend**: Native Python `http.server.ThreadingHTTPServer`, `hashlib`, `subprocess` (`sysctl -n hw.memsize`).
- **Frontend**: ES6 Vanilla JS, CSS3 Container Queries & Grid 2.0, Phosphor Duotone SVG Iconography.
- **Security**: Localhost binding (`127.0.0.1`), restricted CORS, and strict system path locks (`is_safe_file_path`).

---

## 📖 Documentation

- 📐 [Architecture & API Specs](ARCHITECTURE.md)
- 🤝 [Contribution Guidelines](CONTRIBUTING.md)
- 🛡️ [Security Policy & Protection Shield](SECURITY.md)
- 📜 [Changelog](CHANGELOG.md)

### Verification

Pull requests run Python/API/security checks and a CI-only Playwright browser smoke suite on macOS. To run the same browser checks locally, install Node.js and run:

```bash
npm ci
npx playwright install chromium
ZEROSPACE_NO_BROWSER=1 ./launch.sh 8080
# In another terminal:
ZEROSPACE_BASE_URL=http://127.0.0.1:8080 npm run test:browser
```

The browser harness uses temporary fixture workspaces and never scans or modifies a real personal folder.

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
