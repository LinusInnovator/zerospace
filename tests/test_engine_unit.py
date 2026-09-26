#!/usr/bin/env python3
"""Standard unit tests for ZeroSpace core engine functions."""

import unittest
import tempfile
import os
import shutil
import threading
from scanner_backend import (
    is_safe_file_path,
    is_safe_scan_path,
    calculate_file_confidence_score,
    format_bytes_py,
    unique_destination,
    get_file_sha256,
    update_scan_progress,
    ACTIVE_SCANS,
    ACTIVE_SCANS_LOCK,
)


class TestZeroSpaceEngineUnit(unittest.TestCase):
    def test_safe_file_path_blocks_system_roots(self):
        blocked_paths = [
            "/", "/System", "/System/Library", "/usr/bin",
            "/bin/sh", "/sbin", "/etc", "/var", "/private"
        ]
        for p in blocked_paths:
            safe, msg = is_safe_file_path(p)
            self.assertFalse(safe, f"Path '{p}' should be blocked")
            self.assertTrue("locked" in msg.lower() or "protected" in msg.lower())

    def test_safe_file_path_blocks_user_security_roots(self):
        user_home = os.path.expanduser("~")
        sensitive = [
            user_home,
            os.path.join(user_home, ".ssh"),
            os.path.join(user_home, ".ssh", "id_rsa"),
            os.path.join(user_home, ".gnupg"),
            os.path.join(user_home, ".config"),
            os.path.join(user_home, "Library"),
        ]
        for p in sensitive:
            safe, msg = is_safe_file_path(p)
            self.assertFalse(safe, f"Sensitive user path '{p}' should be blocked")

    def test_safe_file_path_allows_workspace_files(self):
        with tempfile.TemporaryDirectory(prefix="zerospace_test_safe_", dir=os.path.expanduser("~")) as tmp:
            test_file = os.path.join(tmp, "artifact.zip")
            with open(test_file, "w") as f:
                f.write("test data")
            safe, msg = is_safe_file_path(test_file)
            self.assertTrue(safe, f"Workspace file should be safe, got: {msg}")

    def test_safe_scan_path(self):
        safe, msg = is_safe_scan_path("")
        self.assertFalse(safe)

        with tempfile.TemporaryDirectory(prefix="zerospace_test_scan_", dir=os.path.expanduser("~")) as tmp:
            safe, msg = is_safe_scan_path(tmp)
            self.assertTrue(safe)

    def test_unique_destination_avoids_overwriting(self):
        with tempfile.TemporaryDirectory(prefix="zerospace_test_uniq_", dir=os.path.expanduser("~")) as tmp:
            p1 = os.path.join(tmp, "item.txt")
            with open(p1, "w") as f:
                f.write("1")
            dest = unique_destination(tmp, "item.txt")
            self.assertNotEqual(p1, dest)
            self.assertTrue(dest.startswith(os.path.join(tmp, "item-")))
            self.assertTrue(dest.endswith("-1.txt"))

    def test_format_bytes(self):
        self.assertEqual(format_bytes_py(0), "0 B")
        self.assertEqual(format_bytes_py(1024), "1.00 KB")
        self.assertEqual(format_bytes_py(1024 * 1024 * 5), "5.00 MB")
        self.assertEqual(format_bytes_py(1024 * 1024 * 1024 * 2), "2.00 GB")

    def test_calculate_file_confidence_score(self):
        # AI checkpoint in project with mtime > 3 years (25 + 25 = 50) + duplicate (+40) = 90
        conf, prob, reasons = calculate_file_confidence_score(
            "/Users/test/project/model.safetensors", "model.safetensors", 1000000, mtime_days=1100, is_duplicate=True
        )
        self.assertGreater(conf, 80)
        self.assertEqual(prob, 100 - conf)
        self.assertTrue(any("tensor" in r.lower() for r in reasons))

        # Recent file in documents should receive lower confidence / negative signals
        conf2, prob2, reasons2 = calculate_file_confidence_score(
            "/Users/test/documents/notes.txt", "notes.txt", 500, mtime_days=2
        )
        self.assertLess(conf2, 40)
        self.assertTrue(any("recently modified" in r.lower() for r in reasons2))

    def test_get_file_sha256_computes_exact_hash(self):
        with tempfile.NamedTemporaryFile(prefix="zerospace_hash_", delete=False) as f:
            f.write(b"deterministic content for sha256 test")
            f_path = f.name
        try:
            expected_sha = "41d564c8fa874fde4495985cf78f082d5e86b6ed07129f105da1d52683609253"
            h = get_file_sha256(f_path)
            self.assertEqual(h, expected_sha)
        finally:
            os.remove(f_path)

    def test_get_file_sha256_aborts_on_cancellation(self):
        scan_id = "test_cancel_scan_id"
        cancel_event = threading.Event()
        with ACTIVE_SCANS_LOCK:
            ACTIVE_SCANS[scan_id] = {
                "scanId": scan_id,
                "cancel_event": cancel_event
            }

        with tempfile.NamedTemporaryFile(prefix="zerospace_cancel_", delete=False) as f:
            f.write(b"A" * 1024 * 1024 * 2) # 2MB
            f_path = f.name

        try:
            # Set cancellation before hashing
            cancel_event.set()
            result = get_file_sha256(f_path, scan_id=scan_id)
            self.assertIsNone(result, "get_file_sha256 should abort and return None when scan is cancelled")
        finally:
            os.remove(f_path)
            with ACTIVE_SCANS_LOCK:
                ACTIVE_SCANS.pop(scan_id, None)


if __name__ == "__main__":
    unittest.main()
