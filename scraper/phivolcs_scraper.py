"""Scrape the latest earthquake bulletins from DOST-PHIVOLCS.

Fetches https://earthquake.phivolcs.dost.gov.ph/, finds the earthquake table
by its header text (not by CSS class, which changes between site revisions),
and returns a cleaned pandas DataFrame:

    datetime_pst   tz-aware datetime, Asia/Manila (PST = UTC+8)
    datetime_utc   tz-aware datetime, UTC
    latitude       signed float (N positive, S negative)
    longitude      signed float (E positive, W negative)
    depth_km       int
    magnitude      float
    location       str
    bulletin_url   absolute URL to the individual bulletin page (or None)

Usage:
    python phivolcs_scraper.py                       # all rows -> phivolcs_earthquakes.csv
    python phivolcs_scraper.py --min-magnitude 4     # only M4.0+
    python phivolcs_scraper.py --insecure            # skip TLS verification (see below)

The PHIVOLCS site has had an incomplete TLS certificate chain at times, which
makes certificate verification fail. Verification stays on by default;
--insecure turns it off and should only be used when you accept that risk.
"""

from __future__ import annotations

import argparse
import logging
import re
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

import pandas as pd
import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE_URL = "https://earthquake.phivolcs.dost.gov.ph/"
OUTPUT_CSV = "phivolcs_earthquakes.csv"
TIMEOUT_S = 20
PST = ZoneInfo("Asia/Manila")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
)

# Header keywords -> field name. Matched case-insensitively against each <th>/<td>
# of the header row, so "Date - Time (Philippine Time)", "Date and Time (PST)",
# "Latitude (ºN)", "Mag" etc. all resolve.
HEADER_KEYWORDS: dict[str, tuple[str, ...]] = {
    "datetime": ("date", "time"),
    "latitude": ("lat",),
    "longitude": ("lon",),
    "depth": ("depth",),
    "magnitude": ("mag",),
    "location": ("location",),
}
REQUIRED_FIELDS = {"datetime", "latitude", "longitude", "magnitude"}

DATETIME_FORMATS = (
    "%d %B %Y - %I:%M %p",  # 13 October 2026 - 05:12 AM
    "%d %b %Y - %I:%M %p",  # 13 Oct 2026 - 05:12 AM
    "%d %B %Y - %I:%M:%S %p",
    "%d %b %Y - %I:%M:%S %p",
    "%d %B %Y %I:%M %p",
    "%d %b %Y %I:%M %p",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
)

log = logging.getLogger("phivolcs")


class ScrapeError(RuntimeError):
    """Raised when the page cannot be fetched or no earthquake table is found."""


@dataclass
class Quake:
    datetime_pst: datetime
    datetime_utc: datetime
    latitude: float
    longitude: float
    depth_km: Optional[int]
    magnitude: float
    location: str
    bulletin_url: Optional[str]


# --------------------------------------------------------------------------- #
# Fetch
# --------------------------------------------------------------------------- #


