# ZeroSpace AAA Readiness Audit

Audit date: 2026-08-10

## Scope

“AAA” was treated as a three-axis audit: application quality, adversarial safety, and accessibility. The review covered the Python HTTP service, destructive filesystem actions, browser rendering, launch/package surfaces, and public documentation.

## Remediated findings

- **Critical — browser/API trust boundary:** API requests now reject untrusted Host, Origin, and Fetch Metadata values, reducing cross-site request forgery and DNS-rebinding exposure.
- **High — incomplete sensitive-path protection:** descendants of `~/.ssh`, `~/.gnupg`, `~/.config`, and `~/Library` are now protected, not only the directories themselves.
- **High — destructive compression fallback:** archive fallback now retains the original; a successful APFS transparent-compression path remains the only in-place behavior.
- **High — unbounded execution input:** JSON bodies and item counts are bounded, content type and schema are validated, and actions use an explicit allowlist.
- **Medium — overwrite and reporting safety:** Trash, archive, and migration destinations no longer overwrite existing files. Snapshot and fallback compression paths no longer claim fabricated reclaimed-byte values.
- **Medium — information disclosure:** unexpected operation errors are logged server-side and return a generic client response.
- **Medium — DOM injection:** toast content is rendered as text instead of HTML.
- **Medium — operational correctness:** `launch.sh` now passes its selected port, the CLI supports `--port`/`--version`, and the Homebrew formula no longer contains placeholder release metadata.
- **Accessibility baseline:** added skip navigation, consistent visible keyboard focus, polite/urgent status announcements, reduced-motion handling, and improved low-emphasis text contrast.

## Verification

- `python3 -m py_compile scanner_backend.py test_suite.py verify_security_hardening.py`
- `node --check app.js`
- `python3 scanner_backend.py --version`
- `git diff --check`
- Live localhost checks: health `200`, invalid content type `415`, hostile Origin `403`, and sensitive descendant blocked.

## Residual risks and release gates

- The frontend still contains legacy inline handlers and multiple HTML-template renderers. Server results are local filesystem metadata, but these should be migrated to DOM construction/event delegation before claiming a strict Content Security Policy or formal XSS assurance.
- Filesystem validation and mutation are separate operations. A malicious local process could attempt a symlink race; stronger assurance requires descriptor-relative operations and inode revalidation immediately before mutation.
- Destructive actions are intentionally available without OS authentication because this is a single-user localhost tool. Run it only on a trusted local account and stop the service when unused.
- WCAG 2.2 AAA conformance has not been certified. The baseline issues above are fixed, but formal AAA requires automated and manual testing across every view, keyboard path, zoom level, and assistive technology.
- Release artifacts and a stable Homebrew checksum must be generated from an actual signed tag. Until then, the included formula is development-only and should be installed with `brew install --HEAD ./Formula/hd-detective.rb`.
