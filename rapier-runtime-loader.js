// Rapier Runtime Modular Loader
//
// Loads (1) rapier.wasm.br parts, (2) rapier3d-compat.js.br parts, (3) react-three-rapier.js.br parts.
//
// NOTE: You can configure parts as sat numbers (recommended) and the loader
// will fetch the latest inscription at that sat via:
//   /r/sat/{sat}/at/-1
// You can also provide full URLs if you prefer.


const DEFAULT_DB = 'rapier-runtime-cache-v1';

function hasIndexedDB() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB != null;
  } catch {
    return false;
  }
}

function requireDecompressionStream() {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'DecompressionStream("br") not available in this browser. ' +
        'Use a Chromium-based browser (or polyfill) for Brotli-decompressed inscriptions.'
    );
  }
}

function sliceArrayBuffer(view) {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

function looksLikeWasm(u8) {
  return (
    u8.byteLength >= 4 &&
    u8[0] === 0x00 &&
    u8[1] === 0x61 &&
    u8[2] === 0x73 &&
    u8[3] === 0x6d
  );
}

function looksLikeUtf8Js(u8) {
  // Heuristic: first ~64 bytes are typical JS ASCII (no NULs).
  // This is only used to decide whether we can proceed without Brotli.
  const n = Math.min(64, u8.byteLength);
  if (n === 0) return false;
  for (let i = 0; i < n; i++) {
    const c = u8[i];
    if (c === 0x00) return false;
    // allow: tab/newline/carriage return and printable ASCII
    const ok = c === 0x09 || c === 0x0a || c === 0x0d || (c >= 0x20 && c <= 0x7e);
    if (!ok) return false;
  }
  return true;
}

async function openDB(dbName = DEFAULT_DB) {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key, dbName = DEFAULT_DB) {
  const db = await openDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function safeIdbGet(key, dbName) {
  try {
    return await idbGet(key, dbName);
  } catch {
    return null;
  }
}

async function safeIdbSet(key, value, dbName) {
  try {
    await idbSet(key, value, dbName);
  } catch {
    // Best-effort cache: ignore (common in iframes / privacy contexts)
  }
}

async function idbSet(key, value, dbName = DEFAULT_DB) {
  const db = await openDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function toLatestSatPath(sat) {
  return `/r/sat/${sat}/at/-1`;
}

function normalizePartToUrl(part) {
  if (typeof part === 'number') return toLatestSatPath(part);
  const s = String(part).trim();
  if (!s) throw new Error('Empty part');
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  // If you pass a numeric string, treat it as a sat.
  if (/^\d+$/.test(s)) return toLatestSatPath(s);
  // Otherwise treat it as a raw path.
  if (s.startsWith('/')) return s;
  // As a last resort, assume user intended a path.
  return '/' + s;
}

async function fetchConcat(parts) {
  const urls = parts.map((p) => normalizePartToUrl(p));
  const bufs = await Promise.all(
    urls.map((u) =>
      fetch(u).then((r) => {
        if (!r.ok) throw new Error(`Fetch failed: ${u} (${r.status})`);
        return r.arrayBuffer();
      })
    )
  );

  const total = bufs.reduce((n, b) => n + b.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of bufs) {
    out.set(new Uint8Array(b), off);
    off += b.byteLength;
  }
  return out;
}

async function brotliDecompress(brBytes) {
  requireDecompressionStream();
  const ds = new DecompressionStream('br');
  const stream = new Blob([brBytes]).stream().pipeThrough(ds);
  const ab = await new Response(stream).arrayBuffer();
  return ab;
}

async function maybeBrotliDecompress(bytes, kind) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  // If Brotli isn't available, proceed only if the data already looks decoded.
  if (typeof DecompressionStream === 'undefined') {
    const decodedOk =
      kind === 'wasm' ? looksLikeWasm(u8) : kind === 'js' ? looksLikeUtf8Js(u8) : false;

    if (!decodedOk) {
      throw new Error(
        'DecompressionStream("br") not available, and fetched bytes do not look already-decompressed. '
      );
    }

    return sliceArrayBuffer(u8);
  }

  // Try Brotli-decompress first; if it fails, assume server already decoded it.
  try {
    return await brotliDecompress(u8);
  } catch {
    return sliceArrayBuffer(u8);
  }
}

async function importModuleFromBytes(jsBytes) {
  const blobUrl = URL.createObjectURL(
    new Blob([jsBytes], { type: 'text/javascript' })
  );
  try {
    return await import(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

// Fill these in after inscription.
// Recommended: put SAT NUMBERS here (as numbers or numeric strings).
// Each will be fetched as: /r/sat/{sat}/at/-1
export const RAPiER_WASM_PART_SATS = [
  // 1234567890123,
];

export const RAPIER_COMPAT_JS_PART_SATS = [
  // 1234567890456,
];

export const REACT_THREE_RAPIER_JS_PART_SATS = [
  // 1234567890789,
];

export async function loadRapierRuntime(options = {}) {
  const {
    // Default OFF: IndexedDB is often blocked in iframes / privacy contexts.
    // Opt-in with { cache: true } when you control the top-level environment.
    cache = false,
    dbName = DEFAULT_DB,
    wasmKey = 'wasm:rapier.wasm',
    compatKey = 'js:rapier3d-compat',
    wrapperKey = 'js:react-three-rapier',
    wasmParts = RAPiER_WASM_PART_SATS,
    compatParts = RAPIER_COMPAT_JS_PART_SATS,
    wrapperParts = REACT_THREE_RAPIER_JS_PART_SATS,
  } = options;

  if (!wasmParts.length) throw new Error('No WASM parts configured');
  if (!compatParts.length) throw new Error('No compat JS parts configured');
  if (!wrapperParts.length) throw new Error('No @react-three/rapier parts configured');

  const canCache = !!cache;

  let wasmAb = canCache ? await safeIdbGet(wasmKey, dbName) : null;
  if (!wasmAb) {
    const br = await fetchConcat(wasmParts);
    wasmAb = await maybeBrotliDecompress(br, 'wasm');
    if (canCache) await safeIdbSet(wasmKey, wasmAb, dbName);
  }

  let compatJsAb = canCache ? await safeIdbGet(compatKey, dbName) : null;
  if (!compatJsAb) {
    const br = await fetchConcat(compatParts);
    compatJsAb = await maybeBrotliDecompress(br, 'js');
    if (canCache) await safeIdbSet(compatKey, compatJsAb, dbName);
  }

  const compatMod = await importModuleFromBytes(new Uint8Array(compatJsAb));

  // Initialize rapier3d-compat with inscribed WASM bytes
  // Depending on bundling/minification, init may be exported as `init` (named)
  // or as the module default. Prefer named `init` when present.
  const init =
    typeof compatMod?.init === 'function'
      ? compatMod.init
      : typeof compatMod?.default === 'function'
        ? compatMod.default
        : null;
  if (!init) {
    throw new Error('Loaded compat module missing init() (named or default)');
  }
  await init(wasmAb);

  let wrapperJsAb = canCache ? await safeIdbGet(wrapperKey, dbName) : null;
  if (!wrapperJsAb) {
    const br = await fetchConcat(wrapperParts);
    wrapperJsAb = await maybeBrotliDecompress(br, 'js');
    if (canCache) await safeIdbSet(wrapperKey, wrapperJsAb, dbName);
  }

  const wrapperMod = await importModuleFromBytes(new Uint8Array(wrapperJsAb));

  return {
    compat: compatMod,
    rapier: compatMod,
    r3rapier: wrapperMod,
  };
}
