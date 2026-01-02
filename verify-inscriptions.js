#!/usr/bin/env node
/*
  Verify inscription artifacts can be correctly rebuilt.

  What it checks:
  - Reads inscriptions/rapier-runtime/INSCRIPTION-REPORT.txt
  - Reassembles .br.part-* files in the order listed
  - Brotli-decompresses the reassembled payloads
  - Verifies WASM magic header (\0asm)
  - Syntax-checks JS payloads (via esbuild transform)
  - Imports compat JS bundle and asserts it exports default init()

  Usage:
    npm run build
    node ./verify-inscriptions.js

  Optional determinism check:
    node ./verify-inscriptions.js --rebuild-and-compare
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { pathToFileURL } = require('url');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function readUtf8(p) {
  return fs.readFileSync(p, 'utf8');
}

function readBin(p) {
  return fs.readFileSync(p);
}

function mustExist(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);
}

function repoPath(...parts) {
  return path.resolve(__dirname, ...parts);
}

function findReportPath() {
  const p = repoPath('inscriptions', 'rapier-runtime', 'INSCRIPTION-REPORT.txt');
  if (fs.existsSync(p)) return p;
  throw new Error('Could not find inscriptions/rapier-runtime/INSCRIPTION-REPORT.txt. Run: npm run build');
}

function parseFilesToInscribe(reportText) {
  const lines = reportText.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => l.trim() === 'FILES TO INSCRIBE:');
  if (startIdx === -1) throw new Error('Report missing "FILES TO INSCRIBE" section');

  const files = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (!l.startsWith('- ')) continue;
    files.push(l.slice(2).trim());
  }
  if (!files.length) throw new Error('No files found under "FILES TO INSCRIBE"');
  return files;
}

function groupByArtifact(files) {
  const wasm = [];
  const compat = [];
  const wrapper = [];

  for (const rel of files) {
    const normalized = rel.replace(/\\/g, '/');
    if (normalized.includes('/wasm/') && normalized.endsWith('rapier.wasm.br')) wasm.push(rel);
    else if (normalized.includes('/js/') && normalized.endsWith('rapier3d-compat.js.br')) compat.push(rel);
    else if (normalized.includes('/js/') && normalized.endsWith('react-three-rapier.js.br')) wrapper.push(rel);
    else {
      throw new Error(`Unrecognized artifact path in report: ${rel}`);
    }
  }

  if (!wasm.length) throw new Error('Report did not list any WASM parts');
  if (!compat.length) throw new Error('Report did not list any compat JS parts');
  if (!wrapper.length) throw new Error('Report did not list wrapper JS');

  return { wasm, compat, wrapper };
}

function concatFilesInListedOrder(relPaths) {
  const bufs = relPaths.map((rel) => {
    const abs = repoPath(rel);
    mustExist(abs);
    return readBin(abs);
  });
  return Buffer.concat(bufs);
}

function brotliDecompressOrThrow(brBuf) {
  try {
    return zlib.brotliDecompressSync(brBuf);
  } catch (e) {
    const err = new Error(`Brotli decompression failed: ${e && e.message ? e.message : String(e)}`);
    err.cause = e;
    throw err;
  }
}

async function syntaxCheckJS(jsBuf, label) {
  let esbuild;
  try {
    esbuild = require('esbuild');
  } catch {
    throw new Error('esbuild not installed. Run: npm install');
  }

  const code = jsBuf.toString('utf8');
  try {
    await esbuild.transform(code, {
      loader: 'js',
      format: 'esm',
      target: 'es2020',
      sourcemap: false,
      minify: false,
    });
  } catch (e) {
    throw new Error(`${label} JS syntax check failed: ${e && e.message ? e.message : String(e)}`);
  }
}

async function importCompatAndAssertDefault(jsBuf) {
  const tmpDir = repoPath('.verify-tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const tmpFile = path.join(tmpDir, `rapier3d-compat.${Date.now()}.mjs`);
  fs.writeFileSync(tmpFile, jsBuf);

  try {
    const mod = await import(pathToFileURL(tmpFile).href);
    const init =
      typeof mod?.init === 'function'
        ? mod.init
        : typeof mod?.default === 'function'
          ? mod.default
          : null;
    if (!init) throw new Error('compat module does not export init() (named or default)');
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  }
}

function verifyWasmMagic(wasmBuf) {
  if (wasmBuf.length < 8) throw new Error('WASM too small');
  const magic = wasmBuf.slice(0, 4);
  if (!(magic[0] === 0x00 && magic[1] === 0x61 && magic[2] === 0x73 && magic[3] === 0x6d)) {
    throw new Error('WASM magic header not found (expected \\0asm)');
  }
}

function printArtifactSummary(name, brBytes, rawBytes, rawHash) {
  console.log(`- ${name}: br=${brBytes} bytes, raw=${rawBytes} bytes, sha256(raw)=${rawHash}`);
}

async function runOnce() {
  const reportPath = findReportPath();
  const reportText = readUtf8(reportPath);
  const files = parseFilesToInscribe(reportText);
  const groups = groupByArtifact(files);

  // Reassemble
  const wasmBr = concatFilesInListedOrder(groups.wasm);
  const compatBr = concatFilesInListedOrder(groups.compat);
  const wrapperBr = concatFilesInListedOrder(groups.wrapper);

  // Decompress
  const wasmRaw = brotliDecompressOrThrow(wasmBr);
  const compatRaw = brotliDecompressOrThrow(compatBr);
  const wrapperRaw = brotliDecompressOrThrow(wrapperBr);

  // Verify
  verifyWasmMagic(wasmRaw);
  await syntaxCheckJS(compatRaw, 'rapier3d-compat');
  await syntaxCheckJS(wrapperRaw, 'react-three-rapier');
  await importCompatAndAssertDefault(compatRaw);

  return {
    hashes: {
      wasmRaw: sha256(wasmRaw),
      compatRaw: sha256(compatRaw),
      wrapperRaw: sha256(wrapperRaw),
      wasmBr: sha256(wasmBr),
      compatBr: sha256(compatBr),
      wrapperBr: sha256(wrapperBr),
    },
    sizes: {
      wasmBr: wasmBr.length,
      compatBr: compatBr.length,
      wrapperBr: wrapperBr.length,
      wasmRaw: wasmRaw.length,
      compatRaw: compatRaw.length,
      wrapperRaw: wrapperRaw.length,
    },
    debug: {
      reportPath,
    },
  };
}

async function rebuild() {
  const { execSync } = require('child_process');
  execSync('npm run -s clean', { stdio: 'inherit' });
  execSync('npm run -s build', { stdio: 'inherit' });
}

(async function main() {
  const args = new Set(process.argv.slice(2));
  const rebuildAndCompare = args.has('--rebuild-and-compare');

  if (!rebuildAndCompare) {
    console.log('Verifying current build artifacts...');
    const r = await runOnce();
    console.log('OK. Decompression + syntax checks passed:');
    printArtifactSummary('rapier.wasm', r.sizes.wasmBr, r.sizes.wasmRaw, r.hashes.wasmRaw);
    printArtifactSummary('rapier3d-compat.js', r.sizes.compatBr, r.sizes.compatRaw, r.hashes.compatRaw);
    printArtifactSummary('react-three-rapier.js', r.sizes.wrapperBr, r.sizes.wrapperRaw, r.hashes.wrapperRaw);
    console.log(`Report: ${r.debug.reportPath}`);
    return;
  }

  console.log('Determinism check: build → verify → rebuild → verify → compare...');

  console.log('\n[1/2] First build verify');
  const a = await runOnce();

  console.log('\n[2/2] Rebuild + verify');
  await rebuild();
  const b = await runOnce();

  const keys = Object.keys(a.hashes);
  const diffs = keys.filter((k) => a.hashes[k] !== b.hashes[k]);
  if (diffs.length) {
    console.error('\n❌ Determinism FAILED. Hashes differ for:');
    diffs.forEach((k) => console.error(`- ${k}: ${a.hashes[k]} != ${b.hashes[k]}`));
    process.exit(2);
  }

  console.log('\n✅ Determinism OK. All hashes identical across rebuild.');
})().catch((e) => {
  console.error('\n❌ VERIFY FAILED:', e && e.message ? e.message : String(e));
  process.exit(1);
});
