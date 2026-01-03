# RapierOC

This repo produces inscription-ready, Brotli-compressed + chunked Rapier artifacts **without bundling React/Three**, intended for reuse across multiple inscriptions.

## Recommended build

```bash
npm install
npm run clean
npm run build

# Optional (recommended): verify the generated artifacts are reassemblable + decompress correctly
npm run verify

# Optional: check build determinism (rebuild and ensure byte-for-byte identical)
npm run verify:determinism
```

Output:
- `inscriptions/rapier-runtime/`
  - `wasm/aa.rapier.wasm.br`, `wasm/ab.rapier.wasm.br`, ...
  - `js/aa.rapier3d-compat.js.br`, `js/ab.rapier3d-compat.js.br`, ...
  - `js/react-three-rapier.js.br`
  - `INSCRIPTION-REPORT.txt`

This is the lowest long-term cost approach:
- You inscribe the heavier runtime pieces once (WASM + compat glue)
- Future apps can reuse them and only inscribe small wrappers as needed

## Runtime requirements (must be in your on-chain import map)

- `react`
- `three`
- `@react-three/fiber`
- `BufferGeometryUtils`

Version note:
- If your inscribed app is `react@18` and `@react-three/fiber@8`, use `@react-three/rapier@1.x`.
- `@react-three/rapier@2.x` targets newer majors (React 19 / R3F 9).

## Loader

After you inscribe the parts, fill in the sat-number lists in:
- `rapier-runtime-loader.js` (`RAPiER_WASM_PART_SATS`, `RAPIER_COMPAT_JS_PART_SATS`, `REACT_THREE_RAPIER_JS_PART_SATS`)

Then call:
- `loadRapierRuntime()`

By default, the loader does **not** use IndexedDB caching (this is more reliable
in iframes / privacy-restricted contexts). If you control the top-level page and
want caching, call:

`loadRapierRuntime({ cache: true })`

Recommended: configure the loader with SAT numbers so it always fetches the
latest inscription sitting on that sat via:

`/r/sat/{sat}/at/-1`

## Inscription fields (important)

Your tooling may infer encoding from the filename.

- All chunk files are named to **end with `.br`** so tools can detect Brotli.
- Recommended inscription fields for these `.br` files:
  - `content-type`: `application/octet-stream`
  - `encoding`: leave empty / none (do **not** mark them as `br`), because the loader fetches bytes and manually decompresses.

If your host (e.g. ordinals.com) serves the bytes already decompressed (via a decode path
or `Content-Encoding: br` handling), the loader will also work: it tries Brotli-decompress
first and falls back to treating the response as already-decoded.

## Notes

- Best practice is **compress then split** (this repo does that for mainnet).
- Set `KEEP_LEGAL=1` to keep license comments in bundled JS outputs.

