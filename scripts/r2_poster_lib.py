"""Cloudflare R2 poster upload helpers for Moovie sync scripts."""

from __future__ import annotations

import io
import os
import time
from dataclasses import dataclass
from typing import Any

import requests

from catalog_cache_lib import supabase_headers

TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/"
MEDIUM_WIDTH = 500
BACKDROP_WIDTH = 1280
MEDIUM_WEBP_QUALITY = 82
ASSET_WIDTHS = {"medium": MEDIUM_WIDTH, "backdrop": BACKDROP_WIDTH}


@dataclass(frozen=True)
class R2Config:
    account_id: str
    access_key_id: str
    secret_access_key: str
    bucket: str
    public_base_url: str

    @property
    def endpoint_url(self) -> str:
        return f"https://{self.account_id}.r2.cloudflarestorage.com"

    def public_url_for_key(self, key: str) -> str:
        base = self.public_base_url.rstrip("/")
        return f"{base}/{key.lstrip('/')}"


def load_r2_config() -> R2Config:
    account_id = os.getenv("R2_ACCOUNT_ID", "").strip()
    access_key_id = os.getenv("R2_ACCESS_KEY_ID", "").strip()
    secret_access_key = os.getenv("R2_SECRET_ACCESS_KEY", "").strip()
    bucket = os.getenv("R2_BUCKET_NAME", "").strip() or os.getenv("R2_BUCKET", "").strip()
    public_base_url = os.getenv("R2_PUBLIC_BASE_URL", "").strip()

    missing = [
        name
        for name, value in (
            ("R2_ACCOUNT_ID", account_id),
            ("R2_ACCESS_KEY_ID", access_key_id),
            ("R2_SECRET_ACCESS_KEY", secret_access_key),
            ("R2_BUCKET_NAME", bucket),
            ("R2_PUBLIC_BASE_URL", public_base_url),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(f"Missing R2 env vars: {', '.join(missing)}")

    return R2Config(
        account_id=account_id,
        access_key_id=access_key_id,
        secret_access_key=secret_access_key,
        bucket=bucket,
        public_base_url=public_base_url,
    )


def asset_r2_key(entity_type: str, entity_id: str, size: str = "medium") -> str:
    safe_type = entity_type.strip().replace("/", "-")
    safe_id = str(entity_id).strip().replace("/", "-")
    safe_size = size if size in ASSET_WIDTHS else "medium"
    return f"{safe_size}/{safe_type}/{safe_id}.webp"


def medium_r2_key(entity_type: str, entity_id: str) -> str:
    return asset_r2_key(entity_type, entity_id, "medium")


def tmdb_image_source_url(
    image_path: str | None,
    *,
    width: str = "w500",
) -> str | None:
    if not image_path:
        return None
    path = image_path if image_path.startswith("/") else f"/{image_path}"
    return f"{TMDB_IMAGE_BASE}{width}{path}"


def tmdb_poster_source_url(poster_path: str | None, *, width: str = "w500") -> str | None:
    return tmdb_image_source_url(poster_path, width=width)


def tmdb_backdrop_source_url(backdrop_path: str | None, *, width: str = "w1280") -> str | None:
    return tmdb_image_source_url(backdrop_path, width=width)


def download_image_bytes(session: requests.Session, url: str, *, timeout: int = 45) -> bytes:
    resp = session.get(url, timeout=timeout, headers={"User-Agent": "MooviePosterSync/1.0"})
    resp.raise_for_status()
    content_type = (resp.headers.get("Content-Type") or "").lower()
    if not content_type.startswith("image/"):
        raise RuntimeError(f"Not an image response ({content_type}) for {url[:120]}")
    return resp.content


def to_sized_webp(
    image_bytes: bytes,
    *,
    target_width: int = MEDIUM_WIDTH,
    size_label: str = "medium",
) -> tuple[bytes, int, int]:
    try:
        from PIL import Image
    except ImportError as err:
        raise RuntimeError("Pillow is required. Run: pip install -r scripts/requirements-sync.txt") from err

    with Image.open(io.BytesIO(image_bytes)) as img:
        if img.mode in ("RGBA", "P", "LA"):
            background = Image.new("RGB", img.size, (16, 16, 16))
            alpha = img.convert("RGBA").split()[-1]
            background.paste(img.convert("RGBA"), mask=alpha)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        width, height = img.size
        if width > target_width:
            new_height = max(1, int(height * target_width / width))
            img = img.resize((target_width, new_height), Image.Resampling.LANCZOS)
            width, height = img.size

        out = io.BytesIO()
        img.save(
            out,
            format="WEBP",
            quality=MEDIUM_WEBP_QUALITY,
            method=6,
        )
        payload = out.getvalue()
        return payload, width, height


def to_medium_webp(image_bytes: bytes, *, target_width: int = MEDIUM_WIDTH) -> tuple[bytes, int, int]:
    return to_sized_webp(image_bytes, target_width=target_width, size_label="medium")


def to_backdrop_webp(image_bytes: bytes) -> tuple[bytes, int, int]:
    return to_sized_webp(image_bytes, target_width=BACKDROP_WIDTH, size_label="backdrop")


class R2PosterClient:
    def __init__(self, config: R2Config):
        self.config = config
        self._client = None

    def _s3(self):
        if self._client is None:
            try:
                import boto3
            except ImportError as err:
                raise RuntimeError(
                    "boto3 is required. Run: pip install -r scripts/requirements-sync.txt"
                ) from err

            self._client = boto3.client(
                "s3",
                endpoint_url=self.config.endpoint_url,
                aws_access_key_id=self.config.access_key_id,
                aws_secret_access_key=self.config.secret_access_key,
                region_name="auto",
            )
        return self._client

    def object_exists(self, key: str) -> bool:
        try:
            self._s3().head_object(Bucket=self.config.bucket, Key=key)
            return True
        except Exception:
            return False

    def upload_webp(self, key: str, payload: bytes, *, dry_run: bool = False) -> str:
        public_url = self.config.public_url_for_key(key)
        if dry_run:
            return public_url

        self._s3().put_object(
            Bucket=self.config.bucket,
            Key=key,
            Body=payload,
            ContentType="image/webp",
            CacheControl="public, max-age=31536000, immutable",
        )
        return public_url


def fetch_poster_cache_index(
    supabase_url: str,
    service_key: str,
    *,
    entity_type: str | None = None,
    page_size: int = 1000,
) -> set[tuple[str, str, str]]:
    """Return {(entity_type, entity_id, size)} already in poster_cache."""
    headers = supabase_headers(service_key)
    base = supabase_url.rstrip("/")
    out: set[tuple[str, str, str]] = set()
    offset = 0

    while True:
        params: dict[str, Any] = {
            "select": "entity_type,entity_id,size",
            "size": "eq.medium",
            "limit": str(page_size),
            "offset": str(offset),
        }
        if entity_type:
            params["entity_type"] = f"eq.{entity_type}"

        resp = requests.get(
            f"{base}/rest/v1/poster_cache",
            headers=headers,
            params=params,
            timeout=60,
        )
        if resp.status_code == 404:
            return out
        if resp.status_code != 200:
            raise RuntimeError(f"poster_cache fetch failed ({resp.status_code}): {resp.text[:300]}")

        rows = resp.json() or []
        if not rows:
            break

        for row in rows:
            et = str(row.get("entity_type") or "").strip()
            eid = str(row.get("entity_id") or "").strip()
            size = str(row.get("size") or "medium").strip()
            if et and eid:
                out.add((et, eid, size))

        if len(rows) < page_size:
            break
        offset += page_size

    return out


def upsert_poster_cache_rows(
    supabase_url: str,
    service_key: str,
    rows: list[dict[str, Any]],
    *,
    dry_run: bool = False,
) -> None:
    if not rows:
        return
    if dry_run:
        print(f"[dry-run] would upsert {len(rows)} poster_cache rows")
        return

    headers = {
        **supabase_headers(service_key),
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    resp = requests.post(
        f"{supabase_url.rstrip('/')}/rest/v1/poster_cache",
        headers=headers,
        params={"on_conflict": "entity_type,entity_id,size"},
        json=rows,
        timeout=120,
    )
    if resp.status_code == 404:
        print(
            "[warn] poster_cache table missing — run docs/poster_cache_migration.sql in Supabase",
            flush=True,
        )
        return
    if resp.status_code not in (200, 201, 204):
        raise RuntimeError(f"poster_cache upsert failed ({resp.status_code}): {resp.text[:500]}")


def fetch_supabase_table(
    supabase_url: str,
    service_key: str,
    table: str,
    select: str,
    *,
    page_size: int = 1000,
) -> list[dict[str, Any]]:
    headers = supabase_headers(service_key)
    base = supabase_url.rstrip("/")
    rows: list[dict[str, Any]] = []
    offset = 0

    while True:
        resp = requests.get(
            f"{base}/rest/v1/{table}",
            headers=headers,
            params={
                "select": select,
                "limit": str(page_size),
                "offset": str(offset),
            },
            timeout=120,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"{table} fetch failed ({resp.status_code}): {resp.text[:300]}")

        chunk = resp.json() or []
        if not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
        time.sleep(0.05)

    return rows