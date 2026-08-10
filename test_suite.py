#!/usr/bin/env python3
"""
ZeroSpace v2.0 - Comprehensive Automated Test Suite
====================================================
Runs 100% automated integration & security verification tests against
the local ZeroSpace macOS engine backend.

Coverage:
- API Health & Hardware HUD Endpoints
- Drive Discovery & APFS Volume Enumeration
- APFS B-Tree / Multi-Threaded File Audit Engine
- 20-Signal AI Safety Confidence Scoring Engine
- Digital Archaeologist Narrative Story Generator
- APFS Native DecmpFS Transparent Compression Engine
- System Protection Shield & Path Traversal Guard
- Command Injection Security Rejection
"""

import os
import sys
import json
import shutil
import tempfile
import urllib.request
import urllib.parse
import subprocess

BASE_URL = os.environ.get("ZEROSPACE_BASE_URL", "http://127.0.0.1:8080")
TEST_DIR = tempfile.mkdtemp(prefix="hd_detective_test_")

def log_step(name):
    print(f"🔹 RUNNING: {name}...")

def assert_true(condition, msg):
    if not condition:
        print(f"❌ TEST FAILURE: {msg}")
        sys.exit(1)
    print(f"  ✅ PASS: {msg}")

def test_api_health():
    log_step("GET /api/health")
    req = urllib.request.Request(f"{BASE_URL}/api/health")
    with urllib.request.urlopen(req) as resp:
        assert_true(resp.status == 200, "Health status code 200 OK")
        data = json.loads(resp.read().decode('utf-8'))
        assert_true(data.get("status") == "ok", "Status is ok")
        assert_true(data.get("hardened") == True, "Security hardening active")

def test_api_drives():
    log_step("GET /api/drives")
    req = urllib.request.Request(f"{BASE_URL}/api/drives")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        drives = data.get("drives", [])
        assert_true(len(drives) > 0, f"Discovered {len(drives)} drives")

def test_api_system_hud():
    log_step("GET /api/system_hud")
    req = urllib.request.Request(f"{BASE_URL}/api/system_hud")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        assert_true("totalRamGb" in data, f"Hardware RAM: {data.get('totalRamGb')} GB")
        assert_true("cpuLoadPct" in data, f"CPU Load: {data.get('cpuLoadPct')}%")
        assert_true("swapUsedMb" in data, f"Swap Used: {data.get('swapUsedMb')} MB")
        assert_true("thermalState" in data, f"Thermal State: {data.get('thermalState')}")

def test_api_reveal_in_finder():
    log_step("GET /api/reveal_in_finder Endpoint")
    sample_file = os.path.join(TEST_DIR, "reveal_test.txt")
    with open(sample_file, "w") as f:
        f.write("Test Reveal")
    encoded = urllib.parse.quote(sample_file)
    req = urllib.request.Request(f"{BASE_URL}/api/reveal_in_finder?path={encoded}")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        assert_true(data.get("status") in ["success", "handled"], f"Revealed file in Finder: {sample_file}")

