#!/usr/bin/env bash
# Build store-ready ZIPs for each browser.
# manifest.json must sit at the ZIP root (not inside an "extension/" folder).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="${ROOT}/dist"

python3 - "$ROOT" "$DIST" <<'PY'
import copy
import json
import sys
import zipfile
from pathlib import Path

root = Path(sys.argv[1])
dist = Path(sys.argv[2])
dist.mkdir(parents=True, exist_ok=True)

CORE_FILES = [
    'background.js',
    'background-fallback.js',
    'content.js',
    'ext-api.js',
    'page-bridge.js',
    'popup.html',
    'rules.json',
    'icons/icon16.png',
    'icons/icon48.png',
    'icons/icon128.png',
]

BROWSERS = [
    {'slug': 'chrome', 'label': 'Google Chrome Web Store', 'family': 'chromium'},
    {'slug': 'edge', 'label': 'Microsoft Edge Add-ons', 'family': 'chromium'},
    {'slug': 'opera', 'label': 'Opera Add-ons', 'family': 'chromium'},
    {'slug': 'brave', 'label': 'Brave (developer load / self-host)', 'family': 'chromium'},
    {'slug': 'vivaldi', 'label': 'Vivaldi (developer load / self-host)', 'family': 'chromium'},
    {'slug': 'firefox', 'label': 'Mozilla Firefox Add-ons (AMO)', 'family': 'firefox'},
]

base_manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))


def chromium_manifest():
    manifest = copy.deepcopy(base_manifest)
    manifest.pop('browser_specific_settings', None)
    manifest['minimum_chrome_version'] = '109'
    manifest['background'] = {'service_worker': 'background.js'}
    return manifest


def firefox_manifest():
    manifest = copy.deepcopy(base_manifest)
    manifest['background'] = {
        'scripts': ['background-fallback.js'],
        'service_worker': 'background.js',
    }
    return manifest


def build_zip(target: Path, manifest: dict, files: list[str]) -> None:
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            'manifest.json',
            json.dumps(manifest, indent=2, ensure_ascii=False) + '\n',
        )
        for rel in files:
            zf.write(root / rel, rel)


print(f'Output directory: {dist}\n')

for browser in BROWSERS:
    if browser['family'] == 'firefox':
        manifest = firefox_manifest()
        files = CORE_FILES
    else:
        manifest = chromium_manifest()
        files = [f for f in CORE_FILES if f not in {'background-fallback.js'}]

    out = dist / f"moovie-{browser['slug']}.zip"
    build_zip(out, manifest, files)
    print(f"✓ {out.name} — {browser['label']}")

print('\nFirefox package includes:')
print('  background.scripts + background.service_worker')
print('  gecko.data_collection_permissions.required = ["none"]')
print('  gecko.strict_min_version = 140.0')
PY

CRX_STAGE="${DIST}/.crx-stage"
CRX_OUT="${DIST}/moovie.crx"
CRX_KEY="${DIST}/moovie.pem"
CHROME_ZIP="${DIST}/moovie-chrome.zip"

rm -rf "$CRX_STAGE"
mkdir -p "$CRX_STAGE"
python3 - "$CHROME_ZIP" "$CRX_STAGE" <<'PY'
import sys
import zipfile
from pathlib import Path

zip_path = Path(sys.argv[1])
stage = Path(sys.argv[2])

with zipfile.ZipFile(zip_path) as zf:
    zf.extractall(stage)
PY

echo ""
echo "Building Chrome CRX..."
npx --yes crx3@1.1.3 "$CRX_STAGE" -o "$CRX_OUT" -p "$CRX_KEY"
rm -rf "$CRX_STAGE"
echo "✓ moovie.crx — Chrome packed extension (self-host / enterprise)"
if [[ -f "$CRX_KEY" ]]; then
  echo "  Signing key: moovie.pem (keep this file to preserve extension ID across rebuilds)"
fi

FIREFOX_ZIP="${DIST}/moovie-firefox.zip"
XPI_OUT="${DIST}/moovie.xpi"

echo ""
echo "Building Firefox XPI..."
cp "$FIREFOX_ZIP" "$XPI_OUT"
echo "✓ moovie.xpi — Firefox packed extension (AMO / self-host)"