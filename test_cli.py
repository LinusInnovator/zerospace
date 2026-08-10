#!/usr/bin/env python3
"""Contract tests for the read-only agent CLI."""

import json
import os
import subprocess
import sys
import tempfile


ROOT = os.path.dirname(os.path.abspath(__file__))
CLI = [sys.executable, os.path.join(ROOT, 'scanner_backend.py'), 'scan']


def run_cli(path, *extra):
    return subprocess.run(CLI + [path, *extra], capture_output=True, text=True, timeout=60)


def main():
    with tempfile.TemporaryDirectory(prefix='zerospace-cli-') as root:
        with open(os.path.join(root, 'empty.txt'), 'w', encoding='utf-8') as handle:
            handle.write('empty fixture')

        human = run_cli(root)
        assert human.returncode == 0, human.stderr
        assert 'ZeroSpace scan:' in human.stdout
        assert 'Files indexed:' in human.stdout
        assert 'Findings:' in human.stdout

        report = run_cli(root, '--json')
        assert report.returncode == 0, report.stderr
        payload = json.loads(report.stdout)
        assert payload['schemaVersion'] == 1
        assert payload['scope']['resolvedPath'] == os.path.realpath(root)
        assert isinstance(payload['findings'], list)
        assert payload['summary']['totalFiles'] == 1

        duplicate = b'A' * 8192 + b'B' * 16384
        for name in ('copy-a.dat', 'copy-b.dat'):
            with open(os.path.join(root, name), 'wb') as handle:
                handle.write(duplicate)

        duplicate_report = run_cli(root, '--json', '--fail-on', 'duplicates')
        assert duplicate_report.returncode == 1
        duplicate_payload = json.loads(duplicate_report.stdout)
        assert duplicate_payload['summary']['duplicateGroups'] == 1
        paths = [finding['path'] for finding in duplicate_payload['findings']]
        assert len(paths) == len(set(paths))
        assert any(finding.get('duplicateGroup') for finding in duplicate_payload['findings'])

        findings_report = run_cli(root, '--json', '--fail-on', 'findings')
        assert findings_report.returncode == 1
        assert json.loads(findings_report.stdout)['summary']['findingCount'] > 0

    invalid = run_cli(os.path.join(root, 'does-not-exist'))
    assert invalid.returncode == 2
    assert invalid.stdout == ''
    assert 'Scan failed:' in invalid.stderr
    print('CLI contract tests passed')


if __name__ == '__main__':
    main()
