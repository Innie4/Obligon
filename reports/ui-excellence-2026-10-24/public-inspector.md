# Public-page inspector findings

Final production-mode run, 24 October 2026. Raw inspector exit codes are 1 because the stylistic rules below remain flagged. These are disclosed design exceptions and review items, not an all-pass scan. Screenshots/raw JSON remain in the local evidence directory.

FAILs are listed before WARNs. The exact evidence text comes from each saved report; its suggested fix is the detector’s smallest proposed change, not evidence that the change is necessary or implemented.

## FAIL

### `/` · outlined-box · 1440, 768, 390px

5 boxes drawn with a 1px outline.

Detector proposal: Define a surface by its fill (one tone step from the page) or leave the content unboxed.

### `/` · icon-cards · 1440px

1 row(s) of identical cards each topped with a small icon (3 cards).

Detector proposal: Replace with one composed section from the direction: a narrative split, a list set in large type, or real imagery per item.

### `/` · covered-text · 1440, 768, 390px

Large text lies under another element at some scroll position: "Fuel tools for Nigeria" (screen 1, 25% hidden)

Detector proposal: Nothing may sit on top of a headline or statement. Move the picture, shorten the pinned run, or raise the text above it (z-index) and give it a ground.

### `/` · still-page · 1440px

Only 0 element(s) moved while the page loaded and scrolled.

Detector proposal: Build the motion layer (SKILL.md step 9, references/motion.md): the signature move, an entrance for the parts of every section, feedback on every control, and one moving picture. Transform and opacity only, with a reduced-motion fallback.

### `/solutions/fuelvista` · shadow · 1440, 768, 390px

