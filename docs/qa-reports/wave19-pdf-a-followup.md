# Wave-19-W10: PDF/A-2b Conformance Follow-Up

**Status:** Pending — not blocking v0.2 alpha.
**Tracker:** Wave-19 closure spec, item W19-W10.

## What we have today

ARCTOS uses [pdfkit](https://www.npmjs.com/package/pdfkit) for all PDF
exports (4 routes: risk-register, audit-trail, DPIA export, audit
report). The current output is **standards-conformant PDF 1.3** with:

- Correct `%PDF-1.x` magic bytes (ISO 32000-1 §7.5.2)
- Correct `%%EOF` end-of-file marker (§7.5.5)
- Info dictionary with Title / Author / Creator / Producer entries
- Filename sanitization in `Content-Disposition`

These properties are pinned by
`apps/web/src/__tests__/lib/pdf-output-contract.test.ts`.

## What PDF/A-2b would additionally require

[ISO 19005-2](https://www.iso.org/standard/50655.html) PDF/A-2b adds:

1. **XMP metadata stream** — `xmp:CreateDate`, `xmp:ModifyDate`,
   `pdfaid:part="2"`, `pdfaid:conformance="B"` in an XML packet.
   pdfkit doesn't write these.
2. **OutputIntent + ICC color profile** — typically `sRGB IEC61966-2.1`
   embedded as a stream object. pdfkit can include streams but no
   helper for OutputIntent.
3. **Font embedding (full subsets)** — every font (including the
   default Helvetica) must be embedded. pdfkit ships with the 14
   standard PDF fonts as references rather than embedded.
4. **No external references** — no `/URI` actions to outside content.
   Some templates currently link to ARCTOS detail pages.
5. **No transparency** — pdfkit's `fillOpacity` / blend modes would
   need to be removed.
6. **MarkInfo + StructTreeRoot** for accessibility (PDF/UA-1).

## Why not in this PR

A PDF/A-2b pass needs either:

- **Replace pdfkit with `@react-pdf/renderer` + `pdf-lib`** — `pdf-lib`
  has the lower-level primitives but no PDF/A helper either; we'd
  still build the XMP + OutputIntent ourselves. Estimated 3-5 days
  for the 4 export routes + tests.
- **Post-process via Ghostscript** — `gs -dPDFA -dPDFACompatibilityPolicy=1`
  reliably converts a normal PDF to PDF/A-2b. Adds a system dependency
  to the Docker image (Ghostscript itself is GPL-3, but the binary
  invocation is not a derivative work — cleared with legal in Wave 12
  during the Puppeteer discussion). Estimated 1-2 days.

Either is larger than fits in the Wave-19 closure PR.

## Recommendation

Track as **W20-PDF-A-01** in the next sprint. Pick the Ghostscript
post-process path (fewer code changes, isolated impact, easier to
revert) and ship as a Docker-image upgrade + a single
`packages/reporting/src/pdfa-postprocess.ts` helper.

## What's pinned today

- 7 vitest assertions on the current PDF output contract
  (`pdf-output-contract.test.ts`)
- Filename-sanitization regression guard (path-traversal + shell
  metachar input → safe `[a-zA-Z0-9_-.]+\.pdf` filename)
- Empty-section + null-cell rendering paths covered

## Acceptance criteria for the follow-up PR

- [ ] All 4 PDF endpoints emit PDF/A-2b (validated via veraPDF or
      Adobe Acrobat preflight)
- [ ] `pdfaid:part="2"` appears in the XMP stream
- [ ] OutputIntent with sRGB ICC profile embedded
- [ ] `apps/web/src/__tests__/lib/pdf-output-contract.test.ts` extended
      with PDF/A-2b assertions (XMP regex, ICC profile object presence)
- [ ] Docker image size delta < 50 MB (Ghostscript adds ~30 MB)
