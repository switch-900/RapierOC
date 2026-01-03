// Named-exports facade for the inscribed Rapier runtime.
//
// Goal: let app code use the familiar pattern:
//   import { Physics, RigidBody, CuboidCollider } from 'rapier-runtime';
//
// How it works:
// - Imports the loader (which fetches/decompresses/initializes WASM + modules)
// - Runs it once via top-level await
// - Re-exports commonly-used symbols as named exports
//
// Setup (in your app's import map):
// - Map 'rapier-runtime-loader' -> the inscribed rapier-runtime-loader.js
// - Map 'rapier-runtime' -> THIS file (inscribe it with your app)
//
// Then fill in the part lists below with your sat numbers or URLs.

import { loadRapierRuntime } from 'rapier-runtime-loader';

// Fill these in after you inscribe the runtime chunks.
// Each entry can be:
// - a sat number (recommended) or numeric string: fetched as /r/sat/{sat}/at/-1
// - a full URL
// - a /content/... path
export const RAPIER_WASM_PARTS = [
  // 1234567890123,
];

export const RAPIER_COMPAT_JS_PARTS = [
  // 1234567890456,
];

export const REACT_THREE_RAPIER_JS_PARTS = [
  // 1234567890789,
];

const { r3rapier, rapier, compat } = await loadRapierRuntime({
  // Default cache is OFF in the loader for iframe reliability.
  wasmParts: RAPIER_WASM_PARTS,
  compatParts: RAPIER_COMPAT_JS_PARTS,
  wrapperParts: REACT_THREE_RAPIER_JS_PARTS,
});

// Expose modules (optional, but handy)
export default r3rapier;
export { r3rapier, rapier, compat };

// Re-export commonly-used @react-three/rapier API as named exports.
// (Keep this list aligned with what your app actually imports.)
export const AnyCollider = r3rapier.AnyCollider;
export const BallCollider = r3rapier.BallCollider;
export const CapsuleCollider = r3rapier.CapsuleCollider;
export const CoefficientCombineRule = r3rapier.CoefficientCombineRule;
export const ConeCollider = r3rapier.ConeCollider;
export const ConvexHullCollider = r3rapier.ConvexHullCollider;
export const CuboidCollider = r3rapier.CuboidCollider;
export const CylinderCollider = r3rapier.CylinderCollider;
export const HeightfieldCollider = r3rapier.HeightfieldCollider;
export const InstancedRigidBodies = r3rapier.InstancedRigidBodies;
export const MeshCollider = r3rapier.MeshCollider;
export const Physics = r3rapier.Physics;
export const RapierCollider = r3rapier.RapierCollider;
export const RapierRigidBody = r3rapier.RapierRigidBody;
export const RigidBody = r3rapier.RigidBody;
export const RoundConeCollider = r3rapier.RoundConeCollider;
export const RoundCuboidCollider = r3rapier.RoundCuboidCollider;
export const RoundCylinderCollider = r3rapier.RoundCylinderCollider;
export const TrimeshCollider = r3rapier.TrimeshCollider;

export const euler = r3rapier.euler;
export const interactionGroups = r3rapier.interactionGroups;
export const quat = r3rapier.quat;
export const vec3 = r3rapier.vec3;

export const useAfterPhysicsStep = r3rapier.useAfterPhysicsStep;
export const useBeforePhysicsStep = r3rapier.useBeforePhysicsStep;
export const useFixedJoint = r3rapier.useFixedJoint;
export const useImpulseJoint = r3rapier.useImpulseJoint;
export const usePrismaticJoint = r3rapier.usePrismaticJoint;
export const useRapier = r3rapier.useRapier;
export const useRevoluteJoint = r3rapier.useRevoluteJoint;
export const useRopeJoint = r3rapier.useRopeJoint;
export const useSphericalJoint = r3rapier.useSphericalJoint;
export const useSpringJoint = r3rapier.useSpringJoint;
