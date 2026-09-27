# CoverSlip

Make printable covers for obsolete media. Two formats so far (pick one under **Format**):

- **VHS slip box:** a bottom-load box, 4⅛″ × 1¹⁄₁₆″ × 7⁷⁄₁₆″.
- **Cassette J-card:** 4″ tall, with a 65.1 mm front, a 12.7 mm spine and an adjustable back flap (15.9 mm by default). You can add 0–3 fold-out panels behind the front; the back paragraphs flow across them as a track list.

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
  - Click to select a layer and drag to move it.
  - Drag a corner handle to scale (hold Shift for free aspect ratio on images).
  - Drag the round handle to rotate (hold Shift to snap to 15°).
  - Arrow keys nudge by 1 mm (Shift for 10 mm). Delete/Backspace removes the layer.
  - "Clip to" keeps a layer inside one panel.
- **View:** scroll to pan, ⌘/Ctrl + scroll to zoom, and drag an empty area to pan.
- **Undo:** ⌘/Ctrl+Z to undo, ⇧⌘/Ctrl+Shift+Z to redo.
- **Save / Open:** a `.coverslip.json` file with the images embedded. Work also autosaves in the browser.
- **CMYK:** load the ICC profile your print shop asks for (for example ISO Coated v2 / FOGRA39 from [eci.org](https://www.eci.org/en/downloads)) and choose CMYK. "Soft proof" previews the result on screen. No profile ships with the app, because the ECI profiles can't be redistributed without permission.

## Print

1. Tick **Test print (dieline only)** and print it on plain paper at **100% / actual size**. Cut it out and fold it around a real tape before using good stock. The flap shapes were traced from a template image, so check the fit.
2. Red lines are cuts and dashed blue lines are folds. The open end (with the thumb notches) is at the bottom.
3. The paper list only offers sheets the current format fits on. VHS needs A3 or larger. A J-card fits on A4 (Letter only up to 2 fold-outs).

## Develop

No build step. `lib.js` holds the dieline geometry and the PDF writer, and `app.js` holds the editor.

```sh
node check.mjs   # geometry + PDF xref self-check
```

Adding a format means adding a geometry object shaped like `VHS`/`jcard()` in `lib.js`, plus an entry in `THEMES` in `app.js` that draws its panels.
