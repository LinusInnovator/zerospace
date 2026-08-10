# System Architecture & Technical Specifications

**HD Optimizer Detective v2.0** is designed as a zero-dependency, lightweight macOS storage intelligence web application powered by a native Python multi-threaded backend and a reactive ES6 Liquid Glass frontend.

---

## 🏛️ System Topology

```
+-----------------------------------------------------------------------+
|                         Web Browser Client                            |
|             (ES6 Vanilla JS / CSS3 Liquid Glassmorphism)               |
+-----------------------------------+-----------------------------------+
                                    |
                         HTTP REST API (127.0.0.1:8080)
                                    |
+-----------------------------------v-----------------------------------+
|                     scanner_backend.py (Python 3)                     |
|  +------------------------+  +-------------------+  +---------------+ |
|  | ThreadingHTTPServer    |  | Protection Shield |  | Hardware HUD  | |
|  | Request Handlers       |  | (is_safe_file_path)|  | (sysctl/vm)   | |
|  +-----------+------------+  +---------+---------+  +-------+-------+ |
|              |                         |                    |         |
|  +-----------v-------------------------v--------------------v-------+ |
|  |                 2-Pass SHA-256 Audit Engine                      | |
|  |   Pass 1: 8KB Header MD5 Hash  -->  Pass 2: Full 1MB SHA-256     | |
|  +-------------------------------------+----------------------------+ |
+----------------------------------------|------------------------------+
                                         |
                            macOS File System Calls
                     (os.walk, shutil.move to ~/.Trash)
```

---

## 📡 REST API Specification

All HTTP endpoints bind exclusively to `127.0.0.1`; the default URL is `http://127.0.0.1:8080`, with `launch.sh` selecting a higher free port when necessary.

### 1. `GET /api/scan?path=<DIRECTORY_PATH>`
Executes a permission-safe, exhaustive scan of all accessible files in the target directory. Candidate metadata is staged in a temporary disk-backed SQLite index so scan memory does not grow with file count. Files larger than 20 KB participate in exact-duplicate analysis; full-file SHA-256 is only calculated after size and header matches.

- **Query Parameters**:
  - `path` *(string)*: Absolute folder path to audit (e.g. `/Users/username/Downloads`).
- **Response `200 OK`**:
  ```json
  {
    "totalFiles": 45632,
    "coverage": {
      "complete": true,
      "directoriesScanned": 1204,
      "skippedDirectories": 3,
      "duplicateMinimumBytes": 20480
    },
    "healthScore": 88,
    "burnRate": "+3.4 GB / week",
    "daysLeft": "52 Days",
    "aiInsight": "Fast Real Hard Drive Audit finished...",
    "duplicates": [
      {
        "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "name": "large_archive.zip",
        "sizeBytes": 294110000,
        "aiCategory": "Archive",
        "confidence": "99% High (SHA-256 Match)",
        "files": [
          { "path": "/Users/.../large_archive.zip", "mtime": "2026-08-01", "selected": false, "action": "delete" },
          { "path": "/Users/.../large_archive (1).zip", "mtime": "2026-08-02", "selected": true, "action": "delete" }
        ]
      }
    ],
    "strategies": [ ... ],
    "treemapNodes": [ ... ],
    "topHogs": [ ... ]
  }
  ```

---

### 2. `GET /api/system_hud`
Queries live macOS kernel metrics via system calls.

- **Response `200 OK`**:
  ```json
  {
    "totalRamGb": 64.0,
    "usedRamGb": 18.2,
    "ramPct": 28.4,
    "trashBytes": 0,
    "trashFormatted": "0 B",
    "cpuLoadPct": 24
  }
  ```

---

### 3. `POST /api/execute`
Executes safe file removal or moves flagged items to Trash.

- **Request Body**:
  ```json
  {
    "items": [
      { "path": "/Users/linus/Downloads/duplicate.pdf", "action": "trash" },
      { "path": "/Users/linus/Downloads/duplicate_copy.pdf", "action": "delete" }
    ]
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "reclaimedBytes": 294110000,
    "executedItemsCount": 2,
    "log": [
      "Moved to Trash: /Users/linus/Downloads/duplicate.pdf -> /Users/linus/.Trash/duplicate.pdf",
      "Deleted: /Users/linus/Downloads/duplicate_copy.pdf"
    ]
  }
  ```

---

## ⚡ 2-Pass Cryptographic Duplicate Algorithm

To avoid indexing bottlenecks on large SSDs, HD Optimizer Detective uses a **2-Pass Hashing Pipeline**:

1. **Size Grouping**: Group files by exact byte size (`os.path.getsize`). Ignore unique file sizes.
2. **Pass 1 (8KB MD5 Header Hash)**: Read only the first 8,192 bytes of candidate files (`get_fast_header_hash`). MD5 is used only as a non-security prefilter; it never establishes duplicate identity.
3. **Pass 2 (Full-file SHA-256 Hash)**: Stream every byte of remaining candidate files through SHA-256 before reporting a duplicate match.

---

## 🛡️ System Protection Shield Mechanics

To prevent system bricking or accidental deletion of OS files, `scanner_backend.py` enforces `is_safe_file_path(path)`:

1. **Path Normalization**: Resolves target path via `os.path.realpath(os.path.abspath(os.path.expanduser(path)))`.
2. **Protected Set Match**: Rejects paths matching:
   - Root Directories: `/`, `/System`, `/usr`, `/bin`, `/sbin`, `/etc`, `/var`, `/dev`, `/private`
   - Application & System Library: `/Applications`, `/Applications/Utilities`, `/Library`, `~/Library`
   - User Security Files: Root `~`, `~/.ssh`, `~/.bashrc`, `~/.zshrc`, `~/.config`
3. **Symlink Safety**: Before directory removal (`shutil.rmtree`), verifies `not os.path.islink(path)`. If a symlink is targeted, only the link itself is unlinked (`os.unlink`).
