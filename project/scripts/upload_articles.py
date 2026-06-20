#!/usr/bin/env python3
"""
Upload all 31 articles from batch JSON files to Supabase.
Reads batch-01.json through batch-04.json and inserts via REST API with service_role key.
"""
import json
import urllib.request
import urllib.error
import os
import sys

SUPABASE_URL = "https://gvkzgicbykyjkusxranv.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2a3pnaWNieWt5amt1c3hyYW52Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg5ODQ5MCwiZXhwIjoyMDk3NDc0NDkwfQ.-Zwehd-Xu4vTeb9Hazd03Mt9FSSRGFN2iJw8-Tq1aH0"

BATCH_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "data", "artikel")
BATCH_FILES = [f"batch-0{i}.json" for i in range(1, 5)]


def load_all_articles():
    """Load and transform all articles from batch JSON files."""
    all_articles = []
    for fname in BATCH_FILES:
        fpath = os.path.join(BATCH_DIR, fname)
        print(f"Loading {fname}...")
        with open(fpath, "r", encoding="utf-8") as f:
            articles = json.load(f)
        print(f"  Found {len(articles)} articles")
        for a in articles:
            transformed = {
                "slug": a.get("id", ""),
                "title": a.get("Title") or a.get("title", ""),
                "content": a.get("Description") or a.get("content", ""),
                "summary": a.get("Simple-desc") or a.get("summary", ""),
                "image_url": a.get("Link-Image") or a.get("image", ""),
                "tags": a.get("tags", []),
                "source": a.get("Source") or a.get("source", ""),
                "sections": json.dumps(a.get("sections", [])) if a.get("sections") else "[]",
                "tips": json.dumps(a.get("tips", [])) if a.get("tips") else "[]",
            }
            all_articles.append(transformed)
    return all_articles


def upsert_articles(articles):
    """Upsert articles to Supabase via REST API."""
    url = f"{SUPABASE_URL}/rest/v1/articles?on_conflict=slug"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    # Upsert in batches of 10 (Supabase REST limit considerations)
    batch_size = 10
    success_count = 0
    error_count = 0

    for i in range(0, len(articles), batch_size):
        batch = articles[i : i + batch_size]
        payload = json.dumps(batch).encode("utf-8")

        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")

        try:
            resp = urllib.request.urlopen(req, timeout=30)
            status = resp.getcode()
            body_bytes = resp.read()
            if status in (200, 201):
                try:
                    data = json.loads(body_bytes)
                    inserted = len(data) if isinstance(data, list) else 1
                except (json.JSONDecodeError, ValueError):
                    # Empty body on 201 is normal for upsert
                    inserted = len(batch)
                success_count += inserted
                print(f"  Batch {i // batch_size + 1}: {inserted} articles upserted OK (HTTP {status})")
            else:
                body = body_bytes.decode("utf-8", errors="replace")
                print(f"  Batch {i // batch_size + 1}: HTTP {status} — {body[:200]}")
                error_count += len(batch)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            print(f"  Batch {i // batch_size + 1}: ERROR {e.code} — {body[:200]}")
            error_count += len(batch)
        except Exception as e:
            print(f"  Batch {i // batch_size + 1}: EXCEPTION — {e}")
            error_count += len(batch)

    return success_count, error_count


def verify_upload():
    """Quick verification: count rows in Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/articles?select=count"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Prefer": "count=exact",
    }

    req = urllib.request.Request(url, headers=headers)
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        count = resp.headers.get("content-range", "")
        body = resp.read().decode("utf-8")
        print(f"\nVerification — Content-Range: {count}")
        print(f"Response: {body[:200]}")
    except Exception as e:
        print(f"\nVerification failed: {e}")


if __name__ == "__main__":
    print("=" * 60)
    print("Supabase Article Upload Tool")
    print("=" * 60)

    articles = load_all_articles()
    print(f"\nTotal articles to upload: {len(articles)}")
    print()

    success, errors = upsert_articles(articles)

    print(f"\n{'=' * 60}")
    print(f"Results: {success} upserted, {errors} errors")
    print(f"{'=' * 60}")

    verify_upload()
