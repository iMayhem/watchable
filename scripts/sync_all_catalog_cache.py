#!/usr/bin/env python3
"""
Sync all catalogue caches to Supabase:
  1. Movies + TV audio     -> catalog_audio_cache
  2. TMDB + browse tags    -> catalog_enrichment_cache
  3. Anime                 -> anime_catalog_cache

Usage:
  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
  python scripts/sync_all_catalog_cache.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(script: str, extra_args: list[str] | None = None) -> int:
    cmd = [sys.executable, str(ROOT / script), *(extra_args or [])]
    print(f"\n==> {' '.join(cmd)}")
    return subprocess.call(cmd)


def main() -> int:
    extra = sys.argv[1:]
    code = run("sync_catalog_audio_cache.py", extra)
    if code != 0:
        return code
    code = run("sync_catalog_enrichment_cache.py", extra)
    if code != 0:
        return code
    return run("sync_anime_catalog_cache.py", extra)


if __name__ == "__main__":
    raise SystemExit(main())