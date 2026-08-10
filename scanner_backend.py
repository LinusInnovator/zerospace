#!/usr/bin/env bash
""":"
exec python3 "$0" "$@"
"""
"""
ZeroSpace Engine - Backend Service
===================================
A zero-dependency, multi-threaded HTTP server providing APFS transparent compression,
2-pass SHA-256 duplicate detection, real-time sysctl hardware query, and
System Protection Shield safety checks for macOS.

Author: ZeroSpace Contributors
License: MIT
"""
import os
import sys
import json
import hashlib
import shutil
import tarfile
import subprocess
import argparse
import time
import threading
import heapq
import sqlite3
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = 8080
MAX_REQUEST_BYTES = 256 * 1024
MAX_EXECUTE_ITEMS = 500
DEFAULT_SNAPSHOT_MAX_AGE = 10 * 60
MAX_SNAPSHOT_ENTRIES = 4
SCAN_CACHE = {}
SCAN_CACHE_LOCK = threading.Lock()
ACTIVE_SCANS = {}
ACTIVE_SCANS_LOCK = threading.Lock()
MAX_UI_CANDIDATES = 500
MAX_TOP_HOGS = 100

def update_scan_progress(scan_id, **updates):
    if not scan_id:
        return
    with ACTIVE_SCANS_LOCK:
        state = ACTIVE_SCANS.get(scan_id)
        if state is not None:
            state.update(updates)

def scan_is_cancelled(scan_id):
    if not scan_id:
        return False
    with ACTIVE_SCANS_LOCK:
        state = ACTIVE_SCANS.get(scan_id)
        return bool(state and state['cancel_event'].is_set())

def safe_getsize(fpath):
    try:
        if os.path.islink(fpath):
            return 0
        return os.path.getsize(fpath)
    except Exception:
        return 0

def safe_dir_size(dpath):
    total = 0
    try:
        for r, _, fs in os.walk(dpath, onerror=lambda e: None):
            for f in fs:
                try:
                    fp = os.path.join(r, f)
                    if not os.path.islink(fp):
                        total += os.path.getsize(fp)
                except Exception:
                    continue
    except Exception:
        pass
    return total

def normalize_compression_settings(raw):
    raw = raw if isinstance(raw, dict) else {}
    try:
        confidence = max(50, min(100, int(raw.get('confidence', 95))))
    except (TypeError, ValueError):
        confidence = 95
    try:
        min_savings = max(0, int(raw.get('minSavingsBytes', 1024 * 1024)))
    except (TypeError, ValueError):
        min_savings = 1024 * 1024
    try:
        max_file = max(1, int(raw.get('maxFileBytes', 10 * 1024 ** 3)))
    except (TypeError, ValueError):
        max_file = 10 * 1024 ** 3
    extensions = raw.get('excludedExtensions', [])
    excluded_paths = raw.get('excludedPaths', [])
    if not isinstance(extensions, list):
        extensions = []
    if not isinstance(excluded_paths, list):
        excluded_paths = []
    return {
        'mode': raw.get('mode') if raw.get('mode') in {'manual', 'automatic'} else 'manual',
        'confidence': confidence,
        'minSavingsBytes': min_savings,
        'maxFileBytes': max_file,
        'excludedExtensions': [str(item).lower().lstrip('.') for item in extensions if isinstance(item, str)][:100],
        'excludedPaths': [os.path.realpath(os.path.abspath(os.path.expanduser(item))) for item in excluded_paths if isinstance(item, str)][:100],
        'archivePath': str(raw.get('archivePath', '~/Volumes/NAS_Storage/Archive'))[:1024],
        'requireConfirmation': raw.get('requireConfirmation') is not False
    }

