# CoverSlip

Make printable covers for obsolete media. Pick a format under **Format**:

| Format | Size (trim) | Fits |
|---|---|---|
| VHS slip box (retail) | 4⅛″ × 1¹⁄₁₆″ × 7⁷⁄₁₆″ box, bottom-load | A3 — or A4 with **Split lid** (2 sheets: body, and lid + flaps on a strip that glues inside the top) |
| VHS slip box, side-load | same box, opens on a long edge; end panels on the back, glue flaps on the front | A3 |
| VHS clamshell wrap (rental) | 11⅝″ × 8⅜″: back 5¼″, spine 1⅛″, front 5¼″ | A3 |
| Cassette J-card | 4″ tall; 65.1 mm front, 12.7 mm spine, adjustable flap (15.9 mm default), 0–3 fold-outs | A4 |
| DVD case wrap | 273 × 183 mm, 14 mm spine | A4 / Letter |
| Blu-ray case wrap | 269 × 148 mm, 12 mm spine (some cases are 14 mm) | A4 / Letter |
| CD jewel case | tray card 151 × 118 mm (6.5 mm spines) + booklet front 120 × 120 mm, side by side | A4 |

**Styles** (left panel) are period designs; any style works on any format, and picking one loads its palette:

| Media | Styles |
|---|---|
| Any | Rainbow Stripes |
| VHS | Blank Tape '84 (silver band, speed stripes) · Rental '91 (photo sleeve — add an image layer — title block, rewind sticker) · Home Recording (ruled label, handwritten) |
| Cassette | Chrome Type II '82 · Normal Bias '79 (colour bars, A/B lines) · Mixtape (lined card, marker) |
| CD | '90s Jewel (colour ramp, disc rings) · Promo CD (not-for-sale band) |
| DVD / Blu-ray | 2000s Keepcase (photo, top billing, credit block) · Numbered Collection |

These are generic period looks, not copies of any brand's packaging.

Case sizes vary a little between manufacturers — print a test (below) and check it in your actual case.

Fill in the retro theme, stack image and text layers on it, and export a 300 DPI PDF (RGB, or CMYK through an ICC profile) or a PNG.

## Run

It needs a web server, because the page loads ES modules and WebAssembly (opening `index.html` from disk won't work):

```sh
python3 -m http.server
# open http://localhost:8000
```

On GitHub Pages it works as-is: Settings → Pages → deploy from branch `main`, root folder.

You need to be online for Google Fonts and for the colour-management library (loaded from jsDelivr the first time you use CMYK).

## Use

- **Theme:** edit the text fields and palette in the left panel. Clearing a field hides that element.
- **Layers:** use `+ Image` / `+ Text`, or drop image files onto the canvas.
  - Shift/⌘-click (canvas or layer list) to select several; ⌘/Ctrl+A selects all. Several selected layers move, nudge, delete and take opacity/blend/clip together.
  - Dragging snaps to panel edges and centres, folds, trim, bleed and other layers (magenta guide lines). Hold Alt to place freely.
  - Click to select a layer and drag to move it.
  - Drag a corner handle to scale (hold Shift for free aspect ratio on images).
  - Drag the round handle to rotate (hold Shift to snap to 15°).
  - Arrow keys nudge by 1 mm (Shift for 10 mm). Delete/Backspace removes the layer.
  - "Clip to" keeps a layer inside one panel.
- **View:** scroll to pan, ⌘/Ctrl + scroll to zoom, and drag an empty area to pan.
- **Undo:** ⌘/Ctrl+Z to undo, ⇧⌘/Ctrl+Shift+Z to redo. The **History** panel (bottom right) lists the last 50 steps; click one to jump there.
- **Fonts:** 8 Google fonts built in. "Upload font…" in a text layer's properties (or drop a `.ttf`/`.otf`/`.woff` on the canvas) adds your own; it's saved inside the project file.
- **Save / Open:** a `.coverslip.json` file with the images embedded. Work also autosaves in the browser.
- **PDF type:** *Raster* (300 DPI, exactly what you see) or *Vector* (text and shapes stay as sharp outlines, photos are embedded at full resolution, blend modes carry over). Vector output is trimmed to the bleed box, not the die shape. For vector export, uploaded fonts must be TTF, OTF or WOFF (not WOFF2).
- **CMYK:** pick a bundled profile — *ISO Coated v2 (FOGRA39)* for gloss/silk coated stock (e.g. Officeworks gloss), *ISO Coated v2 300%* (same, lighter ink), or *PSO Uncoated (FOGRA47)* for plain paper — or load the one your print shop gives you. Choose a rendering intent (perceptual by default); "Soft proof" previews the result on screen. The profile is embedded in the PDF.

## Print

1. Tick **Test print (dieline only)** and print it on plain paper at **100% / actual size**. Cut it out and fold it around a real tape before using good stock. The flap shapes were traced from a template image, so check the fit.
2. Red lines are cuts and dashed blue lines are folds. The open end (with the thumb notches) is at the bottom.
3. The paper list only offers sheets the current format fits on (see the table above). With **Split lid** the PDF has two pages. A J-card fits on A4 (Letter only up to 2 fold-outs).

## Develop

No build step. `lib.js` holds the dieline geometry and the PDF writer, `app.js` the editor, `themes.js` the period styles and `vector.js` the vector-PDF drawing context.

```sh
node check.mjs   # geometry + PDF xref self-check
```

Adding a format means adding a geometry object shaped like `VHS`/`DVD`/`jcard()` in `lib.js` and an entry in `FORMATS` in `app.js`. The theme draws each panel by its role (`front`, `back`, `spine`, `side`, `flap`, `inside`: the panel key without its number), scaling the VHS-height layouts to the panel's height.

## Credits

The bundled CMYK profiles in `profiles/` are by basICColor GmbH, under the zlib/libpng licence (`profiles/LICENSE-ZLIB-bICC`), taken from Debian's `icc-profiles-free` package.
