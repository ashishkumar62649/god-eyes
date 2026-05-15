import { Camera, Math as CesiumMath } from 'cesium';

export interface ViewportData {
  bbox: string; // minLon,minLat,maxLon,maxLat
  zoom: number; // 0-20 scale roughly
}

export function getViewportFromCamera(camera: Camera): ViewportData {
  // Compute the visible rectangle
  const rectangle = camera.computeViewRectangle();
  
  if (!rectangle) {
    // Fallback if looking into space or full globe
    return {
      bbox: '-180,-90,180,90',
      zoom: 0,
    };
  }

  const minLon = CesiumMath.toDegrees(rectangle.west);
  const minLat = CesiumMath.toDegrees(rectangle.south);
  const maxLon = CesiumMath.toDegrees(rectangle.east);
  const maxLat = CesiumMath.toDegrees(rectangle.north);

  const bbox = `${minLon.toFixed(4)},${minLat.toFixed(4)},${maxLon.toFixed(4)},${maxLat.toFixed(4)}`;

  // Approximate zoom level based on camera height
  // Similar to Mapbox/Leaflet zoom levels: 0 is whole world, 20 is street level
  const height = camera.positionCartographic.height;
  
  // Very rough approximation: Zoom 0 is ~20,000,000m, Zoom 20 is ~10m
  // Using a logarithmic scale
  let zoom = 0;
  if (height > 0) {
    // Math.log2(20000000 / height) gives roughly:
    // height = 20M -> zoom 0
    // height = 10M -> zoom 1
    // height = 5M -> zoom 2
    // height = 150k -> zoom ~7
    // height = 10k -> zoom ~11
    // height = 1k -> zoom ~14
    zoom = Math.max(0, Math.min(22, Math.log2(20000000 / height)));
  }

  return {
    bbox,
    zoom: Math.round(zoom),
  };
}
