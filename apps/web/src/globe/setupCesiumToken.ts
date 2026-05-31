import { Ion } from 'cesium';

export function setupCesiumToken(): boolean {
  const token = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN;

  if (!token || token === 'replace_with_your_cesium_ion_token') {
    console.warn('Cesium Ion access token is missing. Some features may not work.');
    return false;
  }

  Ion.defaultAccessToken = token;
  return true;
}