def make_session(retries: int = 3) -> requests.Session:
    """requests.Session with a browser User-Agent and retry/backoff on transient errors."""
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    retry = Retry(
        total=retries,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.mount("http://", HTTPAdapter(max_retries=retry))
    return session


def fetch(url: str = BASE_URL, *, timeout: float = TIMEOUT_S, verify: bool = True,
          session: Optional[requests.Session] = None) -> str:
    """GET the page and return its HTML. Raises ScrapeError on any failure."""
    session = session or make_session()
    if not verify:
        import urllib3

        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        log.warning("TLS certificate verification is DISABLED for %s", url)
    try:
        res = session.get(url, timeout=timeout, verify=verify)
    except requests.exceptions.SSLError as exc:
        raise ScrapeError(
            f"TLS verification failed for {url}: {exc}. "
            "If you trust the network path, re-run with --insecure."
        ) from exc
    except requests.exceptions.Timeout as exc:
        raise ScrapeError(f"Timed out after {timeout}s fetching {url}") from exc
    except requests.exceptions.RequestException as exc:
        raise ScrapeError(f"Request to {url} failed: {exc}") from exc

    if res.status_code != 200:
        raise ScrapeError(f"{url} returned HTTP {res.status_code} {res.reason}")
    # The site does not always declare a charset; fall back to detection.
    if not res.encoding or res.encoding.lower() == "iso-8859-1":
        res.encoding = res.apparent_encoding or "utf-8"
    return res.text


# --------------------------------------------------------------------------- #
# Cleaning helpers
# --------------------------------------------------------------------------- #


def _clean_text(s: str) -> str:
    """Collapse whitespace (incl. non-breaking spaces and newlines)."""
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()


_COORD_RE = re.compile(r"(-?\d+(?:\.\d+)?)\s*[°º˚]?\s*([NSEW])?", re.IGNORECASE)


def clean_coords(value: str) -> Optional[float]:
    """Parse '07.80°N', '126.90°E', '12.5 S', '7.80' into a signed decimal.

    N/E are positive, S/W negative. If no hemisphere letter is present the
    number's own sign is kept (PHIVOLCS columns are labelled ºN / ºE).
    """
    m = _COORD_RE.search(_clean_text(value))
    if not m:
        return None
    num = float(m.group(1))
    hemi = (m.group(2) or "").upper()
    if hemi in ("S", "W"):
        num = -abs(num)
    elif hemi in ("N", "E"):
        num = abs(num)
    return num


_NUM_RE = re.compile(r"-?\d+(?:\.\d+)?")


def clean_number(value: str) -> Optional[float]:
    """First number in the string: 'ML 4.5' -> 4.5, '010' -> 10.0, '' -> None."""
    m = _NUM_RE.search(_clean_text(value))
    return float(m.group()) if m else None


def clean_datetime(value: str) -> Optional[datetime]:
    """Parse a PHIVOLCS timestamp (Philippine Standard Time) into a tz-aware datetime."""
    text = _clean_text(value)
    text = re.sub(r"\s*[-–—]\s*", " - ", text)  # normalise dash spacing / en dashes
    text = re.sub(r"\b(PST|PHT|PhST)\b", "", text, flags=re.IGNORECASE).strip()
    for fmt in DATETIME_FORMATS:
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=PST)
        except ValueError:
            continue
    return None


def clean_link(cell: Tag, base_url: str) -> Optional[str]:
    """Absolute bulletin URL from the cell's <a href>. PHIVOLCS uses backslashes in hrefs."""
    a = cell.find("a", href=True)
    if not a:
        return None
    href = a["href"].strip().replace("\\", "/")
    return urljoin(base_url, href)


# --------------------------------------------------------------------------- #
# Parse
# --------------------------------------------------------------------------- #


def _map_header(cells: list[Tag]) -> dict[str, int]:
    """Map field names to column indexes from a header row; empty dict if it isn't one."""
    mapping: dict[str, int] = {}
    for idx, cell in enumerate(cells):
        text = _clean_text(cell.get_text(" ")).lower()
        for field, keywords in HEADER_KEYWORDS.items():
            if field in mapping:
                continue
            if field == "datetime":
                hit = all(k in text for k in keywords)
            else:
                hit = any(text.startswith(k) or f" {k}" in f" {text}" for k in keywords)
            if hit:
                mapping[field] = idx
                break
    return mapping if REQUIRED_FIELDS <= mapping.keys() else {}


def find_quake_table(soup: BeautifulSoup) -> tuple[Tag, dict[str, int]]:
    """Locate the table whose header row has the expected columns and the most rows."""
    best: Optional[tuple[Tag, dict[str, int], int]] = None
    for table in soup.find_all("table"):
        # Skip outer layout tables that merely contain the real one.
        rows = [r for r in table.find_all("tr") if r.find_parent("table") is table]
        for i, row in enumerate(rows[:5]):
            mapping = _map_header(row.find_all(["th", "td"], recursive=False))
            if mapping:
                n = len(rows) - i - 1
                if best is None or n > best[2]:
                    best = (table, mapping, n)
                break
    if best is None:
        raise ScrapeError("No earthquake table found (page layout may have changed).")
    return best[0], best[1]


