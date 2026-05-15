import { Viewer, Cartesian3 } from 'cesium';

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
  
  // Margin to ensure edge clicks are reasonably handled
  const visibilityThreshold = horizonDot - 0.05; 

  return dotProd > visibilityThreshold;
}
