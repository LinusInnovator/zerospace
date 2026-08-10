# Security Policy & System Protection Shield

We take the security and safety of macOS system files extremely seriously.

---

## 🔒 Security Architecture

HD Optimizer Detective v2.0 implements multiple defensive layers to ensure zero accidental system file modifications:

### 1. Localhost Isolation
- The backend server binds strictly to IPv4 `127.0.0.1` (`ThreadingHTTPServer(('127.0.0.1', PORT), ...)`).
- Remote computers or devices on the same local Wi-Fi / LAN network CANNOT access or send API commands to the backend.

### 2. Strict Origin CORS Policy
- Cross-Origin Resource Sharing (CORS) is restricted to `http://127.0.0.1:8080` and `http://localhost:8080`.
- Arbitrary third-party websites opened in other browser tabs CANNOT execute deletion payloads via cross-site requests.

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

---

## 🐛 Reporting a Vulnerability

If you discover a security vulnerability or path traversal edge case in HD Optimizer Detective, please report it responsibly:

1. **Email**: Open a security disclosure issue or email the maintainers directly.
2. **Details**: Include steps to reproduce, target macOS version, and expected vs actual behavior.
3. **Response**: We will acknowledge receipt within 24 hours and issue a fix patch within 72 hours.
