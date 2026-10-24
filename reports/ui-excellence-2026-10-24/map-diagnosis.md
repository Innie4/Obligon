# Station map capture diagnosis

24 October 2026. Isolated Chrome, local fixture customer, cold 390 × 900 viewport. No application source, backend, authentication or provider configuration changed.

## Finding

The narrow strip of map tiles is reproducible in isolated Chrome's full-page screenshot capture. The map renders correctly in ordinary visible-viewport and iframe captures in the same session. A source change to resize or remount the map is not supported by this evidence.

The current OpenStreetMap export embed uses **MapLibre GL**. It has a WebGL canvas; the application does not own a Leaflet or OpenLayers map instance inside the cross-origin frame.

## Fresh evidence

- The iframe, its document, `#map`, canvas CSS rectangle and canvas drawing buffer all measured **322 × 258** pixels at the 390px application viewport.
- The embed HTML, stylesheet, script and four PNG tiles each returned **HTTP 200**. No provider request failed in this run.
- The provider console contained WebGL `ReadPixels` GPU-stall warnings, without application or tile errors.
- After a five-second cold-page wait, `fullPage: true` showed the narrow left strip.
- The immediately following normal viewport capture showed a correctly rendered map.
- An iframe locator screenshot, which scrolls the frame into view, showed a correctly rendered map.
- A subsequent full-page capture showed the strip again. The following normal viewport capture rendered the map correctly again.

Screenshots:

- `evidence/map-frame-full-before-390.png`
- `evidence/map-frame-viewport-before-390.png`
- `evidence/map-frame-cold-390.png`
- `evidence/map-frame-full-after-390.png`
- `evidence/map-frame-viewport-after-390.png`

DOM dimensions, provider asset responses and console messages are preserved in `evidence/map-frame-dom.json`. The public iframe document is preserved in `evidence/map-frame-source.html`. The isolated check script is `/tmp/obligon-map-dom24.cjs`.

## Verification guidance and limits

Use an ordinary viewport screenshot after scrolling the map into view, or an iframe locator capture, for final visual map checks. Preserve the full-page images as evidence of the capture limitation instead of counting them as a confirmed application sizing failure.

The existing station list, directions, optional map warning, retry and external full-map link remain unchanged. The embed's load event still cannot prove every third-party tile rendered, which is why its state is labelled unverified. This run confirms rendering in this isolated Chrome session; it does not establish delivery or rendering on every production network, mobile browser or future provider version.
