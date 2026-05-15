import { Viewer, Cartesian3, CustomDataSource } from 'cesium';

export function setupVisibilityCulling(viewer: Viewer, dataSource: CustomDataSource, getIsActive: () => boolean) {
  // Fast visibility update for active entities to prevent see-through during rotation
  const removeListener = viewer.scene.preRender.addEventListener(() => {
    if (!getIsActive()) return;
    
    const currentCamera = viewer.camera;
    const currentCameraPos = currentCamera.positionWC;
    const cameraDist = Cartesian3.magnitude(currentCameraPos);
    
    // Safety check in case the camera is at the center of the earth
    if (cameraDist < 100) return;

    const currentCameraDir = Cartesian3.normalize(currentCameraPos, new Cartesian3());
    
    // Exact geometric horizon based on earth ellipsoid
    const R = viewer.scene.globe.ellipsoid.maximumRadius;
    const horizonDot = R / cameraDist;
    const visibilityThreshold = horizonDot - 0.05; // margin to prevent edge flicker

    const entities = dataSource.entities.values;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const position = entity.position?.getValue(viewer.clock.currentTime);
      if (position) {
        const pointDir = Cartesian3.normalize(position, new Cartesian3());
        const dotProd = Cartesian3.dot(currentCameraDir, pointDir);
        const isVisible = dotProd > visibilityThreshold;
        if (entity.show !== isVisible) {
          entity.show = isVisible;
        }
      }
    }
  });

  return removeListener;
}