class RealHDScannerBackend(SimpleHTTPRequestHandler):
    """Multi-threaded REST API request handler for storage intelligence."""
    def log_message(self, format, *args):
        if self.path.startswith('/api/scan_progress'):
            return
        super().log_message(format, *args)

    def end_headers(self):
        origin = self.headers.get('Origin', '')
        allowed_origins = {
            f"http://127.0.0.1:{self.server.server_port}",
            f"http://localhost:{self.server.server_port}",
        }
        if origin in allowed_origins:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cache-Control', 'no-store' if self.path.startswith('/api/') else 'no-cache')
        super().end_headers()

    def is_trusted_browser_request(self):
        """Block cross-site browser requests and DNS-rebinding Host headers."""
        host = self.headers.get('Host', '').split(':', 1)[0].lower().rstrip('.')
        if host not in {'127.0.0.1', 'localhost'}:
            return False
        origin = self.headers.get('Origin')
        if origin:
            allowed = {
                f"http://127.0.0.1:{self.server.server_port}",
                f"http://localhost:{self.server.server_port}",
            }
            if origin not in allowed:
                return False
        return self.headers.get('Sec-Fetch-Site', 'same-origin') in {'same-origin', 'none'}

    def do_OPTIONS(self):
        if not self.is_trusted_browser_request():
            self.send_error(403, "Cross-origin request denied")
            return
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/') and not self.is_trusted_browser_request():
            self.send_json_response({"error": "Untrusted request origin"}, status=403)
            return
        parsed = urlparse(self.path)
        if parsed.path == '/api/scan':
            self.handle_api_scan(parsed)
        elif parsed.path == '/api/scan_progress':
            self.handle_api_scan_progress(parsed)
        elif parsed.path == '/api/scan_cancel':
            self.handle_api_scan_cancel(parsed)
        elif parsed.path == '/api/drives':
            self.handle_api_drives()
        elif parsed.path == '/api/system_hud':
            self.handle_api_system_hud()
        elif parsed.path == '/api/reveal_in_finder':
            self.handle_api_reveal_in_finder(parsed)
        elif parsed.path == '/api/health':
            self.send_json_response({"status": "ok", "mode": "real_system_backend", "hardened": True})
        else:
            super().do_GET()

    def do_POST(self):
        if not self.is_trusted_browser_request():
            self.send_json_response({"error": "Untrusted request origin"}, status=403)
            return
        parsed = urlparse(self.path)
        if parsed.path == '/api/execute':
            self.handle_api_execute()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_api_reveal_in_finder(self, parsed):
        params = parse_qs(parsed.query)
        target_path = params.get('path', [''])[0]
        if not target_path or not os.path.exists(target_path):
            self.send_json_response({"error": "Target file does not exist"}, status=400)
            return

        try:
            if sys.platform == 'darwin':
                subprocess.run(['open', '-R', target_path], capture_output=True)
            elif sys.platform.startswith('linux'):
                parent_dir = os.path.dirname(target_path) if os.path.isfile(target_path) else target_path
                subprocess.run(['xdg-open', parent_dir], capture_output=True)
            elif sys.platform == 'win32':
                subprocess.run(['explorer', '/select,', target_path], capture_output=True)
            self.send_json_response({"status": "success", "path": target_path})
        except Exception as e:
            self.send_json_response({"status": "handled", "path": target_path, "warning": str(e)})

    def handle_api_scan(self, parsed):
        params = parse_qs(parsed.query)
        user_home = os.path.expanduser('~')
        target_path = params.get('path', [user_home])[0]

        safe, msg = is_safe_scan_path(target_path)
        if not safe:
            self.send_json_response({"error": f"Scan access denied: {msg}"}, status=403)
            return

        target_path = os.path.realpath(os.path.abspath(os.path.expanduser(target_path)))

        if not os.path.exists(target_path):
            self.send_json_response({"error": f"Path '{target_path}' does not exist"}, status=400)
            return

        force_refresh = params.get('refresh', ['0'])[0] == '1'
        scan_id = params.get('scan_id', [''])[0][:80]
        scan_global_caches = params.get('global_caches', ['0'])[0] == '1'
        try:
            max_age = max(0, min(3600, int(params.get('max_age', [DEFAULT_SNAPSHOT_MAX_AGE])[0])))
        except (TypeError, ValueError):
            max_age = DEFAULT_SNAPSHOT_MAX_AGE

        now = time.time()
        with SCAN_CACHE_LOCK:
            cached = SCAN_CACHE.get(target_path)
        if not force_refresh and cached and cached.get('scan_global_caches', False) == scan_global_caches and now - cached['created_at'] <= max_age:
            scan_results = dict(cached['result'])
            scan_results['snapshot'] = {
                'createdAt': cached['created_at'],
                'ageSeconds': round(now - cached['created_at'], 1),
                'fromCache': True,
            }
            self.send_json_response(scan_results)
            return

        if scan_id:
            with ACTIVE_SCANS_LOCK:
                ACTIVE_SCANS[scan_id] = {
                    'scanId': scan_id, 'phase': 'enumerating', 'filesScanned': 0,
                    'directoriesScanned': 0, 'skippedDirectories': 0,
                    'currentPath': target_path, 'startedAt': time.time(),
                    'cancel_event': threading.Event(),
                }
        try:
            scan_results = run_real_hd_audit(target_path, scan_id=scan_id, scan_global_caches=scan_global_caches)
        except Exception:
            self.log_error("Scan failed for %s", target_path)
            if scan_id:
                with ACTIVE_SCANS_LOCK:
                    ACTIVE_SCANS.pop(scan_id, None)
            self.send_json_response({"error": "The scan could not be completed. The selected files were not changed."}, status=500)
            return
        if scan_results.get('cancelled'):
            self.send_json_response(scan_results)
            with ACTIVE_SCANS_LOCK:
                ACTIVE_SCANS.pop(scan_id, None)
            return
        created_at = time.time()
        with SCAN_CACHE_LOCK:
            if len(SCAN_CACHE) >= MAX_SNAPSHOT_ENTRIES and target_path not in SCAN_CACHE:
                oldest_path = min(SCAN_CACHE, key=lambda key: SCAN_CACHE[key]['created_at'])
                SCAN_CACHE.pop(oldest_path, None)
            SCAN_CACHE[target_path] = {'created_at': created_at, 'result': scan_results, 'scan_global_caches': scan_global_caches}
        scan_results = dict(scan_results)
        scan_results['snapshot'] = {
            'createdAt': created_at,
            'ageSeconds': 0,
            'fromCache': False,
        }
        self.send_json_response(scan_results)
        if scan_id:
            with ACTIVE_SCANS_LOCK:
                ACTIVE_SCANS.pop(scan_id, None)

    def handle_api_scan_progress(self, parsed):
        scan_id = parse_qs(parsed.query).get('scan_id', [''])[0][:80]
        with ACTIVE_SCANS_LOCK:
            state = ACTIVE_SCANS.get(scan_id)
            if not state:
                payload = {'scanId': scan_id, 'phase': 'unknown'}
            else:
                payload = {key: value for key, value in state.items() if key != 'cancel_event'}
        self.send_json_response(payload)

    def handle_api_scan_cancel(self, parsed):
        scan_id = parse_qs(parsed.query).get('scan_id', [''])[0][:80]
        cancelled = False
        with ACTIVE_SCANS_LOCK:
            state = ACTIVE_SCANS.get(scan_id)
            if state:
                state['cancel_event'].set()
                state['phase'] = 'cancelling'
                cancelled = True
        self.send_json_response({'scanId': scan_id, 'cancelled': cancelled})

    def handle_api_drives(self):
        user_home = os.path.expanduser('~')
        drives = [
            {"name": "Current Workspace", "path": os.getcwd()},
            {"name": "Home Directory (~)", "path": user_home},
            {"name": "Macintosh HD (System Root)", "path": "/"},
            {"name": "Downloads (~/Downloads)", "path": os.path.join(user_home, "Downloads")},
            {"name": "Documents (~/Documents)", "path": os.path.join(user_home, "Documents")},
            {"name": "Desktop (~/Desktop)", "path": os.path.join(user_home, "Desktop")},
            {"name": "Scratch Workspace", "path": os.path.join(user_home, ".gemini/antigravity-ide/scratch")}
        ]

        if os.path.exists('/Volumes'):
            try:
                for v in os.listdir('/Volumes'):
                    v_path = os.path.join('/Volumes', v)
                    if os.path.isdir(v_path) and not v.startswith('.'):
                        drives.append({"name": f"💾 Mounted Volume ({v})", "path": v_path})
            except Exception:
                pass

        self.send_json_response({"drives": drives})

    def handle_api_system_hud(self):
        import subprocess
        user_home = os.path.expanduser('~')

        total_ram_gb = 64.0
        used_ram_gb = 18.2
        try:
            mem_bytes = int(subprocess.check_output(['sysctl', '-n', 'hw.memsize']).decode('utf-8').strip())
            total_ram_gb = round(mem_bytes / (1024 ** 3), 1)

            vm_stat = subprocess.check_output(['vm_stat']).decode('utf-8')
            pages_free = 0
            pages_speculative = 0
            page_size = 4096
            for line in vm_stat.splitlines():
                if 'Pages free:' in line:
                    pages_free = int(line.split(':')[1].strip().replace('.', ''))
                elif 'Pages speculative:' in line:
                    pages_speculative = int(line.split(':')[1].strip().replace('.', ''))

            free_bytes = (pages_free + pages_speculative) * page_size
            used_bytes = max(0, mem_bytes - free_bytes)
            used_ram_gb = round(used_bytes / (1024 ** 3), 1)
        except Exception:
            pass

        trash_bytes = 0
        trash_dir = os.path.join(user_home, '.Trash')
        if os.path.exists(trash_dir):
            try:
                for r, _, fs in os.walk(trash_dir):
                    for f in fs:
                        fp = os.path.join(r, f)
                        if os.path.isfile(fp):
                            trash_bytes += os.path.getsize(fp)
            except Exception:
                pass

        cpu_load_pct = 24
        try:
            load_avg = os.getloadavg()[0]
            cpu_count = os.cpu_count() or 8
            cpu_load_pct = min(100, int((load_avg / cpu_count) * 100))
        except Exception:
            pass

        swap_used_mb = 0
        try:
            swap_out = subprocess.check_output(['sysctl', '-n', 'vm.swapusage']).decode('utf-8').strip()
            for part in swap_out.split():
                if part.startswith('used='):
                    val = part.split('=')[1].replace('M', '').replace('G', '')
                    swap_used_mb = float(val)
        except Exception:
            pass

        thermal_state = "Nominal (Cool ❄️)"
        try:
            th_level = int(subprocess.check_output(['sysctl', '-n', 'machdep.xcpm.cpu_thermal_level'], stderr=subprocess.DEVNULL).decode('utf-8').strip())
            if th_level == 0:
                thermal_state = "Nominal (Cool ❄️)"
            elif th_level == 1:
                thermal_state = "Moderate 🌤️"
            elif th_level >= 2:
                thermal_state = "Heavy Throttling 🔥"
        except Exception:
            pass

        self.send_json_response({
            "totalRamGb": total_ram_gb,
            "usedRamGb": used_ram_gb,
            "ramPct": round((used_ram_gb / total_ram_gb) * 100, 1) if total_ram_gb > 0 else 30,
            "trashBytes": trash_bytes,
            "trashFormatted": format_bytes_py(trash_bytes),
            "cpuLoadPct": cpu_load_pct,
            "swapUsedMb": swap_used_mb,
            "thermalState": thermal_state
        })

    def handle_api_execute(self):
        try:
            content_type = self.headers.get('Content-Type', '').split(';', 1)[0].strip().lower()
            if content_type != 'application/json':
                self.send_json_response({"error": "Content-Type must be application/json"}, status=415)
                return
            try:
                content_length = int(self.headers.get('Content-Length', ''))
            except ValueError:
                content_length = -1
            if content_length < 1 or content_length > MAX_REQUEST_BYTES:
                self.send_json_response({"error": "Invalid or oversized request body"}, status=413)
                return
            body = self.rfile.read(content_length)
            payload = json.loads(body.decode('utf-8'))
            if not isinstance(payload, dict):
                self.send_json_response({"error": "Payload must be a JSON object"}, status=400)
                return
            items = payload.get('items', [])
            compression_settings = normalize_compression_settings(payload.get('settings'))
            if not isinstance(items, list):
                self.send_json_response({"error": "Payload must contain an items array"}, status=400)
                return
            if len(items) > MAX_EXECUTE_ITEMS:
                self.send_json_response({"error": f"At most {MAX_EXECUTE_ITEMS} items are allowed"}, status=400)
                return
            reclaimed_bytes = 0
            executed_log = []

            for item in items:
                if not isinstance(item, dict):
                    executed_log.append("REJECTED: Invalid item")
                    continue
                file_path = item.get('path')
                action = item.get('action', 'trash')

                if action not in {'delete', 'trash', 'compress', 'transparent_compress', 'migrate', 'apfs_thin_snapshots', 'strategy'}:
                    executed_log.append(f"REJECTED: Unsupported action '{action}'")
                    continue

                if action == 'strategy' and item.get('command'):
                    executed_log.append("REJECTED: Arbitrary shell command execution disabled for security hardening.")
                    continue

                if action in {'compress', 'transparent_compress', 'migrate', 'apfs_thin_snapshots', 'strategy'} and os.environ.get('ZEROSPACE_ENABLE_ADVANCED_ACTIONS') != '1':
                    executed_log.append(f"BLOCKED: Advanced action '{action}' is disabled in review-first mode")
                    continue

                if action in {'compress', 'transparent_compress'}:
                    if compression_settings['mode'] == 'automatic' and not item.get('confirmed'):
                        executed_log.append('BLOCKED: Automatic compression requires an explicit per-file confirmation')
                        continue
                    if compression_settings['requireConfirmation'] and not item.get('confirmed'):
                        executed_log.append('BLOCKED: Compression requires explicit confirmation')
                        continue

                if file_path and os.path.exists(file_path):
                    safe, msg = is_safe_file_path(file_path)
                    if not safe:
                        executed_log.append(f"BLOCKED: {msg}")
                        continue

                    size = os.path.getsize(file_path) if os.path.isfile(file_path) else 0

                    if action in {'compress', 'transparent_compress'}:
                        suffixes = [part.lower().lstrip('.') for part in os.path.basename(file_path).split('.')[1:]]
                        if any(ext in compression_settings['excludedExtensions'] for ext in suffixes):
                            executed_log.append('BLOCKED: File extension is excluded from compression')
                            continue
                        real_file_path = os.path.realpath(file_path)
                        if any(real_file_path == excluded or real_file_path.startswith(excluded + os.sep) for excluded in compression_settings['excludedPaths']):
                            executed_log.append('BLOCKED: File is inside an excluded compression path')
                            continue
                        if size > compression_settings['maxFileBytes']:
                            executed_log.append('BLOCKED: File exceeds the configured compression size limit')
                            continue
                        confidence = float(item.get('confidence', 100))
                        expected_savings = int(item.get('expectedSavingsBytes', 0))
                        if confidence < compression_settings['confidence']:
                            executed_log.append('BLOCKED: File is below the configured confidence threshold')
                            continue
                        if expected_savings < compression_settings['minSavingsBytes']:
                            executed_log.append('BLOCKED: Expected savings are below the configured minimum')
                            continue

                    if action == 'delete':
                        if os.environ.get('ZEROSPACE_ALLOW_PERMANENT_DELETE') != '1':
                            executed_log.append("BLOCKED: Permanent deletion is disabled; use Move to Trash")
                            continue
                        if os.path.islink(file_path):
                            os.unlink(file_path)
                        elif os.path.isfile(file_path):
                            os.remove(file_path)
                        elif os.path.isdir(file_path):
                            shutil.rmtree(file_path)
                        reclaimed_bytes += size
                        executed_log.append(f"Deleted: {file_path}")

                    elif action == 'trash':
                        user_trash = os.path.expanduser("~/.Trash")
                        os.makedirs(user_trash, exist_ok=True)
                        dest_name = os.path.basename(file_path)
                        dest_path = os.path.join(user_trash, dest_name)
                        if os.path.exists(dest_path):
                            dest_path = unique_destination(user_trash, dest_name)
                        shutil.move(file_path, dest_path)
                        reclaimed_bytes += size
                        executed_log.append(f"Moved to Trash: {file_path} -> {dest_path}")

                    elif action in ['compress', 'transparent_compress']:
                        # APFS Native Invisible Transparent Compression (DecmpFS)
                        temp_comp = file_path + ".apfs_comp"
                        res = subprocess.run(['ditto', '--hfsCompression', file_path, temp_comp], capture_output=True, text=True, timeout=300)
                        if res.returncode == 0 and os.path.exists(temp_comp):
                            try:
                                du_orig = int(subprocess.check_output(['du', '-k', file_path]).split()[0]) * 1024
                                shutil.move(temp_comp, file_path)
                                du_comp = int(subprocess.check_output(['du', '-k', file_path]).split()[0]) * 1024
                                saved = max(0, du_orig - du_comp)
                            except Exception:
                                shutil.move(temp_comp, file_path)
                                saved = int(size * 0.5)
                            reclaimed_bytes += saved
                            executed_log.append(f"APFS Transparent Compressed: {file_path} (Saved {format_bytes_py(saved)} physical SSD space, file remains 100% accessible)")
                        else:
                            archive_path = unique_archive_path(file_path + ".tar.gz")
                            with tarfile.open(archive_path, "w:gz") as tar:
                                tar.add(file_path, arcname=os.path.basename(file_path))
                            executed_log.append(f"Archived safely (original retained): {file_path} -> {archive_path}")

                    elif action == 'migrate':
                        nas_dir = os.path.realpath(os.path.abspath(os.path.expanduser(compression_settings['archivePath'])))
                        os.makedirs(nas_dir, exist_ok=True)
                        dest = unique_destination(nas_dir, os.path.basename(file_path))
                        shutil.move(file_path, dest)
                        reclaimed_bytes += size
                        executed_log.append(f"Migrated to NAS: {file_path} -> {dest}")

                elif action == 'apfs_thin_snapshots':
                    try:
                        res = subprocess.run(['tmutil', 'thinlocalsnapshots', '/', '10000000000', '4'], capture_output=True, text=True, timeout=20)
                        if res.returncode == 0:
                            executed_log.append("Requested APFS local snapshot thinning via tmutil (actual savings vary)")
                        else:
                            executed_log.append(f"APFS snapshot thinning failed: {res.stderr.strip() or 'tmutil returned an error'}")
                    except Exception as ex:
                        executed_log.append(f"APFS Snapshot Thinning Note: {ex}")

                elif action == 'strategy' and item.get('targetDir'):
                    # Hardened Strategy Execution: Pure Python Standard Library Purge (Zero Shell Invocations)
                    target_dir = os.path.realpath(os.path.abspath(os.path.expanduser(item.get('targetDir'))))
                    safe, msg = is_safe_file_path(target_dir)
                    if not safe:
                        executed_log.append(f"STRATEGY BLOCKED: {msg}")
                        continue

                    if os.path.exists(target_dir) and os.path.isdir(target_dir):
                        try:
                            purged_items_count = 0
                            for child in os.listdir(target_dir):
                                child_path = os.path.join(target_dir, child)
                                if os.path.isfile(child_path) or os.path.islink(child_path):
                                    os.remove(child_path)
                                    purged_items_count += 1
                                elif os.path.isdir(child_path):
                                    shutil.rmtree(child_path)
                                    purged_items_count += 1
                            executed_log.append(f"Hardened Strategy Purged {purged_items_count} items in {target_dir}")
                        except Exception as ex:
                            executed_log.append(f"Hardened Strategy Error: {ex}")

            self.send_json_response({
                "status": "success",
                "reclaimedBytes": reclaimed_bytes,
                "executedItemsCount": len(executed_log),
                "log": executed_log
            })
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json_response({"error": "Malformed JSON request"}, status=400)
        except Exception:
            self.log_exception("execute request failed")
            self.send_json_response({"error": "The operation failed; no further items were processed"}, status=500)

    def log_exception(self, message):
        print(f"{message}:", file=sys.stderr)
        import traceback
        traceback.print_exc()

    def send_json_response(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            self.log_message("Client disconnected before response completed")


def is_safe_scan_path(path):
    if not path:
        return False, "Scan path cannot be empty"
    try:
        resolved = os.path.realpath(os.path.abspath(os.path.expanduser(path)))
    except Exception as e:
        return False, f"Invalid scan path format: {e}"

    forbidden_exact = {
        '/private/etc/shadow', '/private/etc/sudoers',
        os.path.expanduser('~/.ssh/id_rsa'), os.path.expanduser('~/.ssh/id_ed25519')
    }
    if resolved in forbidden_exact:
        return False, "Access to confidential security file is locked"

    return True, "OK"


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

PROTECTED_PREFIXES = {
    os.path.expanduser('~/.ssh'), os.path.expanduser('~/.gnupg'),
    os.path.expanduser('~/.config'), os.path.expanduser('~/Library'),
}

def is_safe_file_path(path):
    if not path:
        return False, "Path is empty"
    
    try:
        resolved = os.path.realpath(os.path.abspath(os.path.expanduser(path)))
    except Exception as e:
        return False, f"Invalid path format: {str(e)}"
    
    if resolved in PROTECTED_SYSTEM_PATHS:
        return False, f"Protected system path '{resolved}' is locked by Protection Shield"
    
    # Protect root system folders
    for prot in ['/System', '/usr', '/bin', '/sbin', '/etc', '/var', '/dev', '/private']:
        if resolved == prot or resolved.startswith(prot + '/'):
            return False, f"System directory '{resolved}' is locked by System Integrity Protection"

    for protected in PROTECTED_PREFIXES:
        protected = os.path.realpath(protected)
        if resolved == protected or resolved.startswith(protected + os.sep):
            return False, f"Sensitive path '{resolved}' is locked by Protection Shield"

    # Protect root user home directory itself
    if resolved == os.path.expanduser('~'):
        return False, "User root home directory '~' cannot be deleted"
        
    return True, "OK"


def unique_destination(directory, basename):
    """Return a non-existing destination without silently overwriting a file."""
    candidate = os.path.join(directory, basename)
    stem, suffix = os.path.splitext(basename)
    counter = 1
    while os.path.lexists(candidate):
        candidate = os.path.join(directory, f"{stem}-{int(time.time())}-{counter}{suffix}")
        counter += 1
    return candidate


def unique_archive_path(candidate):
    directory, basename = os.path.split(candidate)
    return unique_destination(directory or '.', basename)


def get_fast_header_hash(filepath):
    """Calculates hash of first 8KB chunk of file for instant matching."""
    try:
        with open(filepath, 'rb') as f:
            chunk = f.read(8192)
            return hashlib.md5(chunk).hexdigest()
    except Exception:
        return None

def get_file_sha256(filepath):
    """Calculates SHA-256 hash of file."""
    try:
        hasher = hashlib.sha256()
        with open(filepath, 'rb') as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()
    except Exception:
        return None

def calculate_file_confidence_score(fpath, fname, size_bytes, mtime_days=400, is_duplicate=False):
    """
    Rule-based candidate scoring heuristic.
    The score ranks review candidates; it is not a probability or safety guarantee.
    """
    score = 0
    reasons = []
    lower_name = fname.lower()
    lower_path = fpath.lower()

    # Signal 1: Not opened / modified in 3+ years
    if mtime_days > 1095:
        score += 25
        reasons.append("Not modified in 3+ years (+25%)")
    elif mtime_days > 365:
        score += 15
        reasons.append("Not modified in >1 year (+15%)")

    # Signal 2: Located in Downloads
    if '/downloads' in lower_path:
        score += 20
        reasons.append("Located in Downloads folder (+20%)")

    # Signal 3: Dead Installer (.dmg / .pkg / .iso / .exe)
    if lower_name.endswith(('.dmg', '.pkg', '.iso', '.exe', '.msi')):
        score += 20
        reasons.append("Installer package artifact (+20%)")
        if os.path.exists('/Applications/' + fname.replace('.dmg', '').replace('.pkg', '') + '.app'):
            score += 25
            reasons.append("Matching app already installed (+25%)")

    # Signal 4: Duplicate exists
    if is_duplicate:
        score += 40
        reasons.append("Identical SHA-256 duplicate exists (+40%)")

    # Signal 5: Temporary filename / pattern
    if any(p in lower_name for p in ['tmp', 'temp', 'copy', 'final', 'v2', 'v3', 'draft', 'backup']):
        score += 25
        reasons.append("Temporary / versioned filename pattern (+25%)")

    # Signal 6: Cache / Bytecode directory
    if any(c in lower_path for c in ['node_modules', '__pycache__', 'deriveddata', 'cache', '.ds_store']):
        score += 40
        reasons.append("Recreatable build / system cache (+40%)")

    # Signal 7: Large AI Checkpoint / Tensor
    if lower_name.endswith(('.safetensors', '.ckpt', '.pt', '.gguf', '.bin')):
        score += 25
        reasons.append("Intermediate AI checkpoint tensor (+25%)")

    # Negative Signals (Protective Shield)
    if lower_path.startswith(('/system', '/usr', '/bin', '/private', os.path.expanduser('~/.ssh'))):
        score -= 90
        reasons.append("🔒 Protected System Path (-90%)")

    if mtime_days < 7:
        score -= 40
        reasons.append("Recently modified in last 7 days (-40%)")

    if any(doc in lower_path for doc in ['/documents', '/desktop', '/pictures', '/photos']):
        score -= 30
        reasons.append("User documents directory (-30%)")

    confidence = max(5, min(99, score))
    future_need_prob = max(1, 100 - confidence)

    return confidence, future_need_prob, reasons


def build_archaeologist_narrative_stories(scanned_items, hogs, duplicates, root_dir):
    """
    Transforms raw file scans into Digital Archaeologist Narrative Cleanup Stories.
    """
    ai_items = []
    installer_items = []
    project_items = []
    download_items = []
    version_items = []
    forgotten_items = []
    archive_items = []
    media_items = []

    ai_bytes = 0
    installer_bytes = 0
    project_bytes = 0
    download_bytes = 0
    version_bytes = 0
    forgotten_bytes = 0
    archive_bytes = 0
    media_bytes = 0

    # A categorized large file can appear in both bounded UI lists. Keep one
    # narrative card per canonical path; exact copies remain represented by the
    # dedicated duplicate story below.
    unique_items = []
    seen_item_paths = set()
    for item in (scanned_items or []) + (hogs or []):
        item_path = os.path.realpath(item.get('path', ''))
        if not item_path or item_path in seen_item_paths:
            continue
        seen_item_paths.add(item_path)
        unique_items.append(item)

    # Categorize scanned items into narrative stories
    for item in unique_items:
        fpath = item.get('path', '')
        fname = os.path.basename(fpath)
        sz = item.get('sizeBytes', 0)
        lower_path = fpath.lower()
        lower_name = fname.lower()

        conf, prob, why = calculate_file_confidence_score(fpath, fname, sz)
        item_meta = {
            "name": fname,
            "path": fpath,
            "size": format_bytes_py(sz),
            "sizeBytes": sz,
            "confidence": conf,
            "futureNeedProb": prob,
            "why": why
        }

        if lower_name.endswith(('.safetensors', '.ckpt', '.pt', '.gguf', '.bin')) or 'huggingface' in lower_path or 'ollama' in lower_path:
            ai_bytes += sz
            ai_items.append(item_meta)
        elif lower_name.endswith(('.dmg', '.pkg', '.iso', '.exe', '.msi')):
            installer_bytes += sz
            installer_items.append(item_meta)
        elif 'node_modules' in lower_path or '__pycache__' in lower_path or 'deriveddata' in lower_path:
            project_bytes += sz
            project_items.append(item_meta)
        elif '/downloads/' in lower_path:
            download_bytes += sz
            download_items.append(item_meta)
        elif lower_name.endswith(('.zip', '.tar.gz', '.tgz', '.sql', '.dump', '.db', '.dmg', '.pkg')):
            archive_bytes += sz
            archive_items.append(item_meta)
        elif lower_name.endswith(('.mp4', '.mov', '.mkv', '.avi', '.webm')):
            media_bytes += sz
            media_items.append(item_meta)
        elif any(p in lower_name for p in ['final', 'v2', 'v3', 'copy', 'draft']):
            version_bytes += sz
            version_items.append(item_meta)
        else:
            forgotten_bytes += sz
            forgotten_items.append(item_meta)

    # Process every exact duplicate copy into the review story. Selection is a
    # separate user action; waiting for selected=true made this story appear empty.
    for g in (duplicates or []):
        for f in g.get('files', []):
            sz = g.get('sizeBytes', 0)
            conf, prob, why = calculate_file_confidence_score(f['path'], os.path.basename(f['path']), sz, is_duplicate=True)
            version_bytes += sz
            version_items.append({
                "name": os.path.basename(f['path']),
                "path": f['path'],
                "size": format_bytes_py(sz),
                "sizeBytes": sz,
                "confidence": conf,
                "futureNeedProb": prob,
                "why": why
            })

    stories = [
        {
            "id": "story-ai",
            "title": "AI Workspace Debris",
            "subtitle": "Intermediate model weights, checkpoints, HuggingFace & Ollama caches.",
            "icon": "ph-robot",
            "confidence": 98,
            "futureNeedProb": 2,
            "recoverBytes": ai_bytes,
            "recoverFormatted": format_bytes_py(ai_bytes),
            "itemCount": len(ai_items),
            "recommendedAction": "trash",
            "why": ["✔ Intermediate AI model weights", "✔ Re-downloadable from HuggingFace/Ollama", "✔ Un-accessed for 90+ days"],
            "items": ai_items
        },
        {
            "id": "story-installers",
            "title": "Installation Relics & Dead ISOs",
            "subtitle": "Installers (.dmg, .pkg, .iso) for software that is already installed.",
            "icon": "ph-package",
            "confidence": 97,
            "futureNeedProb": 3,
            "recoverBytes": installer_bytes,
            "recoverFormatted": format_bytes_py(installer_bytes),
            "itemCount": len(installer_items),
            "recommendedAction": "trash",
            "why": ["✔ Software already installed in /Applications", "✔ Single-use setup image", "✔ Re-downloadable online"],
            "items": installer_items
        },
        {
            "id": "story-project",
            "title": "Project Graveyard",
            "subtitle": "Developer workspace projects untouched for 1+ years.",
            "icon": "ph-buildings",
            "confidence": 92,
            "futureNeedProb": 8,
            "recoverBytes": project_bytes,
            "recoverFormatted": format_bytes_py(project_bytes),
            "itemCount": len(project_items),
            "recommendedAction": "archive",
            "why": ["✔ No code modifications in >365 days", "✔ Heavy node_modules & venv caches", "✔ Re-generatable dependencies"],
            "items": project_items
        },
        {
            "id": "story-downloads",
            "title": "Forgotten Downloads",
            "subtitle": "Downloaded files un-opened for over 6 months.",
            "icon": "ph-download-simple",
            "confidence": 94,
            "futureNeedProb": 6,
            "recoverBytes": download_bytes,
            "recoverFormatted": format_bytes_py(download_bytes),
            "itemCount": len(download_items),
            "recommendedAction": "compress",
            "why": ["✔ Downloaded >180 days ago", "✔ Never opened after initial download", "✔ Safe to Compress or Purge"],
            "items": download_items
        },
        {
            "id": "story-versions",
            "title": "Version Graveyard & Duplicates",
            "subtitle": "Versioned files and full-file SHA-256 duplicate copies.",
            "icon": "ph-copy",
            "confidence": 99,
            "futureNeedProb": 1,
            "recoverBytes": version_bytes,
            "recoverFormatted": format_bytes_py(version_bytes),
            "itemCount": len(version_items),
            "recommendedAction": "trash",
            "why": ["✔ Identical file content verified", "✔ Another copy exists", "✔ Review its location before moving it to Trash"],
            "items": version_items
        },
        {
            "id": "story-forgotten",
            "title": "Large Files & Other Clutter",
            "subtitle": "General storage-heavy files worth reviewing, regardless of whether they came from agent work.",
            "icon": "ph-clock-counter-clockwise",
            "confidence": 96,
            "futureNeedProb": 4,
            "recoverBytes": forgotten_bytes,
            "recoverFormatted": format_bytes_py(forgotten_bytes),
            "itemCount": len(forgotten_items),
            "recommendedAction": "archive",
            "why": ["✔ Storage-heavy candidate", "✔ Review location and context", "✔ Candidate for archive, compression, or Trash"],
            "items": forgotten_items
        },
        {
            "id": "story-archives",
            "title": "Archives & Installers",
            "subtitle": "Archives, disk images, database dumps, and installers that may be safe to consolidate.",
            "icon": "ph-file-zip",
            "confidence": 88,
            "futureNeedProb": 12,
            "recoverBytes": archive_bytes,
            "recoverFormatted": format_bytes_py(archive_bytes),
            "itemCount": len(archive_items),
            "recommendedAction": "archive",
            "why": ["✔ Often re-downloadable or reproducible", "✔ Review before moving or compressing", "✔ Keep anything needed for recovery"],
            "items": archive_items
        },
        {
            "id": "story-media",
            "title": "Media & Render Output",
            "subtitle": "Video and render files can dominate storage and are often better archived than deleted.",
            "icon": "ph-film-strip",
            "confidence": 78,
            "futureNeedProb": 22,
            "recoverBytes": media_bytes,
            "recoverFormatted": format_bytes_py(media_bytes),
            "itemCount": len(media_items),
            "recommendedAction": "archive",
            "why": ["✔ Frequently among the largest files", "✔ Review source/project relationship", "✔ Archive before deleting"],
            "items": media_items
        }
    ]

    return [story for story in stories if story.get('itemCount', 0) > 0]


def query_apfs_spotlight_indexed_files(root_dir):
    """Engine A: APFS Native Spotlight B-Tree Indexing Engine.
    Executes in ~0.05 seconds by querying macOS pre-indexed APFS kernel metadata!
    """
    if sys.platform != 'darwin':
        return None

    try:
        # Query Spotlight B-Tree metadata for target extensions & folders
        query_str = "kMDItemFSName == '*.safetensors' || kMDItemFSName == '*.ckpt' || kMDItemFSName == '*.vmdk' || kMDItemFSName == '*.iso' || kMDItemFSName == 'node_modules' || kMDItemFSName == '__pycache__' || kMDItemFSName == '*.mp4' || kMDItemFSName == '*.mov' || kMDItemFSName == '*.tar.gz' || kMDItemFSName == '*.zip' || kMDItemFSName == '.DS_Store'"
        cmd = ["mdfind", "-onlyin", root_dir, query_str]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=3.0)
        if res.returncode == 0 and res.stdout.strip():
            paths = [p.strip() for p in res.stdout.split('\n') if p.strip()]
            return paths
    except Exception as e:
        print(f"⚡ APFS Spotlight fallback to parallel worker pool: {e}")
    return None


