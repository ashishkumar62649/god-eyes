import type { Viewer } from 'cesium';

// Global max zoom distance — allows viewing Earth plus the full satellite shell.
// 200 000 km (200 000 000 m) is well beyond GEO (~36 000 km) and HEO orbits.
export const GLOBAL_MAX_ZOOM_DISTANCE = 200_000_000;

export function configureViewerScene(viewer: Viewer): void {
  viewer.scene.debugShowFramesPerSecond = false;
  viewer.scene.globe.depthTestAgainstTerrain = true;

  const cameraController = viewer.scene.screenSpaceCameraController;
  cameraController.inertiaZoom = 0;
  cameraController.maximumMovementRatio = 0.1;
  cameraController.minimumZoomDistance = 100;
  cameraController.maximumZoomDistance = GLOBAL_MAX_ZOOM_DISTANCE;
}
