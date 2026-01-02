// Rapier Runtime Modular Loader
//
// Loads (1) rapier.wasm.br parts, (2) rapier3d-compat.js.br parts, (3) react-three-rapier.js.br parts.
//
// NOTE: You can configure parts as sat numbers (recommended) and the loader
// will fetch the latest inscription at that sat via:
//   /r/sat/{sat}/at/-1
// You can also provide full URLs if you prefer.


const DEFAULT_DB = 'rapier-runtime-cache-v1';

function requireDecompressionStream() {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'DecompressionStream("br") not available in this browser. ' +
        'Use a Chromium-based browser (or polyfill) for Brotli-decompressed inscriptions.'
    );
  }
}

async function openDB(dbName = DEFAULT_DB) {
  return new Promise((resolve, reject) => {
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
    cache = true,
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

  let wasmAb = cache ? await idbGet(wasmKey, dbName) : null;
  if (!wasmAb) {
    const br = await fetchConcat(wasmParts);
    wasmAb = await brotliDecompress(br);
    if (cache) await idbSet(wasmKey, wasmAb, dbName);
  }

  let compatJsAb = cache ? await idbGet(compatKey, dbName) : null;
  if (!compatJsAb) {
    const br = await fetchConcat(compatParts);
    compatJsAb = await brotliDecompress(br);
    if (cache) await idbSet(compatKey, compatJsAb, dbName);
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

  let wrapperJsAb = cache ? await idbGet(wrapperKey, dbName) : null;
  if (!wrapperJsAb) {
    const br = await fetchConcat(wrapperParts);
    wrapperJsAb = await brotliDecompress(br);
    if (cache) await idbSet(wrapperKey, wrapperJsAb, dbName);
  }

  const wrapperMod = await importModuleFromBytes(new Uint8Array(wrapperJsAb));

  return {
    compat: compatMod,
    rapier: compatMod,
    r3rapier: wrapperMod,
  };
}
