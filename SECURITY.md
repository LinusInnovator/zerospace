# Security Policy & System Protection Shield

We take the security and safety of macOS system files extremely seriously.

---

## 🔒 Security Architecture

HD Optimizer Detective v2.0 implements multiple defensive layers to ensure zero accidental system file modifications:

### 1. Localhost Isolation
- The backend server binds strictly to IPv4 `127.0.0.1` (`ThreadingHTTPServer(('127.0.0.1', PORT), ...)`).
- Remote computers or devices on the same local Wi-Fi / LAN network CANNOT access or send API commands to the backend.

### 2. Strict Origin CORS Policy
- Cross-Origin Resource Sharing (CORS) is restricted to the exact localhost port selected by the running server (normally `8080`; `launch.sh` may choose a higher free port).
- API requests also validate the localhost Host header, Origin when supplied, and Fetch Metadata. Arbitrary third-party websites opened in other browser tabs cannot execute deletion payloads through normal browser requests.
- Requests are limited to 256 KiB and 500 operations and must use the documented JSON schema.

### 3. System Protection Shield (`is_safe_file_path`)
All filesystem modification APIs (`delete`, `trash`, `compress`, `migrate`) pass target paths through `is_safe_file_path()` before performing operations:

```python
PROTECTED_SYSTEM_PATHS = {
    '/', '/System', '/usr', '/bin', '/sbin', '/etc', '/var', '/dev', '/private',
    '/Library', '/Library/Preferences', '/Library/Application Support',
    '/Applications', '/Applications/Utilities',
    os.path.expanduser('~'),
    os.path.expanduser('~/.ssh'),
    os.path.expanduser('~/.bashrc'),
    os.path.expanduser('~/.zshrc'),
    os.path.expanduser('~/.config'),
    os.path.expanduser('~/Library')
}
```

Any attempt to delete or move a protected path returns an immediate `BLOCKED: Protected system path is locked` error log and aborts execution.

### 4. Compression policy

Compression is disabled by default by the backend advanced-action gate. When enabled deliberately, the request policy is validated server-side: explicit confirmation, confidence and expected-savings thresholds, maximum file size, excluded extensions, and excluded paths are enforced before any file is rewritten. Browser preferences are convenience controls, not a security boundary.

---

## 🐛 Reporting a Vulnerability

If you discover a security vulnerability or path traversal edge case in HD Optimizer Detective, please report it responsibly:

1. **Private report**: Use GitHub's private vulnerability reporting feature when it is enabled for the repository. Do not disclose exploitable details in a public issue.
2. **Details**: Include steps to reproduce, target macOS version, and expected vs actual behavior.
3. **Response**: We will acknowledge receipt within 24 hours and issue a fix patch within 72 hours.
