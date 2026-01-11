# On‑Chain Rapier Runtime (for R3F)

It provides pointers and usage notes for an on‑chain ESM loader that exposes the `@react-three/rapier` API via a single import specifier: `rapier-runtime`.

## Loader (stable sat URL)

- `rapier-runtime` → https://ordinals.com/r/sat/479489914976493/at/-1/content

## How to use (importmap)

Add to your page importmap:

```json
{
  "imports": {
    "rapier-runtime": "/r/sat/479489914976493/at/-1/content"
  }
}
```

Then import normally:

```js
import { Physics, RigidBody, CuboidCollider, useRapier } from 'rapier-runtime';
```

## What Rapier is good for

Rapier is a fast real-time rigid-body physics engine. In an R3F/Three.js app it’s commonly used for:

- Physics simulation: gravity + collisions + contacts
- Interactive objects: stacking, pushing, constraints/joints
- Gameplay queries: raycasts / shape casts / intersection tests
- Character movement: kinematic character controllers (walking, sliding, steps)

In short: if you want your 3D scene to behave like a world (and not just visuals), Rapier is the core simulation layer.

## Required companion imports (React / Three / R3F)

The loader should be used in conjunction with your existing on‑chain React + Three.js + R3F importmap entries.

Common pointers (as used in this workspace):
- React: https://ordinals.com/content/609b117277f1e9c9f27f358fe02db34e13d08915bbcea18770dc36f5f3afcbb2i0
- React DOM: https://ordinals.com/content/609b117277f1e9c9f27f358fe02db34e13d08915bbcea18770dc36f5f3afcbb2i1
- React DOM Client: https://ordinals.com/content/4d9308ce08bed11c028acb3d1dd964ea0e9809f51daf141ca0760e745a8070aei0
- JSX runtime: https://ordinals.com/content/609bad601cdafa4d4a2622bbd9f4ebfdd278b8c5ea1efeb0d468db33f871fffai1
- Three.js: https://ordinals.com/content/0d013bb60fc5bf5a6c77da7371b07dc162ebc7d7f3af0ff3bd00ae5f0c546445i0
- @react-three/fiber: https://ordinals.com/content/f1be1caad667af0ec844d1333ad4d38f2cd7cc2855404bba11ac436b53c799b6i0
- BufferGeometryUtils: https://ordinals.com/content/3d3dc321b6541bcb8ca0b3066697b6df55b36b1dcbf19dcde8a53650bebca125i0

## Exports (overview)

The loader re-exports the public `@react-three/rapier` API, including:
- Components: `Physics`, `RigidBody`, colliders (cuboid/ball/capsule/etc)
- Hooks: `useRapier`, `useBeforePhysicsStep`, `useAfterPhysicsStep`, joint hooks
- Utils: `vec3`, `quat`, `euler`, `interactionGroups`
- Extras: `rapier`, `compat`, `r3rapier` (raw modules)

### Controllers and other “engine-level” APIs

The `@react-three/rapier` wrapper focuses on R3F-friendly components/hooks. For lower-level Rapier features (e.g. character controllers, direct world queries, or manual rigid-body/collider construction), use the extra exports:

- `rapier` (engine API)
- `compat` (same engine module)

That’s where you’ll typically find things like `World`, `RigidBodyDesc`, `ColliderDesc`, query helpers, and (depending on Rapier build/version) character controller types.
