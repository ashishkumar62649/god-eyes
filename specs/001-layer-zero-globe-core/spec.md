# Spec 001 — Layer 0: Globe Core

## Layer ID

`layer_00_globe_core`

## Summary

Build the 3D globe foundation that all other layers render on top of. This is a frontend-only layer with no data pipeline.

## Owner

Gemini CLI

## Components

1. **3D Globe Rendering** — WebGL-based globe (CesiumJS or similar)
2. **Camera Controls** — zoom, pan, rotate, fly-to
3. **Base Map Provider Abstraction** — terrain/imagery provider that can be swapped
4. **Layer Registry** — system to register, enable, disable, and order layers
5. **Layer Toggle UI** — sidebar or panel to toggle layers on/off
6. **Timeline Placeholder** — time control bar (non-functional in this spec, just the UI slot)
7. **Object Selection System** — click an object on the globe, emit selection event
8. **Frontend Map Contract** — interface that data layers use to add/remove objects from the globe

## Folder Structure

```
apps/web/src/layers/layer_00_globe_core/
├── Globe.tsx              (or .vue — framework TBD by Gemini)
├── CameraControls.ts
├── BaseMapProvider.ts
├── LayerRegistry.ts
├── LayerToggle.tsx
├── TimelinePlaceholder.tsx
├── SelectionSystem.ts
└── index.ts
```

## Interfaces (to be defined by Gemini)

```typescript
interface LayerRegistryEntry {
  layer_id: string;
  name: string;
  enabled: boolean;
  render: () => void;
  destroy: () => void;
}

interface SelectionEvent {
  layer_id: string;
  object_id: string;
  position: { lat: number; lng: number; alt?: number };
}
```

## Dependencies

- None (this is the foundation layer)

## Acceptance Criteria

1. Globe renders in browser with terrain/imagery.
2. Camera can zoom, pan, rotate.
3. Layer registry can register and toggle at least one dummy layer.
4. Clicking the globe emits a selection event (even if no real objects exist yet).
5. Timeline placeholder is visible but non-functional.
6. No external data sources are fetched.
7. No API calls are made.

## Out of Scope

- Real data layers (aviation, satellite, etc.)
- API integration
- Database
- Authentication

## Status

Spec complete. Awaiting work order.