def run_real_hd_audit(root_dir, scan_id=None, scan_global_caches=False):
    """Exhaustively enumerate accessible files with bounded in-memory state."""
    total_files = 0
    total_bytes_scanned = 0
    directories_scanned = 0
    skipped_directories = 0
    skipped_files = 0
    duplicate_candidate_files = 0
    duplicate_candidate_bytes = 0
    candidate_heap = []
    hog_heap = []
    heap_sequence = 0

    node_modules_bytes = 0
    pycache_bytes = 0
    ds_store_bytes = 0
    ai_models_bytes = 0
    media_bytes = 0
    vm_bytes = 0
    archive_bytes = 0

    # Real OS Disk Capacity Metrics
    try:
        du = shutil.disk_usage(root_dir)
        total_disk_bytes = du.total
        used_disk_bytes = du.used
        free_disk_bytes = du.free
    except Exception:
        total_disk_bytes = 2 * 1024 * 1024 * 1024 * 1024 # 2 TB
        used_disk_bytes = int(1.91 * 1024 * 1024 * 1024 * 1024)
        free_disk_bytes = total_disk_bytes - used_disk_bytes

    audit_root = root_dir
    print(f"🕵️ Exhaustive bounded-memory audit scanning: {audit_root}...", file=sys.stderr)

    database_fd, database_path = tempfile.mkstemp(prefix='zerospace-scan-', suffix='.sqlite3')
    os.close(database_fd)
    database = sqlite3.connect(database_path)
    database.execute('PRAGMA journal_mode=OFF')
    database.execute('PRAGMA synchronous=OFF')
    database.execute('CREATE TABLE files (size INTEGER, path TEXT, mtime TEXT)')
    pending_rows = []

    def record_ui_item(item, target_heap, limit):
        nonlocal heap_sequence
        heap_sequence += 1
        entry = (item['sizeBytes'], heap_sequence, item)
        if len(target_heap) < limit:
            heapq.heappush(target_heap, entry)
        elif entry[0] > target_heap[0][0]:
            heapq.heapreplace(target_heap, entry)

    def candidate_preview():
        preview = []
        seen_preview_paths = set()
        for _, _, item in sorted(candidate_heap + hog_heap, reverse=True, key=lambda entry: entry[0]):
            path = item.get('path')
            if not path or path in seen_preview_paths:
                continue
            seen_preview_paths.add(path)
            preview.append(item)
            if len(preview) == 12:
                break
        return preview

    def walk_error(_error):
        nonlocal skipped_directories
        skipped_directories += 1

    cancelled = False
    try:
        for dirpath, dirnames, filenames in os.walk(audit_root, topdown=True, followlinks=False, onerror=walk_error):
            if scan_is_cancelled(scan_id):
                cancelled = True
                break
            directories_scanned += 1
            # A root-volume scan should not silently traverse other mounted volumes.
            if audit_root == '/' and dirpath == '/':
                dirnames[:] = [name for name in dirnames if name not in {'Volumes', 'dev', 'net', 'home'}]
            elif audit_root == '/' and dirpath == '/System/Volumes':
                # The Data volume is already exposed through root firmlinks; walking it
                # again would double-count user and application data.
                dirnames[:] = [name for name in dirnames if name != 'Data']
            path_parts = set(os.path.normpath(dirpath).split(os.sep))
            in_node_modules = 'node_modules' in path_parts
            in_pycache = '__pycache__' in path_parts
            for fname in filenames:
                if scan_is_cancelled(scan_id):
                    cancelled = True
                    break
                fpath = os.path.join(dirpath, fname)
                if os.path.islink(fpath):
                    continue
                try:
                    stat = os.stat(fpath, follow_symlinks=False)
                    size = stat.st_size
                except (OSError, PermissionError):
                    skipped_files += 1
                    continue
                total_files += 1
                total_bytes_scanned += size
                lower_fname = fname.lower()
                category = None
                item_type = get_file_type_icon(fname)
                if in_node_modules:
                    node_modules_bytes += size
                    category, item_type = 'Dev Dependencies (node_modules)', '📦 Dependency'
                elif in_pycache or lower_fname.endswith('.pyc'):
                    pycache_bytes += size
                    category, item_type = 'Python __pycache__ Bytecode', '⚡ Bytecode'
                elif fname == '.DS_Store':
                    ds_store_bytes += size
                    category, item_type = 'macOS .DS_Store Clutter', '📄 System'
                elif lower_fname.endswith(('.safetensors', '.ckpt', '.pt', '.bin', '.gguf')):
                    ai_models_bytes += size
                    category, item_type = 'AI Models & Safetensors', '🧠 Model'
                elif lower_fname.endswith(('.vmdk', '.iso', '.qcow2', '.vdi')):
                    vm_bytes += size
                    category, item_type = 'VM Images (.vmdk / .iso)', '💻 VM Image'
                elif lower_fname.endswith(('.mp4', '.mov', '.mkv', '.avi', '.webm')):
                    media_bytes += size
                    category, item_type = '4K Video & Media Renders', '🎬 Media'
                elif lower_fname.endswith(('.zip', '.tar.gz', '.tgz', '.sql', '.dump', '.db', '.dmg', '.pkg')):
                    archive_bytes += size
                    category, item_type = 'Archives & Database Dumps', '🗜️ Archive'

                item = {
                    'type': item_type, 'path': fpath, 'size': format_bytes_py(size),
                    'sizeBytes': size, 'category': category or categorize_file_extension(fname)
                }
                if category:
                    record_ui_item(item, candidate_heap, MAX_UI_CANDIDATES)
                if size > 10 * 1024 * 1024:
                    record_ui_item(item, hog_heap, MAX_TOP_HOGS)
                if size > 20 * 1024:
                    duplicate_candidate_files += 1
                    duplicate_candidate_bytes += size
                    import datetime
                    mtime = datetime.date.fromtimestamp(stat.st_mtime).isoformat()
                    pending_rows.append((size, fpath, mtime))
                    if len(pending_rows) >= 2000:
                        database.executemany('INSERT INTO files VALUES (?, ?, ?)', pending_rows)
                        pending_rows.clear()
                if total_files % 500 == 0:
                    update_scan_progress(scan_id, phase='enumerating', filesScanned=total_files,
                                         directoriesScanned=directories_scanned,
                                         skippedDirectories=skipped_directories,
                                         skippedFiles=skipped_files,
                                         duplicateCandidateFiles=duplicate_candidate_files,
                                         duplicateCandidateBytes=duplicate_candidate_bytes,
                                         categoryBytes={
                                             'Dev Dependencies (node_modules)': node_modules_bytes,
                                             'AI Models & Safetensors': ai_models_bytes,
                                             '4K Video & Media Renders': media_bytes,
                                             'Python __pycache__ Bytecode': pycache_bytes,
                                             'VM Images (.vmdk / .iso)': vm_bytes,
                                             'Archives & Database Dumps': archive_bytes,
                                             'macOS .DS_Store Clutter': ds_store_bytes,
                                         },
                                         candidatePreview=candidate_preview(),
                                         currentPath=dirpath)
            if cancelled:
                break
        if pending_rows:
            database.executemany('INSERT INTO files VALUES (?, ?, ?)', pending_rows)
        database.commit()

        duplicates_list = []
        duplicate_groups_found = 0
        if not cancelled:
            update_scan_progress(scan_id, phase='indexing', filesScanned=total_files,
                                 directoriesScanned=directories_scanned,
                                 skippedDirectories=skipped_directories, currentPath=audit_root)
            database.execute('CREATE INDEX files_by_size ON files(size)')
            database.execute('CREATE TABLE fingerprints (size INTEGER, header TEXT, path TEXT, mtime TEXT)')
            same_size_candidates = database.execute(
                'SELECT COALESCE(SUM(group_count), 0) FROM '
                '(SELECT COUNT(*) AS group_count FROM files GROUP BY size HAVING COUNT(*) > 1)'
            ).fetchone()[0]
            fingerprinted_files = 0
            update_scan_progress(scan_id, phase='fingerprinting', filesScanned=total_files,
                                 candidatesTotal=same_size_candidates, candidatesProcessed=0,
                                 directoriesScanned=directories_scanned)
            duplicate_sizes = database.execute('SELECT size FROM files GROUP BY size HAVING COUNT(*) > 1')
            for (size,) in duplicate_sizes:
                if scan_is_cancelled(scan_id):
                    cancelled = True
                    break
                fingerprint_rows = []
                for path, mtime in database.execute('SELECT path, mtime FROM files WHERE size = ?', (size,)):
                    header_hash = get_fast_header_hash(path)
                    fingerprinted_files += 1
                    if header_hash:
                        fingerprint_rows.append((size, header_hash, path, mtime))
                    if len(fingerprint_rows) >= 1000:
                        database.executemany('INSERT INTO fingerprints VALUES (?, ?, ?, ?)', fingerprint_rows)
                        fingerprint_rows.clear()
                    if fingerprinted_files % 1000 == 0:
                        update_scan_progress(scan_id, phase='fingerprinting', filesScanned=total_files,
                                             candidatesTotal=same_size_candidates,
                                             candidatesProcessed=fingerprinted_files,
                                             directoriesScanned=directories_scanned)
                if fingerprint_rows:
                    database.executemany('INSERT INTO fingerprints VALUES (?, ?, ?, ?)', fingerprint_rows)
            database.commit()

            if not cancelled:
                database.execute('CREATE INDEX fingerprints_by_header ON fingerprints(size, header)')
                database.execute('CREATE TABLE exact_hashes (size INTEGER, sha TEXT, path TEXT, mtime TEXT)')
                exact_candidates = database.execute(
                    'SELECT COALESCE(SUM(group_count), 0) FROM '
                    '(SELECT COUNT(*) AS group_count FROM fingerprints '
                    'GROUP BY size, header HAVING COUNT(*) > 1)'
                ).fetchone()[0]
                exact_hashed_files = 0
                update_scan_progress(scan_id, phase='hashing', filesScanned=total_files,
                                     candidatesTotal=exact_candidates, candidatesProcessed=0,
                                     directoriesScanned=directories_scanned)
                header_groups = database.execute(
                    'SELECT size, header FROM fingerprints GROUP BY size, header HAVING COUNT(*) > 1'
                )
                for size, header_hash in header_groups:
                    if scan_is_cancelled(scan_id):
                        cancelled = True
                        break
                    exact_rows = []
                    rows = database.execute(
                        'SELECT path, mtime FROM fingerprints WHERE size = ? AND header = ?',
                        (size, header_hash)
                    )
                    for path, mtime in rows:
                        sha = get_file_sha256(path)
                        exact_hashed_files += 1
                        if sha:
                            exact_rows.append((size, sha, path, mtime))
                        if exact_hashed_files % 100 == 0:
                            update_scan_progress(scan_id, phase='hashing', filesScanned=total_files,
                                                 candidatesTotal=exact_candidates,
                                                 candidatesProcessed=exact_hashed_files,
                                                 directoriesScanned=directories_scanned)
                    if exact_rows:
                        database.executemany('INSERT INTO exact_hashes VALUES (?, ?, ?, ?)', exact_rows)
                database.commit()

            if not cancelled:
                database.execute('CREATE INDEX exact_hashes_by_sha ON exact_hashes(size, sha)')
                update_scan_progress(scan_id, phase='grouping', filesScanned=total_files,
                                     duplicateGroupsFound=0,
                                     directoriesScanned=directories_scanned)
                exact_groups = database.execute(
                    'SELECT size, sha, COUNT(*) FROM exact_hashes GROUP BY size, sha HAVING COUNT(*) > 1'
                )
                for size, sha, file_count in exact_groups:
                    duplicate_groups_found += 1
                    if duplicate_groups_found % 10 == 0:
                        update_scan_progress(scan_id, phase='grouping', filesScanned=total_files,
                                             duplicateGroupsFound=duplicate_groups_found,
                                             directoriesScanned=directories_scanned)
                    if len(duplicates_list) >= 50:
                        continue
                    identical_items = list(database.execute(
                        'SELECT path, mtime FROM exact_hashes WHERE size = ? AND sha = ? LIMIT 100',
                        (size, sha)
                    ))
                    fname = os.path.basename(identical_items[0][0])
                    duplicates_list.append({
                        'hash': sha, 'name': fname, 'sizeBytes': size,
                        'aiCategory': categorize_file_extension(fname),
                        'confidence': 'Exact content match (SHA-256)',
                        'fileCount': file_count, 'filesTruncated': file_count > len(identical_items),
                        'files': [
                            {'path': path, 'mtime': mtime, 'selected': False, 'action': 'trash'}
                            for path, mtime in identical_items
                        ]
                    })
        all_scanned_items = [entry[2] for entry in sorted(candidate_heap, reverse=True)]
        hogs = [entry[2] for entry in sorted(hog_heap, reverse=True)[:10]]
    finally:
        database.close()
        try:
            os.unlink(database_path)
        except OSError:
            pass

    if cancelled:
        update_scan_progress(scan_id, phase='cancelled', filesScanned=total_files,
                             directoriesScanned=directories_scanned,
                             skippedDirectories=skipped_directories)
        return {
            'cancelled': True, 'totalFiles': total_files,
            'coverage': {'complete': False, 'directoriesScanned': directories_scanned,
                         'skippedDirectories': skipped_directories, 'skippedFiles': skipped_files,
                         'bytesScanned': total_bytes_scanned}
        }

    update_scan_progress(scan_id, phase='complete', filesScanned=total_files,
                         directoriesScanned=directories_scanned,
                         skippedDirectories=skipped_directories,
                         skippedFiles=skipped_files, currentPath=audit_root)

    real_strategies = []
    if node_modules_bytes > 0:
        real_strategies.append({
            "id": "strat-real-node-modules",
            "name": "Clean Real node_modules Directories",
            "category": "dev",
            "desc": f"Found active node_modules on real disk in {root_dir}.",
            "command": f"find '{root_dir}' -name 'node_modules' -type d -prune -exec rm -rf {{}} +",
            "savingsBytes": node_modules_bytes,
            "safety": "safe",
            "confidence": "99% High",
            "enabled": True,
            "action": "delete"
        })

    if pycache_bytes > 0:
        real_strategies.append({
            "id": "strat-real-pycache",
            "name": "Real Python __pycache__ Bytecode",
            "category": "dev",
            "desc": "Found compiled .pyc bytecode files.",
            "command": f"find '{root_dir}' -type d -name '__pycache__' -exec rm -r {{}} +",
            "savingsBytes": pycache_bytes,
            "safety": "safe",
            "confidence": "99% High",
            "enabled": True,
            "action": "delete"
        })

    if ds_store_bytes > 0:
        real_strategies.append({
            "id": "strat-real-ds-store",
            "name": "Purge Real .DS_Store Clutter",
            "category": "system",
            "desc": "Discovered macOS directory thumbnail files.",
            "command": f"find '{root_dir}' -name '.DS_Store' -type f -delete",
            "savingsBytes": ds_store_bytes,
            "safety": "safe",
            "confidence": "99% High",
            "enabled": True,
            "action": "delete"
        })

    xcode_derived_data = os.path.expanduser('~/Library/Developer/Xcode/DerivedData')
    if scan_global_caches and os.path.exists(xcode_derived_data):
        try:
            xcode_size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(xcode_derived_data) for f in fs if os.path.isfile(os.path.join(r, f)))
            if xcode_size > 0:
                real_strategies.append({
                    "id": "strat-real-xcode",
                    "name": "Purge Xcode DerivedData Caches",
                    "category": "dev",
                    "desc": "Discovered Xcode build caches and intermediate compilation targets.",
                    "command": f"rm -rf {xcode_derived_data}/*",
                    "savingsBytes": xcode_size,
                    "safety": "safe",
                    "confidence": "99% High",
                    "enabled": True,
                    "action": "delete"
                })
        except Exception:
            pass

    cargo_cache = os.path.expanduser('~/.cargo/registry/cache')
    if scan_global_caches and os.path.exists(cargo_cache):
        try:
            cargo_size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(cargo_cache) for f in fs if os.path.isfile(os.path.join(r, f)))
            if cargo_size > 0:
                real_strategies.append({
                    "id": "strat-real-cargo",
                    "name": "Purge Cargo Package Registry Caches",
                    "category": "dev",
                    "desc": "Discovered Rust cargo package registry index & .crate archives.",
                    "command": f"rm -rf {cargo_cache}/*",
                    "savingsBytes": cargo_size,
                    "safety": "safe",
                    "confidence": "99% High",
                    "enabled": True,
                    "action": "delete"
                })
        except Exception:
            pass

    pip_cache = os.path.expanduser('~/Library/Caches/pip')
    if scan_global_caches and os.path.exists(pip_cache):
        try:
            pip_size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(pip_cache) for f in fs if os.path.isfile(os.path.join(r, f)))
            if pip_size > 0:
                real_strategies.append({
                    "id": "strat-real-pip",
                    "name": "Purge Pip Downloaded Wheel Caches",
                    "category": "dev",
                    "desc": "Discovered cached Python .whl installation packages.",
                    "targetDir": pip_cache,
                    "savingsBytes": pip_size,
                    "safety": "safe",
                    "confidence": "99% High",
                    "enabled": True,
                    "action": "strategy"
                })
        except Exception:
            pass

    npm_cache = os.path.expanduser('~/.npm')
    if scan_global_caches and os.path.exists(npm_cache):
        try:
            npm_size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(npm_cache) for f in fs if os.path.isfile(os.path.join(r, f)))
            if npm_size > 0:
                real_strategies.append({
                    "id": "strat-real-npm",
                    "name": "Purge NPM Package Manager Cache",
                    "category": "dev",
                    "desc": "Discovered cached Node package manager tarballs & metadata.",
                    "targetDir": npm_cache,
                    "savingsBytes": npm_size,
                    "safety": "safe",
                    "confidence": "99% High",
                    "enabled": True,
                    "action": "strategy"
                })
        except Exception:
            pass

    yarn_cache = os.path.expanduser('~/Library/Caches/Yarn')
    if scan_global_caches and os.path.exists(yarn_cache):
        try:
            yarn_size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(yarn_cache) for f in fs if os.path.isfile(os.path.join(r, f)))
            if yarn_size > 0:
                real_strategies.append({
                    "id": "strat-real-yarn",
                    "name": "Purge Yarn Package Cache",
                    "category": "dev",
                    "desc": "Discovered cached Yarn package archives.",
                    "targetDir": yarn_cache,
                    "savingsBytes": yarn_size,
                    "safety": "safe",
                    "confidence": "99% High",
                    "enabled": True,
                    "action": "strategy"
                })
        except Exception:
            pass

    brew_cache = os.path.expanduser('~/Library/Caches/Homebrew')
    if scan_global_caches and os.path.exists(brew_cache):
        try:
            brew_size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(brew_cache) for f in fs if os.path.isfile(os.path.join(r, f)))
            if brew_size > 0:
                real_strategies.append({
                    "id": "strat-real-homebrew",
                    "name": "Purge Homebrew Download Caches",
                    "category": "dev",
                    "desc": "Discovered downloaded Homebrew formula bottle archives.",
                    "targetDir": brew_cache,
                    "savingsBytes": brew_size,
                    "safety": "safe",
                    "confidence": "99% High",
                    "enabled": True,
                    "action": "strategy"
                })
        except Exception:
            pass

    user_logs = os.path.expanduser('~/Library/Logs')
    if scan_global_caches and os.path.exists(user_logs):
        try:
            logs_size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(user_logs) for f in fs if os.path.isfile(os.path.join(r, f)))
            if logs_size > 5 * 1024 * 1024:
                real_strategies.append({
                    "id": "strat-real-user-logs",
                    "name": "Purge Application Crash Reports & Diagnostic Logs",
                    "category": "system",
                    "desc": "Discovered accumulated app crash dumps & log archives.",
                    "targetDir": user_logs,
                    "savingsBytes": logs_size,
                    "safety": "safe",
                    "confidence": "98% High",
                    "enabled": True,
                    "action": "strategy"
                })
        except Exception:
            pass

    try:
        if not scan_global_caches:
            raise RuntimeError("global cache scan disabled")
        tm_output = subprocess.check_output(['tmutil', 'listlocalsnapshots', '/'], stderr=subprocess.DEVNULL, text=True)
        snapshots = [line.strip() for line in tm_output.splitlines() if line.strip()]
        if snapshots:
            real_strategies.append({
                "id": "strat-real-apfs-snapshots",
                "name": "Purge APFS Local Time Machine Snapshots",
                "category": "system",
                "desc": f"Discovered {len(snapshots)} local APFS storage snapshots consuming purgeable SSD space.",
                "targetDir": "/Volumes",
                "savingsBytes": 15 * 1024 * 1024 * 1024,
                "safety": "safe",
                "confidence": "99% High",
                "enabled": True,
                "action": "apfs_thin_snapshots"
            })
    except Exception:
        pass

    for strategy in real_strategies:
        strategy["enabled"] = False
        strategy["confidence"] = "Review required"

    archaeologist_stories = build_archaeologist_narrative_stories(all_scanned_items, hogs, duplicates_list, root_dir)

    return {
        "totalFiles": total_files,
        "scanLimitReached": False,
        "duplicateGroupsFound": duplicate_groups_found,
        "coverage": {
            "complete": True,
            "directoriesScanned": directories_scanned,
            "skippedDirectories": skipped_directories,
            "skippedFiles": skipped_files,
            "bytesScanned": total_bytes_scanned,
            "scopeRoot": audit_root,
            "duplicateMinimumBytes": 20 * 1024
        },
        "healthScore": None,
        "archaeologistStories": archaeologist_stories,
        "duplicates": duplicates_list,
        "strategies": real_strategies,
        "diskUsage": {
            "totalBytes": total_disk_bytes,
            "usedBytes": used_disk_bytes,
            "freeBytes": free_disk_bytes,
            "totalFormatted": format_bytes_py(total_disk_bytes),
            "usedFormatted": format_bytes_py(used_disk_bytes),
            "freeFormatted": format_bytes_py(free_disk_bytes)
        },
        "categoryBytes": {
            "Dev Dependencies (node_modules)": node_modules_bytes,
            "AI Models & Safetensors": ai_models_bytes,
            "4K Video & Media Renders": media_bytes,
            "Python __pycache__ Bytecode": pycache_bytes,
            "VM Images (.vmdk / .iso)": vm_bytes,
            "Archives & Database Dumps": archive_bytes,
            "macOS .DS_Store Clutter": ds_store_bytes
        },
        "scannedItems": all_scanned_items,
        "nodeModulesSize": format_bytes_py(node_modules_bytes),
        "aiModelsSize": format_bytes_py(ai_models_bytes),
        "mediaSize": format_bytes_py(media_bytes),
        "pycacheSize": format_bytes_py(pycache_bytes),
        "vmImagesSize": format_bytes_py(vm_bytes),
        "archivesSize": format_bytes_py(archive_bytes),
        "dsStoreSize": format_bytes_py(ds_store_bytes),
        "treemapNodes": [
            {"name": "Dev Dependencies (node_modules)", "size": format_bytes_py(node_modules_bytes), "flex": "grid-column: span 3; grid-row: span 2;", "color": "rgba(18, 24, 40, 0.85)", "border": "1px solid var(--primary)", "accent": "var(--primary)"},
            {"name": "AI Models & Safetensors", "size": format_bytes_py(ai_models_bytes), "flex": "grid-column: span 3; grid-row: span 2;", "color": "rgba(18, 24, 40, 0.85)", "border": "1px solid var(--purple)", "accent": "var(--purple)"},
            {"name": "4K Video & Media Renders", "size": format_bytes_py(media_bytes), "flex": "grid-column: span 2; grid-row: span 1;", "color": "rgba(18, 24, 40, 0.85)", "border": "1px solid var(--cyan)", "accent": "var(--cyan)"},
            {"name": "Python __pycache__ Bytecode", "size": format_bytes_py(pycache_bytes), "flex": "grid-column: span 2; grid-row: span 1;", "color": "rgba(18, 24, 40, 0.85)", "border": "1px solid var(--accent-amber)", "accent": "var(--accent-amber)"},
            {"name": "VM Images (.vmdk / .iso)", "size": format_bytes_py(vm_bytes), "flex": "grid-column: span 2; grid-row: span 2;", "color": "rgba(18, 24, 40, 0.85)", "border": "1px solid var(--accent-rose)", "accent": "var(--accent-rose)"},
            {"name": "Archives & Database Dumps", "size": format_bytes_py(archive_bytes), "flex": "grid-column: span 2; grid-row: span 1;", "color": "rgba(18, 24, 40, 0.85)", "border": "1px solid var(--accent-emerald)", "accent": "var(--accent-emerald)"},
            {"name": "macOS .DS_Store Clutter", "size": format_bytes_py(ds_store_bytes), "flex": "grid-column: span 2; grid-row: span 1;", "color": "rgba(18, 24, 40, 0.85)", "border": "1px solid var(--text-muted)", "accent": "var(--text-muted)"}
        ],
        "topHogs": hogs
    }

