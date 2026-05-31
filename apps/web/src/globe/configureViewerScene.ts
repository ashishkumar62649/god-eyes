import type { Viewer } from 'cesium';

export function configureViewerScene(viewer: Viewer): void {
  viewer.scene.debugShowFramesPerSecond = false;
  viewer.scene.globe.depthTestAgainstTerrain = true;

  const cameraController = viewer.scene.screenSpaceCameraController;
  cameraController.inertiaZoom = 0;
  cameraController.maximumMovementRatio = 0.1;
  cameraController.minimumZoomDistance = 100;
  cameraController.maximumZoomDistance = 50000000;
}
