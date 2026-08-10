#!/usr/bin/env python3
"""Focused backend contract tests for hostile and boundary inputs."""

import json
import os
import tempfile
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = os.environ.get("ZEROSPACE_BASE_URL", "http://127.0.0.1:8080")


def request(path, data=None, headers=None):
    req = urllib.request.Request(BASE_URL + path, data=data, headers=headers or {})
    return urllib.request.urlopen(req, timeout=20)


def assert_status(fn, expected):
    try:
        fn()
    except urllib.error.HTTPError as exc:
        assert exc.code == expected, (exc.code, expected)
    else:
        raise AssertionError(f"expected HTTP {expected}")


def main():
    with request("/api/health") as response:
        assert response.status == 200
        assert json.loads(response.read())["status"] == "ok"

    # Dynamic ports are part of the launcher contract; BASE_URL need not be 8080.
    def traversal_request():
        with request("/api/scan?path=%2Ftmp%2F..%2Fprivate%2Fetc%2Fshadow") as response:
            response.read()
    assert_status(traversal_request, 403)

    malformed = b"not-json"
    assert_status(lambda: request("/api/execute", malformed, {"Content-Type": "application/json"}), 400)
    assert_status(lambda: request("/api/execute", b"{}", {"Content-Type": "text/plain"}), 415)
    oversized = b"{" + b"x" * (256 * 1024) + b"}"
    assert_status(lambda: request("/api/execute", oversized, {"Content-Type": "application/json"}), 413)

    with tempfile.TemporaryDirectory(prefix="zerospace-edge-") as root:
        restricted = os.path.join(root, "restricted")
        os.mkdir(restricted)
        with open(os.path.join(restricted, "hidden.txt"), "w", encoding="utf-8") as handle:
            handle.write("permission boundary")
        os.chmod(restricted, 0)
        empty = urllib.parse.quote(root)
        try:
            with request(f"/api/scan?path={empty}&refresh=1") as response:
                payload = json.loads(response.read())
                assert payload["coverage"]["complete"] is True
                if not os.access(restricted, os.R_OK):
                    assert payload["coverage"]["skippedDirectories"] >= 1
        finally:
            os.chmod(restricted, 0o700)

        empty_dir = os.path.join(root, "empty")
        os.mkdir(empty_dir)
        with request(f"/api/scan?path={urllib.parse.quote(empty_dir)}&refresh=1") as response:
            payload = json.loads(response.read())
            assert payload["totalFiles"] == 0
            assert payload["coverage"]["complete"] is True

        target = os.path.join(root, "target.txt")
        with open(target, "w", encoding="utf-8") as handle:
            handle.write("safe")
        link = os.path.join(root, "link.txt")
        try:
            os.symlink(target, link)
        except OSError:
            link = None
        if link:
            with request(f"/api/scan?path={urllib.parse.quote(root)}&refresh=1") as response:
                assert json.loads(response.read())["coverage"]["complete"] is True

    print("edge-case backend tests passed")


if __name__ == "__main__":
    main()
