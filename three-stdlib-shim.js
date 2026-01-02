/**
 * Minimal ESM shim for `three-stdlib`.
 *
 * @react-three/rapier imports `mergeVertices` from `three-stdlib`.
 * You already have `BufferGeometryUtils` on-chain, so we re-export the
 * official `mergeVertices` from there instead of bundling all of three-stdlib.
 */

import { mergeVertices } from 'BufferGeometryUtils';

export { mergeVertices };
export default { mergeVertices };