1 box-shadow(s) on elements at rest: button.inline-flex.h-11 → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(29, 47,

Detector proposal: Remove. Separate surfaces with a tone step or space. Shadows are for things that really float (menus, dialogs, sticky bars).

### `/solutions/fuelvista` · few-pictures · 1440px

Only 2 picture(s) on the page (2 photographs, footage or raster images, 0 interface fragments). Drawings in SVG do not count.

Detector proposal: Find real pictures of the subject's world with scripts/assets.mjs (photographs, archival images, maps, engravings, footage), download them to assets/ and give them room: a hero picture, one per section that has a subject, a full-width band. At least four, usually six to twelve.

### `/solutions/fuelvista` · focal-point · 1440px

The first screen has no dominant element: the largest type is 64px (4.4vw) and no single picture holds a third of the viewport.

Detector proposal: Make one thing lead: the headline at display size, or one large picture. A grid of many small pictures is not one thing; in blind tests jurors marked a first screen without a headline down every time. On the strongest studied sites the largest type has a median of 8.4vw.

### `/solutions/fuelvista` · covered-text · 1440, 768, 390px

Large text lies under another element at some scroll position: "FuelVista tools" (screen 1, 38% hidden)

Detector proposal: Nothing may sit on top of a headline or statement. Move the picture, shorten the pinned run, or raise the text above it (z-index) and give it a ground.

### `/solutions/fuelvista` · still-page · 1440px

Only 0 element(s) moved while the page loaded and scrolled.

Detector proposal: Build the motion layer (SKILL.md step 9, references/motion.md): the signature move, an entrance for the parts of every section, feedback on every control, and one moving picture. Transform and opacity only, with a reduced-motion fallback.

### `/solutions/genvista` · shadow · 1440, 768, 390px

1 box-shadow(s) on elements at rest: button.inline-flex.h-11 → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(29, 47,

Detector proposal: Remove. Separate surfaces with a tone step or space. Shadows are for things that really float (menus, dialogs, sticky bars).

### `/solutions/genvista` · few-pictures · 1440px

Only 1 picture(s) on the page (1 photographs, footage or raster images, 0 interface fragments). Drawings in SVG do not count.

Detector proposal: Find real pictures of the subject's world with scripts/assets.mjs (photographs, archival images, maps, engravings, footage), download them to assets/ and give them room: a hero picture, one per section that has a subject, a full-width band. At least four, usually six to twelve.

### `/solutions/genvista` · focal-point · 1440px

The first screen has no dominant element: the largest type is 64px (4.4vw) and no single picture holds a third of the viewport.

Detector proposal: Make one thing lead: the headline at display size, or one large picture. A grid of many small pictures is not one thing; in blind tests jurors marked a first screen without a headline down every time. On the strongest studied sites the largest type has a median of 8.4vw.

### `/solutions/genvista` · covered-text · 1440, 768, 390px

Large text lies under another element at some scroll position: "GenVista tools" (screen 1, 38% hidden)

Detector proposal: Nothing may sit on top of a headline or statement. Move the picture, shorten the pinned run, or raise the text above it (z-index) and give it a ground.

### `/solutions/genvista` · still-page · 1440px

Only 0 element(s) moved while the page loaded and scrolled.

Detector proposal: Build the motion layer (SKILL.md step 9, references/motion.md): the signature move, an entrance for the parts of every section, feedback on every control, and one moving picture. Transform and opacity only, with a reduced-motion fallback.

### `/solutions/energyvista` · shadow · 1440, 768, 390px

1 box-shadow(s) on elements at rest: button.inline-flex.h-11 → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(29, 47,

Detector proposal: Remove. Separate surfaces with a tone step or space. Shadows are for things that really float (menus, dialogs, sticky bars).

### `/solutions/energyvista` · few-pictures · 1440px

Only 1 picture(s) on the page (1 photographs, footage or raster images, 0 interface fragments). Drawings in SVG do not count.

Detector proposal: Find real pictures of the subject's world with scripts/assets.mjs (photographs, archival images, maps, engravings, footage), download them to assets/ and give them room: a hero picture, one per section that has a subject, a full-width band. At least four, usually six to twelve.

### `/solutions/energyvista` · focal-point · 1440px

The first screen has no dominant element: the largest type is 64px (4.4vw) and no single picture holds a third of the viewport.

Detector proposal: Make one thing lead: the headline at display size, or one large picture. A grid of many small pictures is not one thing; in blind tests jurors marked a first screen without a headline down every time. On the strongest studied sites the largest type has a median of 8.4vw.

### `/solutions/energyvista` · covered-text · 1440, 768, 390px

Large text lies under another element at some scroll position: "EnergyVista tools" (screen 1, 50% hidden)

Detector proposal: Nothing may sit on top of a headline or statement. Move the picture, shorten the pinned run, or raise the text above it (z-index) and give it a ground.

### `/solutions/energyvista` · still-page · 1440px

Only 0 element(s) moved while the page loaded and scrolled.

Detector proposal: Build the motion layer (SKILL.md step 9, references/motion.md): the signature move, an entrance for the parts of every section, feedback on every control, and one moving picture. Transform and opacity only, with a reduced-motion fallback.

## WARN

### `/` · size-count · 1440, 768, 390px

10 different font sizes (12, 13, 14, 16, 18, 20, 30, 36, 48, 80).

Detector proposal: A page needs about five: display, heading, lead, body, small.

### `/` · no-footage · 1440px

No video anywhere on the page.

Detector proposal: Look for one honest clip with scripts/assets.mjs --video (the place, the material, the process) and use it as a muted loop with a poster frame. Defend its absence only if no clip fits the subject.

### `/` · small-text · 1440, 768, 390px

1 text block(s) under 13px.

Detector proposal: Nothing meant to be read goes below 13px.

### `/solutions/fuelvista` · hairline · 1440, 768, 390px

1 thin rule(s)/divider line(s): div.mt-7.grid 520px

Detector proposal: Delete. Separate with space, a tone change, or scale. Lines are only for real tables and form fields.

### `/solutions/fuelvista` · outlined-box · 1440, 768, 390px

1 box(es) drawn with a 1px outline.

Detector proposal: Prefer a filled surface or no box.

### `/solutions/fuelvista` · size-count · 1440, 768, 390px

10 different font sizes (12, 13, 14, 16, 18, 20, 24, 30, 36, 64).

Detector proposal: A page needs about five: display, heading, lead, body, small.

### `/solutions/fuelvista` · no-footage · 1440px

No video anywhere on the page.

Detector proposal: Look for one honest clip with scripts/assets.mjs --video (the place, the material, the process) and use it as a muted loop with a poster frame. Defend its absence only if no clip fits the subject.

### `/solutions/fuelvista` · small-text · 1440, 768, 390px

1 text block(s) under 13px.

Detector proposal: Nothing meant to be read goes below 13px.

### `/solutions/genvista` · hairline · 1440, 768, 390px

1 thin rule(s)/divider line(s): div.mt-7.grid 520px

Detector proposal: Delete. Separate with space, a tone change, or scale. Lines are only for real tables and form fields.

### `/solutions/genvista` · outlined-box · 1440, 768, 390px

1 box(es) drawn with a 1px outline.

Detector proposal: Prefer a filled surface or no box.

### `/solutions/genvista` · size-count · 1440, 768, 390px

10 different font sizes (12, 13, 14, 16, 18, 20, 24, 30, 36, 64).

Detector proposal: A page needs about five: display, heading, lead, body, small.

### `/solutions/genvista` · no-footage · 1440px

No video anywhere on the page.

Detector proposal: Look for one honest clip with scripts/assets.mjs --video (the place, the material, the process) and use it as a muted loop with a poster frame. Defend its absence only if no clip fits the subject.

### `/solutions/genvista` · small-text · 1440, 768, 390px

1 text block(s) under 13px.

Detector proposal: Nothing meant to be read goes below 13px.

### `/solutions/energyvista` · hairline · 1440, 768, 390px

1 thin rule(s)/divider line(s): div.mt-7.grid 520px

Detector proposal: Delete. Separate with space, a tone change, or scale. Lines are only for real tables and form fields.

### `/solutions/energyvista` · outlined-box · 1440, 768, 390px

1 box(es) drawn with a 1px outline.

Detector proposal: Prefer a filled surface or no box.

### `/solutions/energyvista` · size-count · 1440, 768, 390px

10 different font sizes (12, 13, 14, 16, 18, 20, 24, 30, 36, 64).

Detector proposal: A page needs about five: display, heading, lead, body, small.

### `/solutions/energyvista` · no-footage · 1440px

No video anywhere on the page.

Detector proposal: Look for one honest clip with scripts/assets.mjs --video (the place, the material, the process) and use it as a muted loop with a poster frame. Defend its absence only if no clip fits the subject.

### `/solutions/energyvista` · small-text · 1440, 768, 390px

1 text block(s) under 13px.

Detector proposal: Nothing meant to be read goes below 13px.

## Decision record

- Eyebrows and redundant static button shadows in the main solution content were removed. The remaining shadow rule concerns shared footer/consent controls; it is a stylistic preference rather than a detected interaction failure.
- Outlined surfaces and restrained feature rows distinguish plan choices and operational content within the retained brand. A complete brand replacement was not made.
- No invented photographs, decorative video or unsupported service proof was added to satisfy image counts. Authentic card imagery and factual enquiry content remain.
- Headline scale is intentionally readable within the retained two-column solution layout. The public hero retains its brand composition.
- Sticky navigation is opaque and can cover content scrolled behind it. Anchor offsets and actual viewport containment were checked; a sampled scroll overlap rule is not silently relabelled as a pass.
- Motion remains tied to state/control feedback, with reduced-motion support. Entrance animation and moving imagery were not added purely to raise a style score.
- Metadata sizes and the type scale retain existing brand roles. All representative WCAG A/AA automated checks detect zero violations; this does not certify every screen reader or physical device.
