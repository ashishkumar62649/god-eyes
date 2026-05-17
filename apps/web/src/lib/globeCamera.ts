import { Viewer, Cartesian3 } from 'cesium';

export interface FlyToOptions {
  latitude: number;
  longitude: number;
  height?: number;
  duration?: number;
}

export function flyToLocation(viewer: Viewer, options: FlyToOptions) {
  const { latitude, longitude, height = 50000, duration = 2.0 } = options;

  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(longitude, latitude, height),
    duration: duration,
    maximumHeight: Math.max(height * 2, 500000)
  });
}

export function flyToSearchResult(viewer: Viewer, position: { latitude: number; longitude: number }, type: string) {
  const height = type === 'Airport' ? 15000 : 50000;
  flyToLocation(viewer, { 
    latitude: position.latitude, 
    longitude: position.longitude, 
    height 
  });
}
