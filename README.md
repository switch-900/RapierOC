# Rapier Inscribe (Best Option: Modular Runtime)

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

## Loader

After you inscribe the parts, fill in the sat-number lists in:
- `rapier-runtime-loader.js` (`RAPiER_WASM_PART_SATS`, `RAPIER_COMPAT_JS_PART_SATS`, `REACT_THREE_RAPIER_JS_PART_SATS`)

Then call:
- `loadRapierRuntime()`

Recommended: configure the loader with SAT numbers so it always fetches the
latest inscription sitting on that sat via:

`/r/sat/{sat}/at/-1`

## Inscription fields (important)

Your tooling may infer encoding from the filename.

- All chunk files are named to **end with `.br`** so tools can detect Brotli.
- Recommended inscription fields for these `.br` files:
  - `content-type`: `application/octet-stream`
  - `encoding`: leave empty / none (do **not** mark them as `br`), because the loader fetches bytes and manually decompresses.

## Notes

- Best practice is **compress then split** (this repo does that for mainnet).
- Set `KEEP_LEGAL=1` to keep license comments in bundled JS outputs.
