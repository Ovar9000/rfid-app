"""Offline tests. The HTML fixture imitates the PHIVOLCS bulletin layout
(nested layout tables, <strong> headers, backslash hrefs); its rows are
synthetic, not real events."""

import os
import sys
import tempfile
import unittest
from datetime import timezone
from unittest import mock

import pandas as pd
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import phivolcs_scraper as ps  # noqa: E402

FIXTURE = """
<html><body>
<table class="layout"><tr><td>
  <table><tr><td><a href="/">Home</a></td><td><a href="/about">About</a></td></tr></table>
  <table class="MsoNormalTable">
    <tbody>
      <tr>
        <td><p><strong>Date - Time<br>(Philippine Time)</strong></p></td>
        <td><strong>Latitude<br>(&ordm;N)</strong></td>
        <td><strong>Longitude<br>(&ordm;E)</strong></td>
        <td><strong>Depth<br>(km)</strong></td>
        <td><strong>Mag</strong></td>
        <td><strong>Location</strong></td>
      </tr>
      <tr>
        <td><a href="2026_Earthquake_Information\\October\\2026_1013_2112_B1.html">13&nbsp;October 2026 - 09:12 PM</a></td>
        <td>07.80</td><td>126.90</td><td>010</td><td>4.6</td>
        <td>024 km S 45&deg; E of Test Town (Test Province)</td>
      </tr>
      <tr>
        <td><a href="2026_Earthquake_Information/October/2026_1013_0305_B1.html">13 Oct 2026 - 03:05 AM</a></td>
        <td>12.50&deg;N</td><td>121.25&deg;E</td><td>001</td><td>2.1</td>
        <td>005 km N of Sample City</td>
      </tr>
      <tr><td colspan="6">&nbsp;</td></tr>
      <tr>
        <td>12 October 2026 - 11:59 PM</td>
        <td>04.10 S</td><td>119.00 W</td><td></td><td>ML 3.0</td><td>No link row</td>
      </tr>
      <tr><td>not a date</td><td>x</td><td>y</td><td>z</td><td>w</td><td>junk</td></tr>
    </tbody>
  </table>
</td></tr></table>
</body></html>
"""


class CleanHelpers(unittest.TestCase):
    def test_coords(self):
        self.assertEqual(ps.clean_coords("07.80°N"), 7.8)
        self.assertEqual(ps.clean_coords("126.90°E"), 126.9)
        self.assertEqual(ps.clean_coords("12.5 S"), -12.5)
        self.assertEqual(ps.clean_coords("45.0ºW"), -45.0)
        self.assertEqual(ps.clean_coords("07.80"), 7.8)
        self.assertEqual(ps.clean_coords("-3.2"), -3.2)
        self.assertIsNone(ps.clean_coords("n/a"))

    def test_numbers(self):
        self.assertEqual(ps.clean_number("010"), 10.0)
        self.assertEqual(ps.clean_number("ML 4.5"), 4.5)
        self.assertIsNone(ps.clean_number(""))

    def test_datetime_is_pst_and_converts_to_utc(self):
        dt = ps.clean_datetime("13 October 2026 - 09:12 PM")
        self.assertEqual(dt.isoformat(), "2026-10-13T21:12:00+08:00")
        self.assertEqual(dt.astimezone(timezone.utc).isoformat(), "2026-10-13T13:12:00+00:00")
        self.assertIsNotNone(ps.clean_datetime("13 Oct 2026 – 03:05 AM PST"))
        self.assertIsNone(ps.clean_datetime("Date - Time"))


class Parse(unittest.TestCase):
    def setUp(self):
        self.df = ps.parse(FIXTURE, base_url="https://earthquake.phivolcs.dost.gov.ph/")

    def test_keeps_only_data_rows_newest_first(self):
        self.assertEqual(len(self.df), 3)
        self.assertEqual(list(self.df["magnitude"]), [4.6, 2.1, 3.0])

    def test_values(self):
        first = self.df.iloc[0]
        self.assertEqual((first.latitude, first.longitude, first.depth_km), (7.8, 126.9, 10))
        self.assertEqual(first.location, "024 km S 45° E of Test Town (Test Province)")
        last = self.df.iloc[2]
        self.assertEqual((last.latitude, last.longitude), (-4.1, -119.0))
        self.assertTrue(pd.isna(last.depth_km))

    def test_links_are_absolute_with_forward_slashes(self):
        self.assertEqual(
            self.df.iloc[0].bulletin_url,
            "https://earthquake.phivolcs.dost.gov.ph/2026_Earthquake_Information/October/2026_1013_2112_B1.html",
        )
        self.assertTrue(pd.isna(self.df.iloc[2].bulletin_url))

    def test_no_table_raises(self):
        with self.assertRaises(ps.ScrapeError):
            ps.parse("<table><tr><td>Home</td></tr></table>")


class FetchAndRun(unittest.TestCase):
    def _session(self, status=200, text=FIXTURE, exc=None):
        s = mock.Mock(spec=requests.Session)
        if exc:
            s.get.side_effect = exc
        else:
            s.get.return_value = mock.Mock(status_code=status, reason="X", text=text, encoding="utf-8")
        return s

    def test_http_error_raises(self):
        with self.assertRaises(ps.ScrapeError):
            ps.fetch(session=self._session(status=503))

    def test_timeout_raises(self):
        with self.assertRaises(ps.ScrapeError):
            ps.fetch(session=self._session(exc=requests.exceptions.Timeout()))

    def test_ssl_error_suggests_insecure(self):
        with self.assertRaisesRegex(ps.ScrapeError, "--insecure"):
            ps.fetch(session=self._session(exc=requests.exceptions.SSLError("bad chain")))

    def test_run_filters_and_writes_utf8_csv(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(ps, "fetch", return_value=FIXTURE):
            out = os.path.join(d, "out.csv")
            df = ps.run(output=out, min_magnitude=4)
            self.assertEqual(len(df), 1)
            csv = pd.read_csv(out, encoding="utf-8")
            self.assertEqual(csv.loc[0, "datetime_pst"], "2026-10-13T21:12:00+08:00")
            self.assertIn("°", csv.loc[0, "location"])


if __name__ == "__main__":
    unittest.main()