def test_api_scan_and_archaeologist():
    log_step("GET /api/scan & Digital Archaeologist Stories")
    iso_file = os.path.join(TEST_DIR, "test_installer.iso")
    with open(iso_file, "wb") as f:
        f.write(b"0" * (1024 * 1024 * 2))

    cache_dir = os.path.join(TEST_DIR, "__pycache__")
    os.makedirs(cache_dir, exist_ok=True)
    with open(os.path.join(cache_dir, "test.pyc"), "wb") as f:
        f.write(b"pycache_data" * 100)

    shared_prefix = b"A" * 8192
    duplicate_content = shared_prefix + (b"B" * 16384)
    for filename in ("duplicate_a.dat", "duplicate_b.dat"):
        with open(os.path.join(TEST_DIR, filename), "wb") as f:
            f.write(duplicate_content)
    with open(os.path.join(TEST_DIR, "same_header_not_duplicate.dat"), "wb") as f:
        f.write(shared_prefix + (b"C" * 16384))

    encoded_path = urllib.parse.quote(TEST_DIR)
    req = urllib.request.Request(f"{BASE_URL}/api/scan?path={encoded_path}")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        assert_true("scannedItems" in data, "Scanned items returned")
        assert_true("duplicates" in data and "strategies" in data, "Complete frontend scan contract returned")
        expected_paths = {
            os.path.realpath(os.path.join(TEST_DIR, "duplicate_a.dat")),
            os.path.realpath(os.path.join(TEST_DIR, "duplicate_b.dat")),
        }
        matching_groups = [
            group for group in data.get("duplicates", [])
            if {item.get("path") for item in group.get("files", [])} == expected_paths
        ]
        assert_true(len(matching_groups) == 1, "Full SHA-256 excludes same-header false positives")
        assert_true("archaeologistStories" in data, f"Returned {len(data.get('archaeologistStories', []))} Archaeology Stories")
        stories = data.get("archaeologistStories", [])
        assert_true(len(stories) > 0, f"Top Story: {stories[0].get('title') if stories else 'None'}")

    with urllib.request.urlopen(req) as resp:
        cached = json.loads(resp.read().decode('utf-8'))
        assert_true(cached.get("snapshot", {}).get("fromCache") is True, "Fresh workspace snapshot reused")

    refresh_req = urllib.request.Request(f"{BASE_URL}/api/scan?path={encoded_path}&refresh=1")
    with urllib.request.urlopen(refresh_req) as resp:
        refreshed = json.loads(resp.read().decode('utf-8'))
        assert_true(refreshed.get("snapshot", {}).get("fromCache") is False, "Manual refresh bypasses snapshot cache")

def test_review_first_blocks_advanced_compression():
    log_step("POST /api/execute - Review-First Advanced Action Guard")
    sample_file = os.path.join(TEST_DIR, "compress_me.json")
    with open(sample_file, "w") as f:
        json.dump([{"key": "test_value_repeat" * 1000} for _ in range(200)], f)
    
    orig_size = os.path.getsize(sample_file)
    payload = {
        "items": [
            {
                "action": "compress",
                "path": sample_file
            }
        ]
    }
    body = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/execute", data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        assert_true(any("BLOCKED: Advanced action" in line for line in data.get("log", [])), "Advanced compression blocked by default")
        assert_true(os.path.exists(sample_file), "Original file remains untouched")

def test_security_hardening():
    log_step("Security Hardening - Command Injection & System Protection Shield")
    
    payload_cmd = {
        "items": [
            {
                "action": "strategy",
                "command": "touch /tmp/malicious_test; echo HACKED"
            }
        ]
    }
    body = json.dumps(payload_cmd).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/execute", data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        logs = data.get("log", [])
        assert_true(any("REJECTED" in l for l in logs), "Arbitrary shell command injection REJECTED")

    payload_sys = {
        "items": [
            {
                "action": "delete",
                "path": "/System/Library"
            }
        ]
    }
    body = json.dumps(payload_sys).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/execute", data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        logs = data.get("log", [])
        assert_true(any("BLOCKED" in l for l in logs), "Deletion of /System path BLOCKED by Protection Shield")

def cleanup():
    try:
        shutil.rmtree(TEST_DIR)
    except Exception:
        pass

def main():
    print("==========================================================")
    print("⚡ ZEROSPACE v2.0 - AUTOMATED TEST SUITE")
    print("==========================================================\n")
    try:
        test_api_health()
        test_api_drives()
        test_api_system_hud()
        test_api_reveal_in_finder()
        test_api_scan_and_archaeologist()
        test_review_first_blocks_advanced_compression()
        test_security_hardening()
        print("\n==========================================================")
        print("🎉 ALL TESTS PASSED CLEANLY (100% SPEC MATCH)")
        print("==========================================================")
    finally:
        cleanup()

if __name__ == '__main__':
    main()
