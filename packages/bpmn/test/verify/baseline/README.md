# Reference images for the visual comparison

These PNGs are what `test/verify/raster.test.ts` compares against. They are the
automated form of the one check that actually found the spike's two worst
defects: looking at the picture.

## Regenerating them

```
cd packages/bpmn
UPDATE_BASELINES=1 npx vitest run --config vitest.config.ts test/verify/raster.test.ts
```

That rewrites every file here. **Then look at the images.** A regeneration is an
acceptance of a visual change, so the commit message has to say which change is
being accepted — "baselines updated" alone is indistinguishable from having
deleted the test.

A single failing case also writes `<name>.failed.png` next to its reference, so
the two can be opened side by side before deciding.

## How the comparison decides

Not by a percentage of differing pixels — antialiasing and a shifted edge change
about the same number. By shape: the difference mask is eroded, and a pixel
survives only where the differing region is at least two pixels thick in both
directions. A one-pixel antialiasing fringe cannot survive that; a stroke that
moved by two pixels cannot avoid it. The reasoning, and the mistake that was
made first (a full 3×3 erosion, which needs three pixels and let a two-pixel
shift through), are in the header of `src/verify/raster.ts`.

## What these images do not prove

- **Fonts.** `cairosvg` resolves `sans-serif` through the machine's fontconfig.
  On a machine with different fonts every glyph differs and the comparison fails
  for a reason that has nothing to do with the renderer. Pin the environment, or
  read a failure here as "look at the image", never as "the renderer broke".
- **Colour and contrast.** The images are compared against each other, not
  against a contrast requirement. The a11y rules in plan §6.6 are a separate job.
- **Anything the renderer already gets wrong.** A baseline records the current
  drawing, defects included. Two known ones are visible in
  `synth-collaboration-pools-lanes.png`: message flows have no circle at their
  origin, and long labels overflow their shape. Both are noted in
  `SPIKE-ENTSCHEIDUNG.md` as open renderer items — the baseline freezes them so
  that fixing them shows up as a deliberate change rather than as drift.

## The selection

Eleven diagrams: three from the repository and eight hard cases, chosen so that
every shape family the renderer has an opinion about appears at least once —
events, gateways, task types, boundary events, pools and lanes, data objects
and artifacts, nested sub-processes, and one with umlauts and CDATA so that text
handling is in the picture too. The list is in `test/verify/raster.test.ts`;
keeping it small is deliberate (plan §6.3).
