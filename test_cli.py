#!/usr/bin/env python3
"""Contract tests for the read-only agent CLI."""

import json
import os
import subprocess
import sys
import tempfile
import shutil


ROOT = os.path.dirname(os.path.abspath(__file__))
CLI = [sys.executable, os.path.join(ROOT, 'scanner_backend.py'), 'scan']


def run_cli(path, *extra, inventory_dir=None):
    env = os.environ.copy()
    if inventory_dir:
        env['ZEROSPACE_INVENTORY_DIR'] = inventory_dir
    return subprocess.run(CLI + [path, *extra], capture_output=True, text=True, timeout=60, env=env)


def main():
    inventory_dir = tempfile.mkdtemp(prefix='zerospace-cli-inventory-')
    try:
      with tempfile.TemporaryDirectory(prefix='zerospace-cli-') as root:
        with open(os.path.join(root, 'empty.txt'), 'w', encoding='utf-8') as handle:
            handle.write('empty fixture')

        human = run_cli(root, inventory_dir=inventory_dir)
        assert human.returncode == 0, human.stderr
        assert 'ZeroSpace scan:' in human.stdout
        assert 'Files indexed:' in human.stdout
        assert 'Findings:' in human.stdout

        report = run_cli(root, '--json', inventory_dir=inventory_dir)
        assert report.returncode == 0, report.stderr
        payload = json.loads(report.stdout)
        assert payload['schemaVersion'] == 1
        assert payload['scope']['resolvedPath'] == os.path.realpath(root)
        assert isinstance(payload['findings'], list)
        assert payload['summary']['totalFiles'] == 1
        assert payload['coverage']['mode'] == 'incremental'

        reused = run_cli(root, '--json', inventory_dir=inventory_dir)
        reused_payload = json.loads(reused.stdout)
        assert reused_payload['coverage']['reusedFiles'] == 1

        duplicate = b'A' * 8192 + b'B' * 16384
        for name in ('copy-a.dat', 'copy-b.dat'):
            with open(os.path.join(root, name), 'wb') as handle:
                handle.write(duplicate)

        duplicate_report = run_cli(root, '--json', '--fail-on', 'duplicates', inventory_dir=inventory_dir)
        assert duplicate_report.returncode == 1
        duplicate_payload = json.loads(duplicate_report.stdout)
        assert duplicate_payload['summary']['duplicateGroups'] == 1
        paths = [finding['path'] for finding in duplicate_payload['findings']]
        assert len(paths) == len(set(paths))
        assert any(finding.get('duplicateGroup') for finding in duplicate_payload['findings'])

        findings_report = run_cli(root, '--json', '--fail-on', 'findings', inventory_dir=inventory_dir)
        assert findings_report.returncode == 1
        assert json.loads(findings_report.stdout)['summary']['findingCount'] > 0

        os.rename(os.path.join(root, 'copy-a.dat'), os.path.join(root, 'renamed-copy.dat'))
        renamed = run_cli(root, '--json', inventory_dir=inventory_dir)
        renamed_payload = json.loads(renamed.stdout)
        assert renamed_payload['summary']['duplicateGroups'] == 1
        assert renamed_payload['coverage']['reusedFiles'] >= 2

        with open(os.path.join(root, 'empty.txt'), 'a', encoding='utf-8') as handle:
            handle.write(' changed')
        changed = run_cli(root, '--json', inventory_dir=inventory_dir)
        assert json.loads(changed.stdout)['coverage']['changedFiles'] >= 1

        os.remove(os.path.join(root, 'renamed-copy.dat'))
        removed = run_cli(root, '--json', inventory_dir=inventory_dir)
        assert json.loads(removed.stdout)['coverage']['removedFiles'] >= 1

        full = run_cli(root, '--json', '--full-refresh', inventory_dir=inventory_dir)
        assert full.returncode == 0, full.stderr
        assert json.loads(full.stdout)['coverage']['mode'] == 'full'

      invalid = run_cli(os.path.join(root, 'does-not-exist'), inventory_dir=inventory_dir)
      assert invalid.returncode == 2
      assert invalid.stdout == ''
      assert 'Scan failed:' in invalid.stderr
    finally:
      shutil.rmtree(inventory_dir, ignore_errors=True)
    print('CLI contract tests passed')


if __name__ == '__main__':
    main()
