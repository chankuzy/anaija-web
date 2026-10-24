#!/usr/bin/env bash
# Usage: scripts/make-assetlinks.sh <SHA256 fingerprint> [more fingerprints...]
# Fingerprints are the SHA-256 of the certificate that signs the APK users install (see docs/android-app-links.md).
set -euo pipefail
PKG="${ANDROID_PACKAGE:-com.anaija.app}"
[ "$#" -ge 1 ] || { echo "usage: $0 <SHA256 fingerprint> [...]" >&2; exit 1; }
for fp in "$@"; do
  fp="${fp#SHA256:}"; fp="${fp#SHA-256:}"
  [[ "$fp" =~ ^([0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$ ]] || { echo "not a SHA-256 fingerprint: $fp" >&2; exit 1; }
done
python3 - "$PKG" "$@" <<'PY'
import json, sys
pkg = sys.argv[1]
fps = [f.removeprefix("SHA256:").removeprefix("SHA-256:").upper() for f in sys.argv[2:]]
doc = [{"relation": ["delegate_permission/common.handle_all_urls"],
        "target": {"namespace": "android_app", "package_name": pkg, "sha256_cert_fingerprints": fps}}]
open("public/.well-known/assetlinks.json", "w").write(json.dumps(doc, indent=2) + "\n")
print("wrote public/.well-known/assetlinks.json for", pkg, "with", len(fps), "fingerprint(s)")
PY