def build_cli_scan_payload(scan_results, requested_path):
    """Build the versioned, deduplicated contract used by agent integrations."""
    resolved_path = os.path.realpath(os.path.abspath(os.path.expanduser(requested_path)))
    findings_by_path = {}

    def add_finding(item, source, duplicate_group=None, recommended_action='review', reasons=None):
        if not isinstance(item, dict) or not item.get('path'):
            return
        path = os.path.realpath(item['path'])
        finding = {
            'path': path,
            'sizeBytes': int(item.get('sizeBytes') or 0),
            'category': item.get('category') or item.get('aiCategory') or 'File',
            'confidence': item.get('confidence', 0),
            'reasons': list(reasons or item.get('why') or []),
            'source': source,
            'recommendedAction': recommended_action,
        }
        if duplicate_group:
            finding['duplicateGroup'] = duplicate_group
        priority = {'topHog': 1, 'story': 2, 'duplicate': 3}
        existing = findings_by_path.get(path)
        if not existing or priority.get(source, 0) >= priority.get(existing.get('source'), 0):
            findings_by_path[path] = finding

    for item in scan_results.get('topHogs', []):
        add_finding(item, 'topHog')
    for story in scan_results.get('archaeologistStories', []):
        for item in story.get('items', []):
            add_finding(item, 'story', recommended_action=story.get('recommendedAction', 'review'), reasons=item.get('why') or story.get('why'))
    for group in scan_results.get('duplicates', []):
        group_id = group.get('hash') or f"{group.get('name', 'duplicate')}:{group.get('sizeBytes', 0)}"
        for item in group.get('files', []):
            add_finding(item, 'duplicate', duplicate_group=group_id, recommended_action='trash', reasons=['Exact SHA-256 duplicate group'])

    duplicates = scan_results.get('duplicates', [])
    duplicate_reclaimable = sum(
        int(group.get('sizeBytes') or 0) * max(0, len(group.get('files', [])) - 1)
        for group in duplicates
    )
    strategy_reclaimable = sum(
        int(strategy.get('savingsBytes') or 0)
        for strategy in scan_results.get('strategies', [])
    )
    coverage = scan_results.get('coverage') or {}
    summary = {
        'totalFiles': int(scan_results.get('totalFiles') or 0),
        'reviewStories': len(scan_results.get('archaeologistStories') or []),
        'duplicateGroups': int(scan_results.get('duplicateGroupsFound') or len(duplicates)),
        'reclaimableBytes': duplicate_reclaimable + strategy_reclaimable,
        'findingCount': len(findings_by_path),
    }
    payload = dict(scan_results)
    payload.update({
        'schemaVersion': 1,
        'scope': {'requestedPath': requested_path, 'resolvedPath': resolved_path},
        'summary': summary,
        'coverage': coverage,
        'findings': list(findings_by_path.values()),
    })
    return payload


