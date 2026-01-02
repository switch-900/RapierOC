/**
 * Rapier3D Wrapper Entry Point
 * Re-exports @react-three/rapier for inscription
 * Uses a tiny three-stdlib shim (mergeVertices via BufferGeometryUtils)
 */

// Bundle the Rapier JS glue code, but initialize it with inscribed WASM.
// @react-three/rapier imports @dimforge/rapier3d-compat internally; bundling it
// here ensures we don't rely on npm/CDNs at runtime.
import RAPIER_INIT from '@dimforge/rapier3d-compat';

let _rapierPromise = null;

export async function initRapier(wasmBinary) {
  if (!_rapierPromise) {
    _rapierPromise = RAPIER_INIT(wasmBinary);
  }
  return _rapierPromise;
}

// Re-export everything from @react-three/rapier
export * from '@react-three/rapier';

// Export metadata
export const INSCRIPTION_METADATA = {
  bundledAt: new Date().toISOString(),
  source: 'on-chain',
  type: 'js-wrapper',
  version: '1.0.0',
  features: ['trimesh-support', 'mergeVertices-shim(BufferGeometryUtils)']
};