def parse_row(cells: list[Tag], cols: dict[str, int], base_url: str = BASE_URL) -> Optional[Quake]:
    """Turn one <tr>'s cells into a Quake, or None for header/blank/malformed rows."""
    if len(cells) <= max(cols.values()):
        return None

    def text(field: str) -> str:
        return _clean_text(cells[cols[field]].get_text(" ")) if field in cols else ""

    dt_cell = cells[cols["datetime"]]
    when = clean_datetime(text("datetime"))
    lat = clean_coords(text("latitude"))
    lon = clean_coords(text("longitude"))
    mag = clean_number(text("magnitude"))
    if when is None or lat is None or lon is None or mag is None:
        return None
    depth = clean_number(text("depth"))
    return Quake(
        datetime_pst=when,
        datetime_utc=when.astimezone(timezone.utc),
        latitude=lat,
        longitude=lon,
        depth_km=int(round(depth)) if depth is not None else None,
        magnitude=mag,
        location=text("location"),
        bulletin_url=clean_link(dt_cell, base_url),
    )


def parse(html: str, base_url: str = BASE_URL) -> pd.DataFrame:
    """Parse the bulletin page HTML into a DataFrame (newest first)."""
    soup = BeautifulSoup(html, "html.parser")
    table, cols = find_quake_table(soup)
    records: list[Quake] = []
    skipped = 0
    for row in table.find_all("tr"):
        if row.find_parent("table") is not table:
            continue
        cells = row.find_all(["td", "th"], recursive=False)
        q = parse_row(cells, cols, base_url)
        if q:
            records.append(q)
        elif cells and any(_clean_text(c.get_text()) for c in cells):
            skipped += 1
    log.info("parsed %d rows, skipped %d non-data rows", len(records), skipped)

    df = pd.DataFrame([asdict(r) for r in records], columns=list(Quake.__dataclass_fields__))
    if not df.empty:
        df["depth_km"] = df["depth_km"].astype("Int64")
        df = df.drop_duplicates().sort_values("datetime_pst", ascending=False, ignore_index=True)
    return df


# --------------------------------------------------------------------------- #
# Run
# --------------------------------------------------------------------------- #


def run(url: str = BASE_URL, output: Optional[str] = OUTPUT_CSV, *, min_magnitude: Optional[float] = None,
        verify: bool = True, timeout: float = TIMEOUT_S) -> pd.DataFrame:
    """Fetch, parse, optionally filter by magnitude, and write the CSV."""
    df = parse(fetch(url, timeout=timeout, verify=verify), base_url=url)
    if min_magnitude is not None:
        df = df[df["magnitude"] >= min_magnitude].reset_index(drop=True)
    if output:
        out = df.copy()
        for col in ("datetime_pst", "datetime_utc"):
            out[col] = out[col].map(lambda d: d.isoformat())
        out.to_csv(output, index=False, encoding="utf-8")
    return df


def main(argv: Optional[list[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Scrape DOST-PHIVOLCS earthquake bulletins to CSV.")
    ap.add_argument("--url", default=BASE_URL)
    ap.add_argument("-o", "--output", default=OUTPUT_CSV)
    ap.add_argument("--min-magnitude", type=float, default=None, help="e.g. 4 to keep only M4.0+")
    ap.add_argument("--timeout", type=float, default=TIMEOUT_S)
    ap.add_argument("--insecure", action="store_true", help="disable TLS certificate verification")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO if args.verbose else logging.WARNING, format="%(levelname)s %(message)s")

    try:
        df = run(args.url, args.output, min_magnitude=args.min_magnitude,
                 verify=not args.insecure, timeout=args.timeout)
    except ScrapeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    with pd.option_context("display.max_columns", None, "display.width", 200):
        print(df.head(5).to_string(index=False) if not df.empty else "(no rows)")
    print(f"\nWrote {len(df)} rows to {args.output} (UTF-8).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