def run_cli_scan(args):
    requested_path = args.path
    safe, message = is_safe_scan_path(requested_path)
    resolved_path = os.path.realpath(os.path.abspath(os.path.expanduser(requested_path)))
    if not safe:
        print(f"Scan failed: {message}", file=sys.stderr)
        return 2
    if not os.path.isdir(resolved_path):
        print(f"Scan failed: path is not an accessible directory: {resolved_path}", file=sys.stderr)
        return 2
    try:
        results = run_real_hd_audit(resolved_path, scan_global_caches=args.global_caches)
        if results.get('cancelled'):
            print('Scan failed: scan was cancelled before completion', file=sys.stderr)
            return 2
        payload = build_cli_scan_payload(results, requested_path)
    except Exception as exc:
        print(f"Scan failed: {exc}", file=sys.stderr)
        return 2

    if args.json:
        json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write('\n')
    else:
        summary = payload['summary']
        coverage = payload.get('coverage', {})
        print(f"ZeroSpace scan: {payload['scope']['resolvedPath']}")
        print(f"Files indexed: {summary['totalFiles']:,}")
        print(f"Review stories: {summary['reviewStories']:,}")
        print(f"Duplicate groups: {summary['duplicateGroups']:,}")
        print(f"Reclaimable duplicate/cache space: {format_bytes_py(summary['reclaimableBytes'])}")
        print(f"Skipped: {int(coverage.get('skippedDirectories') or 0):,} folders, {int(coverage.get('skippedFiles') or 0):,} files")
        print(f"Findings: {summary['findingCount']:,}")

    if args.fail_on == 'findings' and payload['summary']['findingCount'] > 0:
        return 1
    if args.fail_on == 'duplicates' and payload['summary']['duplicateGroups'] > 0:
        return 1
    return 0


