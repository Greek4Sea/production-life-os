#!/usr/bin/env python3
"""Scrape a fencingtracker.com profile and push results into Life OS.

fencingtracker.com has no API, so this parses the profile page's tables with
Scrapling and POSTs the
data to life-os's /api/fencing/ingest (x-cron-secret auth).

Env:
  FT_PROFILE_URL  your fencingtracker.com profile page URL (required)
  APP_URL         life-os base URL (required to push; omit for dry run)
  CRON_SECRET     shared secret for the ingest endpoint

Usage: python scripts/fencingtracker_scrape.py [--dry-run]
"""
import hashlib
import json
import os
import re
import sys
import urllib.request
from datetime import date, datetime

from scrapling.fetchers import Fetcher

PROFILE_URL = os.environ.get("FT_PROFILE_URL")
if not PROFILE_URL:
    sys.exit("FT_PROFILE_URL is not set — export your fencingtracker.com profile URL")

DATE_FORMATS = ["%m/%d/%Y", "%m/%d/%y", "%b %d, %Y", "%B %d, %Y", "%Y-%m-%d"]
NO_YEAR_FORMATS = ["%b %d", "%B %d", "%m/%d"]


def parse_date(text, prev):
    """Parse a result date. prev = the (later) date parsed just above this row;
    results are listed newest-first, so a year-less date belongs to the latest
    year that keeps it <= prev (or <= today for the first row)."""
    text = text.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    for fmt in NO_YEAR_FORMATS:
        try:
            md = datetime.strptime(text, fmt).date()
        except ValueError:
            continue
        ceiling = prev or date.today()
        for year in (ceiling.year, ceiling.year - 1):
            candidate = md.replace(year=year)
            if candidate <= ceiling:
                return candidate
        return md.replace(year=ceiling.year - 1)
    return None


def cells(row):
    return [c.get_all_text(strip=True) for c in row.css("td, th")]


def find_table(page, required_headers):
    """Return (headers, body_rows) of the first table whose header row
    contains all required_headers (case-insensitive substring match)."""
    for table in page.css("table"):
        rows = table.css("tr")
        if not rows:
            continue
        headers = [h.lower() for h in cells(rows[0])]
        if all(any(req in h for h in headers) for req in required_headers):
            return headers, rows[1:]
    return None, []


def parse_place(text):
    """'175 / 420' -> (175, 420); '1' -> (1, None)."""
    m = re.match(r"\s*(\d+)\s*(?:/\s*(\d+))?\s*$", text or "")
    if not m:
        return None, None
    return int(m.group(1)), int(m.group(2)) if m.group(2) else None


def col(headers, *names):
    for i, h in enumerate(headers):
        if any(n in h for n in names):
            return i
    return None


def scrape():
    page = Fetcher.get(PROFILE_URL, stealthy_headers=True)
    if page.status != 200:
        sys.exit(f"fetch failed: HTTP {page.status}")

    # --- Results table: Date / Tournament / Event / Place / Rating / Class ---
    headers, rows = find_table(page, ["date", "tournament", "event", "place"])
    if headers is None:
        sys.exit("results table not found — page layout may have changed")
    ix = {
        "date": col(headers, "date"),
        "tournament": col(headers, "tournament"),
        "event": col(headers, "event"),
        "place": col(headers, "place"),
        "rating": col(headers, "rating"),
        "cls": col(headers, "class"),
    }
    results, prev = [], None
    for row in rows:
        c = cells(row)
        if len(c) <= max(i for i in ix.values() if i is not None):
            continue
        d = parse_date(c[ix["date"]], prev)
        if d is None:
            continue
        prev = d
        tournament, event = c[ix["tournament"]], c[ix["event"]]
        place, field = parse_place(c[ix["place"]])
        uid = hashlib.sha1(f"{d}|{tournament}|{event}".encode()).hexdigest()[:16]
        results.append({
            "uid": uid, "date": d.isoformat(),
            "tournament": tournament, "event": event,
            "place": place, "fieldSize": field,
            "ratingEarned": c[ix["rating"]] or None if ix["rating"] is not None else None,
            "eventClass": c[ix["cls"]] or None if ix["cls"] is not None else None,
        })

    # --- Rating history: Weapon / Rating / Date (keep newest per weapon) ---
    ratings = {}
    rh_headers, rh_rows = find_table(page, ["weapon", "rating"])
    if rh_headers is not None:
        wix, rix, dix = (col(rh_headers, "weapon"), col(rh_headers, "rating"),
                         col(rh_headers, "date"))
        for row in rh_rows:
            c = cells(row)
            if len(c) <= max(wix, rix):
                continue
            weapon, rating = c[wix], c[rix]
            earned = parse_date(c[dix], None) if dix is not None and len(c) > dix else None
            if weapon and rating and weapon not in ratings:  # rows are newest-first
                ratings[weapon] = {
                    "weapon": weapon, "rating": rating,
                    "earnedAt": earned.isoformat() if earned else None,
                }

    if not results:
        sys.exit("parsed 0 results — refusing to push (layout change?)")
    return {"results": results, "ratings": list(ratings.values())}


def push(payload):
    app_url, secret = os.environ.get("APP_URL"), os.environ.get("CRON_SECRET")
    if not app_url or not secret:
        sys.exit("APP_URL / CRON_SECRET not set — use --dry-run to test locally")
    req = urllib.request.Request(
        f"{app_url.rstrip('/')}/api/fencing/ingest",
        data=json.dumps(payload).encode(),
        headers={"content-type": "application/json", "x-cron-secret": secret},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        print("ingest:", res.read().decode())


if __name__ == "__main__":
    data = scrape()
    print(f"scraped {len(data['results'])} results, "
          f"{len(data['ratings'])} ratings from {PROFILE_URL}")
    if "--dry-run" in sys.argv:
        print(json.dumps(data, indent=2)[:3000])
    else:
        push(data)
