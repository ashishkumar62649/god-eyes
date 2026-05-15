import { Viewer, Cartesian3, CustomDataSource } from 'cesium';

export function isPositionVisible(viewer: Viewer, position: Cartesian3): boolean {
  const currentCameraPos = viewer.camera.positionWC;
  const cameraDist = Cartesian3.magnitude(currentCameraPos);
  
  // Safety check in case the camera is at the center of the earth
  if (cameraDist < 100) return true;

  const currentCameraDir = Cartesian3.normalize(currentCameraPos, new Cartesian3());
  const pointDir = Cartesian3.normalize(position, new Cartesian3());
  const dotProd = Cartesian3.dot(currentCameraDir, pointDir);
  
  // Exact geometric horizon based on earth ellipsoid
  const R = viewer.scene.globe.ellipsoid.maximumRadius;
  const horizonDot = R / cameraDist;
  
  // Tight margin: effectively exactly the horizon.
  // 0.001 is a very small margin to prevent flickering exactly on the edge.
  const visibilityThreshold = horizonDot - 0.001; 

  return dotProd > visibilityThreshold;
}

export function setupVisibilityCulling(viewer: Viewer, dataSource: CustomDataSource, getIsActive: () => boolean) {
  // Fast visibility update for active entities to prevent see-through during rotation
  const removeListener = viewer.scene.preRender.addEventListener(() => {
    try {
      if (!getIsActive()) return;
      
      const entities = dataSource.entities.values;
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        const position = entity.position?.getValue(viewer.clock.currentTime);
        if (position) {
          const isVisible = isPositionVisible(viewer, position);
          if (entity.show !== isVisible) {
            entity.show = isVisible;
          }
        }
      }
    } catch (err) {
      console.error('Visibility culling error:', err);
    }
  });

  return removeListener;
}