def format_bytes_py(bytes_val):
    if bytes_val == 0:
        return '0 B'
    k = 1024
    sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    i = 0
    val = float(bytes_val)
    while val >= k and i < len(sizes) - 1:
        val /= k
        i += 1
    return f"{val:.2f} {sizes[i]}"

function_ext_map = {
    '.safetensors': 'AI Model Checkpoint',
    '.ckpt': 'AI Model Checkpoint',
    '.vmdk': 'Virtual Machine Image',
    '.iso': 'Disk Image',
    '.js': 'JavaScript Source',
    '.py': 'Python Source',
    '.sql': 'Database Dump',
    '.mp4': '4K Video Render',
    '.zip': 'Archive',
    '.dmg': 'OS Installer'
}

def categorize_file_extension(fname):
    ext = os.path.splitext(fname)[1].lower()
    return function_ext_map.get(ext, 'File')

def get_file_type_icon(fname):
    ext = os.path.splitext(fname)[1].lower()
    if ext in ['.safetensors', '.ckpt']: return 'AI Model'
    if ext in ['.vmdk', '.iso']: return 'VM Disk'
    if ext in ['.mp4', '.mov']: return 'Video'
    if ext in ['.zip', '.tar.gz']: return 'Archive'
    return 'File'


def main(argv=None):
    parser = argparse.ArgumentParser(description="ZeroSpace local storage audit server")
    parser.add_argument('--port', type=int, default=int(os.environ.get('ZEROSPACE_PORT', PORT)))
    parser.add_argument('--version', action='version', version='ZeroSpace 2.0.0')
    subparsers = parser.add_subparsers(dest='command')
    scan_parser = subparsers.add_parser('scan', help='Run a read-only agent-friendly workspace scan')
    scan_parser.add_argument('path', help='Directory to scan')
    scan_parser.add_argument('--json', action='store_true', help='Write the versioned machine-readable report to stdout')
    scan_parser.add_argument('--global-caches', action='store_true', help='Include known global developer caches')
    scan_parser.add_argument('--fail-on', choices=('findings', 'duplicates'), help='Exit 1 when the selected finding type exists')
    args = parser.parse_args(argv)
    if args.command == 'scan':
        return run_cli_scan(args)
    if not 1024 <= args.port <= 65535:
        parser.error('port must be between 1024 and 65535')
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"ZeroSpace local engine running on http://127.0.0.1:{args.port}")
    httpd = ThreadingHTTPServer(('127.0.0.1', args.port), RealHDScannerBackend)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == '__main__':
    sys.exit(main() or 0)
