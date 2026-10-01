# L-Angle Sheets v0.16

Browser-based utility for turning L-Acoustics Soundvision report PDFs into concise crew-ready angle / rigging sheets.

## Run locally

From this folder:

```bash
python serve.py
```

Then open:

```text
http://localhost:8080
```

If another build is already using 8080, run:

```bash
python serve.py 8082
```

and open `http://localhost:8082`.


## v0.16 changes

- Fixed the detailed-sheet header so the hang-colour circle is positioned from the resolved metadata/title layout instead of a fixed page coordinate. Even maximum-length Show / City / Project values now keep a protected gap above the circle.
- Simplified every detailed-sheet bottom-left footer to **page number only** (for example `1 / 19`). Long custom export names are no longer repeated in the footer.
- Added regression coverage for maximum-width `W` metadata with a coloured hang badge, asserting the circle stays below the metadata block and the footer never repeats the export name.
- Retains all v0.15 input limits, automatic Soundvision DANGER flagging, note protection and parser/layout regressions.

## v0.15 changes

- Reworked the detailed-sheet document header so **Show, City, Project name and Revision have dedicated layout space**. Accepted input is rendered in full instead of being replaced with `...`.
- Keeps PDF-safe UI limits for Show (40), City (24), Project name (32), Revision (3 numeric digits), Prepared by (32) and Export name (32). Hang names can use two title lines where required.
- Reduced Notes to a **120-character PDF-safe maximum**, added a live counter, and keeps notes within two lines without ellipsis.
- Prepared by can wrap to two lines beside the company logo rather than being silently truncated.
- Automatically prints a red rounded **DANGER — CHECK SOUNDVISION** badge on every affected detailed sheet when the source Soundvision report contains a `DANGER` mechanical condition. Overview hang headers also show a compact DANGER badge.
- Full Soundvision mechanical-warning text remains optional under **Mechanical warning details**; the DANGER badge is always shown even when details are disabled.
- The source list and live preview distinguish DANGER conditions from lower-level mechanical notices.
- Added a worst-case `W` stress regression for maximum metadata, Prepared by, Export name and Note lengths, plus overflow checks against PDF text widths.
- Keeps Detailed hang sheets and Monochrome Dark as the defaults and retains all earlier parser/layout regressions.

## v0.14 changes

- Protected the revision label in detailed-sheet headers so `REV ###` remained visible when combined metadata became long.
- Added a bounded two-line note area and additional footer protection.
- Added note normalization and browser autocomplete protection to reduce accidental text contamination.

## v0.13 changes

- Replaced the native hang-colour dropdown with a compact custom picker so every preset swatch, including Grey, renders at the same fixed size.
- Export-order help now reads: “Used by both layouts · Every 4 hangs form one multi-hang overview page”.
- Connected both Support L-Angle Sheets links to `https://buymeacoffee.com/tomspencer` and opens the donation page in a new tab.
- Tightened metadata inputs: Show 40 chars, City 24, Project name 32, Prepared by 32.
- Revision is now numeric-only (maximum 3 digits) and is formatted consistently as `REV 1`, `REV 2`, etc.
- Header truncation now strips trailing separators before adding `...`, preventing artifacts such as `·...`.
- Keeps Detailed hang sheets and Monochrome Dark as the defaults, plus all v0.12 parser/layout fixes.

## v0.12 changes

- Detailed-sheet header now uses a fixed two-line metadata band so long Show / City / Project / Revision values cannot crowd or collide with the hang title.
- Detailed preview mirrors that fixed header structure with a reserved metadata band and extra title breathing room.
- Long hang notes now hard-wrap in preview and reserve a protected footer zone in exported PDFs.
- Export-order rows are shaded in alternating groups of four to show overview-page grouping before export.
- Export-order help now reads: “Used by both layouts · Every 4 hangs form one overview page”.
- Keeps Detailed hang sheets and Monochrome Dark as the defaults.
- Retains the v0.10/v0.11 overview cleanup and the ft.in L2 parser fix.

## v0.11 changes

- Detailed hang sheets are the default export and preview again.
- Monochrome Dark is now the default PDF theme.
- Detailed preview header now constrains long show/project/revision and Prepared by values so they cannot collide with the hang title or logo.
- Retains the v0.10 overview cleanup and ft.in L2 parser fix.

## v0.10 changes

- Removed Soundvision **group headings** such as `FLOWN` and `A15 TEST` from multi-hang overview PDFs and overview preview. Grouping is still preserved in the website source list.
- Moved overview **page numbering** to the bottom-left footer so it no longer consumes header height.
- Increased the overview **show-name heading** size and uses the reclaimed header area while keeping City / project / revision as compact secondary metadata.
- Removed the redundant top rule above the overview enclosure-table headers.
- Added a **Monochrome** PDF theme. Light uses black / grey on white; Dark uses white / neutral grey on a charcoal background.
- Updated the landing-page line to: “Turn a Soundvision report into clean, crew-ready angle sheets without the clutter.”
- Retained the v0.9.1 **L2 + ft.in** parser fix and all existing pickup, Panflex, colour, preview and logo behaviour.

## Regression coverage

The development test set includes:

- grouped and ungrouped Soundvision reports;
- 27-box and 33-box mixed hangs;
- K1/K2/K3/KARA II and legacy V-DOSC/dV-DOSC;
- L1 two-module and L2 four-module Panflex;
- L2 `ft.in` reports with no Angle column, including PDF text items that collapse the complete row into a single item;
- A10/A15 fixed-curvature sources;
- A15-BUMP with `F / R`, A15-BUMP+MBAR single-hole pickup, and A15-LIFT numeric/single-hole variants;
- KS28 `EXT / EXT` left/right rigging;
- Soundvision DANGER/WARNING and CAUTION/tipping-hazard mechanical notices;
- metric, inches, pounds and Soundvision `ft.in / lb` reports;
- long metadata / long hang-name stress tests;
- wide, square, tall, opaque and small company-logo shapes.

## Notes

- Processing is local in the browser. The report is not uploaded by this app.
- PDF.js and pdf-lib are currently loaded from public CDNs, so an internet connection is required when the page is first loaded. Bundling these libraries locally is still recommended before a public/offline release.
- Support links point to the configured Buy Me a Coffee page.
- Always verify generated sheets against the original Soundvision report/project and applicable manufacturer documentation before deployment.
