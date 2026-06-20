#!/usr/bin/env python3
"""
Upload all articles from local batch JSON files to Supabase articles table.
Uses service_role key to bypass RLS.

Usage: python3 scripts/upload_articles.py
Prerequisites: 0003_articles_columns.sql must be applied first.
"""

import json
import os
import sys
import urllib.request
import urllib.error

SUPABASE_URL = "https://gvkzgicbykyjkusxranv.supabase.co"
REST_URL = f"{SUPABASE_URL}/rest/v1/articles"

SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2a3pnaWNieWt5amt1c3hyYW52Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg5ODQ5MCwiZXhwIjoyMDk3NDc0NDkwfQ.-Zwehd-Xu4vTeb9Hazd03Mt9FSSRGFN2iJw8-Tq1aH0"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

BATCH_DIR = os.path.join(os.path.dirname(__file__), "..", "project", "assets", "data", "artikel")
BATCH_FILES = ["batch-01.json", "batch-02.json", "batch-03.json", "batch-04.json"]


def load_articles():
    """Read all batch JSON files and return combined list."""
    all_articles = []
    for fname in BATCH_FILES:
        fpath = os.path.join(BATCH_DIR, fname)
        if not os.path.exists(fpath):
            print(f"⚠️  Not found: {fpath}")
            continue
        with open(fpath, "r", encoding="utf-8") as f:
            batch = json.load(f)
        print(f"📄 {fname}: {len(batch)} articles")
        all_articles.extend(batch)
    return all_articles


def transform(article, index):
    """Map JSON article field names to database column names."""
    return {
        "slug": article.get("id", f"artikel-{index}"),
        "title": article.get("Title", article.get("title", "")),
        "content": article.get("Description", article.get("content", "")),
        "summary": article.get("Simple-desc", article.get("summary", "")),
        "simple_desc": article.get("Simple-desc", ""),
        "image_url": article.get("Link-Image", article.get("image_url", "")),
        "tags": article.get("tags", []),
        "category": (article.get("tags", [None])[0] or "general"),
        "source": article.get("Source", article.get("source", "")),
        "sections": json.dumps(article.get("sections", [])),
        "tips": json.dumps(article.get("tips", [])),
        "published_at": "now()",  # PostgREST will handle this
    }


def upload_one(article_data, index, total):
    """POST a single article to Supabase."""
    # Remove fields that should be auto-generated
    payload = {k: v for k, v in article_data.items() if k != "id"}
    # PostgREST doesn't handle "now()" as a literal, so remove published_at
    # and let the DEFAULT handle it
    payload.pop("published_at", None)

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(REST_URL, data=data, headers=HEADERS, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            status = resp.status
        slug = article_data["slug"]
        print(f"   ✅ [{index + 1}/{total}] {slug} ({status})")
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        print(f"   ❌ [{index + 1}/{total}] {article_data['slug']}: HTTP {e.code} — {body}")
        return False
    except Exception as e:
        print(f"   ❌ [{index + 1}/{total}] {article_data['slug']}: {e}")
        return False


def main():
    script_dir = os.path.dirname(__file__)
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    os.chdir(project_root)

    print("🔍 Loading articles from batch JSON files...")
    articles = load_articles()
    print(f"📦 Total: {len(articles)} articles\n")

    success = 0
    failures = 0

    for i, article in enumerate(articles):
        transformed = transform(article, i)
        if upload_one(transformed, i, len(articles)):
            success += 1
        else:
            failures += 1

    print(f"\n{'='*50}")
    print(f"✅ Done: {success} uploaded, {failures} failed")
    if failures > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
