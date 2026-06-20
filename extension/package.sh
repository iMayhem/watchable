#!/usr/bin/env bash
# Build a single universal extension.zip for all supported browsers.
# Only one ZIP is needed (extension.zip). Manifest is at the ZIP root.
# Output: ../extension.zip (alongside the watchable/ repo root)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT_ZIP="${ROOT}/../extension.zip"

python3 - "$ROOT" "$OUT_ZIP" <<'PY'
import json
import sys
import zipfile
from pathlib import Path

root = Path(sys.argv[1])
out_zip = Path(sys.argv[2])

# Files to include in the published extension (manifest at ZIP root).
CORE_FILES = [
    'background.js',
    'content.js',
    'ext-api.js',
    'page-bridge.js',
    'popup.html',
    'rules.json',
    'icons/icon16.png',
    'icons/icon48.png',
    'icons/icon128.png',
]

base_manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))

def build_universal_manifest() -> dict:
    manifest = dict(base_manifest)  # shallow is fine for our top-level edits
    # MV3: service_worker only (background.scripts is MV2-only).
    manifest['background'] = {
        'service_worker': 'background.js',
    }
    # Ensure gecko settings stay for Firefox (already in source manifest)
    # Optionally force a minimum for chromium stores
    if 'minimum_chrome_version' not in manifest:
        manifest['minimum_chrome_version'] = '109'
    return manifest

manifest = build_universal_manifest()

with zipfile.ZipFile(out_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.writestr(
        'manifest.json',
        json.dumps(manifest, indent=2, ensure_ascii=False) + '\n',
    )
    for rel in CORE_FILES:
        zf.write(root / rel, rel)

print(f'✓ Built single universal package: {out_zip}')
print('  All browsers now use this one extension.zip')
print('  (manifest.json is at the root of the ZIP)')
PY