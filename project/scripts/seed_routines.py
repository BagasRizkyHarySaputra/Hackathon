#!/usr/bin/env python3
"""
Seed skincare routines into Supabase.
Inserts morning & night routine data for users who have profiles.
Run AFTER creating the skincare_routines table via SQL migration.
"""
import json
import urllib.request
import urllib.error
import sys

SUPABASE_URL = "https://gvkzgicbykyjkusxranv.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2a3pnaWNieWt5amt1c3hyYW52Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg5ODQ5MCwiZXhwIjoyMDk3NDc0NDkwfQ.-Zwehd-Xu4vTeb9Hazd03Mt9FSSRGFN2iJw8-Tq1aH0"

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}

# Sample routine data
MORNING_ROUTINE = [
    {
        "routine_type": "morning",
        "step_order": 1,
        "product_name": "Facial Treatment Gentle Cleanser",
        "product_description": "Gentle foaming cleanser with low pH formula for daily face wash",
        "product_image_url": "/assets/images/profile/product-1.png",
    },
    {
        "routine_type": "morning",
        "step_order": 2,
        "product_name": "CERAMIC SKIN Saviour Moisturizer Gel",
        "product_description": "Ceramide-infused gel moisturizer to restore skin barrier",
        "product_image_url": "/assets/images/profile/product-2.png",
    },
    {
        "routine_type": "morning",
        "step_order": 3,
        "product_name": "Holyshield! Sunscreen Shake Mist SPF46 PA+++",
        "product_description": "Lightweight sun protection mist with PA+++ rating",
        "product_image_url": "/assets/images/profile/product-3.png",
    },
]

NIGHT_ROUTINE = [
    {
        "routine_type": "night",
        "step_order": 1,
        "product_name": "Oil Cleanser",
        "product_description": "Remove makeup and sunscreen with oil-based cleanser",
        "product_image_url": None,
    },
    {
        "routine_type": "night",
        "step_order": 2,
        "product_name": "Water-Based Cleanser",
        "product_description": "Double cleanse to remove remaining impurities",
        "product_image_url": None,
    },
    {
        "routine_type": "night",
        "step_order": 3,
        "product_name": "Night Cream",
        "product_description": "Rich moisturizer for overnight skin repair",
        "product_image_url": None,
    },
]


def get_profiles():
    """Fetch all profiles from Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/profiles?select=*"
    req = urllib.request.Request(url, headers=HEADERS)
    resp = urllib.request.urlopen(req, timeout=10)
    return json.loads(resp.read())


def insert_routines(user_id, routines):
    """Insert routines for a user via REST API."""
    url = f"{SUPABASE_URL}/rest/v1/skincare_routines?on_conflict=user_id,routine_type,step_order"

    payload = []
    for r in routines:
        payload.append({
            "user_id": user_id,
            "routine_type": r["routine_type"],
            "step_order": r["step_order"],
            "product_name": r["product_name"],
            "product_description": r.get("product_description"),
            "product_image_url": r.get("product_image_url"),
        })

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=HEADERS, method="POST")

    try:
        resp = urllib.request.urlopen(req, timeout=30)
        return resp.getcode(), None
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return e.code, body


def main():
    print("=" * 60)
    print("Seeding skincare routines into Supabase")
    print("=" * 60)

    try:
        profiles = get_profiles()
        print(f"\nFound {len(profiles)} profile(s) in Supabase.")
    except Exception as e:
        print(f"ERROR: Failed to fetch profiles: {e}")
        print("Make sure the skincare_routines table exists (run the SQL migration first).")
        sys.exit(1)

    if not profiles:
        print("No profiles found. Nothing to seed.")
        return

    success = 0
    errors = 0

    for profile in profiles:
        user_id = profile["id"]
        name = profile.get("name", "Unknown")
        print(f"\nSeeding routines for: {name} ({user_id[:12]}...)")

        all_routines = MORNING_ROUTINE + NIGHT_ROUTINE
        code, err_body = insert_routines(user_id, all_routines)

        if code in (200, 201):
            print(f"  OK - {len(all_routines)} routines inserted (HTTP {code})")
            success += len(all_routines)
        elif code == 404:
            print(f"  SKIP - skincare_routines table not found. Run the SQL migration first.")
            errors += len(all_routines)
        else:
            print(f"  ERROR HTTP {code}: {err_body[:200] if err_body else 'unknown'}")
            errors += len(all_routines)

    print(f"\n{'=' * 60}")
    print(f"Results: {success} inserted, {errors} errors")
    print(f"{'=' * 60}")

    # Verify
    url = f"{SUPABASE_URL}/rest/v1/skincare_routines?select=count"
    try:
        req = urllib.request.Request(url, headers={**HEADERS, "Prefer": "count=exact"})
        resp = urllib.request.urlopen(req, timeout=10)
        ct = resp.headers.get("content-range", "?")
        print(f"Verification - Total routines in DB: {ct}")
    except Exception as e:
        print(f"Verification failed: {e}")


if __name__ == "__main__":
    main()
