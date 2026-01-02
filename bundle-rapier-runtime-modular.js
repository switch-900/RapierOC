#!/usr/bin/env node

/**
 * Rapier Runtime Modular Bundler (LOWEST COST / REUSABLE)
 *
 * Goal:
 * - Keep react/three/@react-three/fiber external (you already inscribed them)
 * - Inscribe Rapier WASM + rapier3d-compat JS glue as reusable runtime pieces
 * - Inscribe @react-three/rapier wrapper separately (small and updatable)
 * - Compress (Brotli) THEN split into safe chunks
 *
 * Output:
 * inscriptions/rapier-runtime/
 *   wasm/rapier.wasm.br(.part-*)
 *   js/rapier3d-compat.js.br(.part-*)
 *   js/react-three-rapier.js.br(.part-*)
 *   INSCRIPTION-REPORT.txt
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const KEEP_LEGAL = process.env.KEEP_LEGAL === '1';
const ESBUILD_LEGAL_COMMENTS = KEEP_LEGAL ? 'inline' : 'none';
const ESBUILD_DROP = ['console', 'debugger'];

const BROTLI_QUALITY = process.env.BROTLI_QUALITY || '11';
const BROTLI_WINDOW = process.env.BROTLI_WINDOW || '22';

const CONFIG = {
  outputDir: './inscriptions/rapier-runtime',
  chunkSize: 100000,

  // external deps import from ord.engine
  external: [
    'react',
    'react/*',
    'react-dom',
    'react-dom/*',
    'three',
    'three/*',
    '@react-three/fiber',
    '@react-three/fiber/*',
    // Provided by your on-chain import map
    'BufferGeometryUtils',
  ],
};

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   Rapier Runtime Modular Bundler (LOWEST COST)        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    ensureDirs();
    const wasmInfo = await findWASM();

    const sizes = {
      compatJs: await bundleCompatJS(),
      r3RapierJs: await bundleReactThreeRapierJS(),
      wasmOriginal: wasmInfo.size,
      wasmBr: await compressWASM(wasmInfo),
      compatBr: await compressFile(path.join(CONFIG.outputDir, 'js', 'rapier3d-compat.js')),
      r3RapierBr: await compressFile(path.join(CONFIG.outputDir, 'js', 'react-three-rapier.js')),
    };

    const chunks = {
      wasm: await splitFile(path.join(CONFIG.outputDir, 'wasm', 'rapier.wasm.br'), 'wasm'),
      compat: await splitFile(path.join(CONFIG.outputDir, 'js', 'rapier3d-compat.js.br'), 'compat'),
      r3rapier: await splitFile(path.join(CONFIG.outputDir, 'js', 'react-three-rapier.js.br'), 'r3rapier'),
    };

    writeReport(wasmInfo, sizes, chunks);

    console.log('\n✅ ALL DONE! Modular runtime ready for inscription.\n');
  } catch (e) {
    console.error('\n❌ ERROR:', e.message);
    process.exit(1);
  }
}

function ensureDirs() {
  fs.mkdirSync(path.join(CONFIG.outputDir, 'js'), { recursive: true });
  fs.mkdirSync(path.join(CONFIG.outputDir, 'wasm'), { recursive: true });
}

async function findWASM() {
  console.log('🔍 Locating WASM file...');

  const possiblePaths = [
    'node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm',
    'node_modules/@dimforge/rapier3d-compat/rapier.wasm',
    'node_modules/@dimforge/rapier3d/rapier_wasm3d_bg.wasm',
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const stats = fs.statSync(p);
      console.log(`   ✅ Found: ${p}`);
      console.log(`   📦 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size} bytes)`);
      return { path: p, size: stats.size };
    }
  }

  throw new Error('WASM file not found. Run: npm install @dimforge/rapier3d-compat');
}

async function bundleCompatJS() {
  console.log('\n📦 Bundling @dimforge/rapier3d-compat (JS glue)...');

  const entry = path.join(CONFIG.outputDir, 'js', 'rapier3d-compat-entry.js');
  fs.writeFileSync(
    entry,
    `// Generated entry: bundles rapier3d-compat JS glue as ESM\nexport * from '@dimforge/rapier3d-compat';\nimport init from '@dimforge/rapier3d-compat';\nexport default init;\n`
  );

  const outfile = path.join(CONFIG.outputDir, 'js', 'rapier3d-compat.js');

  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    target: 'es2020',
    outfile,

    minify: true,
    minifyWhitespace: true,
    minifyIdentifiers: true,
    minifySyntax: true,

    legalComments: ESBUILD_LEGAL_COMMENTS,
    drop: ESBUILD_DROP,

    // This module should be self-contained (no react/three), so we only externalize
    // browser/host deps if any show up.
    external: [],

    metafile: true,
  });

  auditMetafile(result.metafile, outfile, 'rapier3d-compat');

  const size = fs.statSync(outfile).size;
  console.log(`   ✅ compat JS: ${(size / 1024).toFixed(1)} KB`);
  return size;
}

async function bundleReactThreeRapierJS() {
  console.log('\n📦 Bundling @react-three/rapier (wrapper only, externals kept external)...');

  const entry = path.join(CONFIG.outputDir, 'js', 'react-three-rapier-entry.js');
  fs.writeFileSync(
    entry,
    `// Generated entry: wrapper-only module\nexport * from '@react-three/rapier';\n`
  );

  const outfile = path.join(CONFIG.outputDir, 'js', 'react-three-rapier.js');

  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    target: 'es2020',
    outfile,

    minify: true,
    minifyWhitespace: true,
    minifyIdentifiers: true,
    minifySyntax: true,

    legalComments: ESBUILD_LEGAL_COMMENTS,
    drop: ESBUILD_DROP,

    // Keep your on-chain libs external
    external: [
      ...CONFIG.external,
      // Use the separately-inscribed compat module
      '@dimforge/rapier3d-compat',
      '@dimforge/rapier3d-compat/*',
      // Defensive: never inline this
      'three-stdlib',
      'three-stdlib/*',
    ],

    // Replace three-stdlib with a tiny shim re-exporting mergeVertices
    alias: {
      'three-stdlib': './three-stdlib-shim.js',
    },

    metafile: true,
  });

  auditMetafile(result.metafile, outfile, '@react-three/rapier');

  const size = fs.statSync(outfile).size;
  console.log(`   ✅ r3/rapier JS: ${(size / 1024).toFixed(1)} KB`);
  return size;
}

function auditMetafile(metafile, outfile, label) {
  if (!metafile) return;

  const metafilePath = outfile + '.metafile.json';
  fs.writeFileSync(metafilePath, JSON.stringify(metafile, null, 2));

  const outKey = Object.keys(metafile.outputs).find((k) => k.endsWith(path.basename(outfile)));
  const imports = outKey ? (metafile.outputs[outKey].imports || []) : [];
  const externalImports = Array.from(
    new Set(imports.filter((i) => i.external).map((i) => i.path))
  ).sort();

  const importsPath = outfile + '.external-imports.json';
  fs.writeFileSync(importsPath, JSON.stringify(externalImports, null, 2));

  console.log(`   🧾 ${label} metafile: ${metafilePath}`);
  console.log(`   🧾 ${label} externals: ${importsPath}`);

  // Make sure we never inline react/three/fiber into wrapper outputs.
  // (Compat glue should not contain these anyway.)
  const inputs = Object.keys(metafile.inputs);
  const forbidden = inputs.filter((p) => /node_modules[\\/](react|react-dom|three|@react-three[\\/]fiber)[\\/]/.test(p));
  if (forbidden.length) {
    console.error(`\n❌ Audit failed for ${label}: bundled forbidden runtime deps!`);
    forbidden.slice(0, 25).forEach((p) => console.error('   - ' + p));
    if (forbidden.length > 25) console.error(`   ...and ${forbidden.length - 25} more`);
    throw new Error(`Bundled forbidden runtime deps in ${label}`);
  }
}

async function compressWASM(wasmInfo) {
  console.log('\n🗜️  Compressing WASM (Brotli)...');

  const outputPath = path.join(CONFIG.outputDir, 'wasm', 'rapier.wasm.br');

  ensureBrotli();
  execSync(
    `brotli -q ${BROTLI_QUALITY} -w ${BROTLI_WINDOW} -f -o "${outputPath}" "${wasmInfo.path}"`,
    { stdio: 'inherit' }
  );

  const size = fs.statSync(outputPath).size;
  console.log(`   ✅ WASM br: ${(size / 1024).toFixed(1)} KB`);
  return size;
}

async function compressFile(inputPath) {
  console.log(`\n🗜️  Compressing ${path.basename(inputPath)} (Brotli)...`);

  const outputPath = inputPath + '.br';
  ensureBrotli();
  execSync(
    `brotli -q ${BROTLI_QUALITY} -w ${BROTLI_WINDOW} -f -o "${outputPath}" "${inputPath}"`,
    { stdio: 'inherit' }
  );

  const size = fs.statSync(outputPath).size;
  console.log(`   ✅ ${path.basename(outputPath)}: ${(size / 1024).toFixed(1)} KB`);
  return size;
}

function ensureBrotli() {
  try {
    execSync('which brotli', { stdio: 'ignore' });
  } catch {
    execSync('npm install -g brotli', { stdio: 'inherit' });
  }
}

async function splitFile(filePath, type) {
  const stats = fs.statSync(filePath);
  const fileName = path.basename(filePath);

  if (stats.size <= CONFIG.chunkSize) {
    console.log(`\n✅ ${type.toUpperCase()} ${(stats.size / 1024).toFixed(1)} KB - no split`);
    return [filePath];
  }

  console.log(`\n✂️  Splitting ${type.toUpperCase()} into 100KB chunks...`);

  const dir = path.dirname(filePath);
  const inputName = path.basename(filePath);
  // Our inscription tool infers encoding from the file extension.
  // Ensure every chunk ENDS WITH ".br" (not ".br.part-aa").
  // Desired naming: aa.<inputName>, ab.<inputName>, ...
  const tmpPrefix = `${inputName}.tmp-part-`;
  execSync(`split -b ${CONFIG.chunkSize} "${inputName}" "${tmpPrefix}"`, { cwd: dir, stdio: 'inherit' });

  const tmpChunks = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(tmpPrefix))
    .sort();

  const chunkFiles = tmpChunks.map((tmp) => {
    const suffix = tmp.slice(tmpPrefix.length); // aa, ab, ac...
    const finalName = `${suffix}.${inputName}`;
    fs.renameSync(path.join(dir, tmp), path.join(dir, finalName));
    return finalName;
  });

  console.log(`   ✅ Created ${chunkFiles.length} chunks`);
  return chunkFiles.map((f) => path.join(dir, f));
}

function writeReport(wasmInfo, sizes, chunks) {
  const totalBr = sizes.wasmBr + sizes.compatBr + sizes.r3RapierBr;
  const reportPath = path.join(CONFIG.outputDir, 'INSCRIPTION-REPORT.txt');

  const report = `Rapier Runtime Modular Inscription Report
Generated: ${new Date().toISOString()}

PIPELINE:
- Bundle/minify JS → Brotli compress → Split compressed .br files
- WASM → Brotli compress → Split compressed .br file

RUNTIME EXTERNAL IMPORTS YOU MUST PROVIDE (on-chain import map):
- react
- three
- @react-three/fiber
- BufferGeometryUtils

OUTPUTS:

WASM:
- Original: ${(wasmInfo.size / 1024).toFixed(1)} KB
- Brotli:   ${(sizes.wasmBr / 1024).toFixed(1)} KB
- Chunks:   ${chunks.wasm.length}

JS (rapier3d-compat glue):
- JS:       ${(sizes.compatJs / 1024).toFixed(1)} KB
- Brotli:   ${(sizes.compatBr / 1024).toFixed(1)} KB
- Chunks:   ${chunks.compat.length}

JS (@react-three/rapier wrapper):
- JS:       ${(sizes.r3RapierJs / 1024).toFixed(1)} KB
- Brotli:   ${(sizes.r3RapierBr / 1024).toFixed(1)} KB
- Chunks:   ${chunks.r3rapier.length}

TOTAL BROTLI BYTES:
- ${(totalBr / 1024).toFixed(1)} KB

FILES TO INSCRIBE:
${[...chunks.wasm, ...chunks.compat, ...chunks.r3rapier].map((p) => '- ' + p.replace(/\\/g, '/')).join('\n')}
`;

  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Report: ${reportPath}`);
  console.log(`📦 Total Brotli: ${(totalBr / 1024).toFixed(1)} KB`);
}

main();
