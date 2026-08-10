# Contributing to HD Optimizer Detective

Thank you for considering contributing to **HD Optimizer Detective**! We welcome open-source contributions from developers around the world.

---

## 📐 Core Engineering Principles

1. **Zero External Dependencies**:
   - The backend MUST remain written in **pure standard-library Python 3** (`http.server`, `hashlib`, `subprocess`, `os`, `shutil`).
   - Do NOT introduce external npm or pip dependencies (`npm install` or `pip install` requirement is strictly forbidden).
2. **Zero Emoji UI Slop**:
   - Icons MUST use vector Phosphor Duotone SVG icons (`<i class="ph-duotone ph-..."></i>`). Avoid embedding unicode emojis in buttons or header titles.
3. **Obsidian Darkmode Aesthetic**:
   - Follow the **CleanMyMac v5-inspired Liquid Glass Design System**:
     - Background: `#05070c`
     - Card Backgrounds: `rgba(16, 22, 38, 0.92)`
     - Borders: `1px solid rgba(255, 255, 255, 0.08)`
     - Electric Accents: `#00f2fe` (Cyan), `#fb35b5` (Magenta/Pink), `#10b981` (Emerald), `#f59e0b` (Amber).
4. **Safety First**:
   - Every file deletion path MUST pass through `is_safe_file_path()` in `scanner_backend.py`.

---

## 🛠️ Setting Up Development Environment

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/LinusInnovator/zerospace.git
   cd zerospace
   ```

2. **Run Local Server**:
   ```bash
   python3 scanner_backend.py
   ```

3. **Open Application**:
   Open the URL printed by `./launch.sh` in Chrome, Safari, or Arc.

---

## 💡 Adding a New Scanner Strategy

To add a new junk detection rule (e.g. Docker build cache or Yarn cache):

1. Open `scanner_backend.py`.
2. Inside `run_real_hd_audit(root_dir)`:
   ```python
   yarn_cache = os.path.expanduser('~/Library/Caches/Yarn')
   if os.path.exists(yarn_cache):
       try:
           yarn_size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(yarn_cache) for f in fs if os.path.isfile(os.path.join(r, f)))
           if yarn_size > 0:
               real_strategies.append({
                   "id": "strat-real-yarn",
                   "name": "Purge Yarn Package Manager Caches",
                   "category": "dev",
                   "desc": "Discovered cached Yarn package tarballs.",
                   "command": f"rm -rf {yarn_cache}/*",
                   "savingsBytes": yarn_size,
                   "safety": "safe",
                   "confidence": "99% High",
                   "enabled": True,
                   "action": "delete"
               })
       except Exception:
           pass
   ```
3. Test your changes locally and verify that `is_safe_file_path()` validates the target directory.

---

## 📋 Pull Request Checklist

Before submitting a Pull Request:

- [ ] Run `python3 scanner_backend.py` and ensure zero console/terminal syntax errors.
- [ ] Test UI rendering in a browser using the URL printed by `./launch.sh`.
- [ ] Verify that no new npm or pip packages were added.
- [ ] Confirm System Protection Shield test passes:
  ```bash
  python3 -c "from scanner_backend import is_safe_file_path; print(is_safe_file_path('/System'))"
  ```
