import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Viewer } from 'cesium';

interface FpsCounter {
  fpsRef: MutableRefObject<number>;
  startFpsCounter: (viewer: Viewer) => () => void;
}

export function useFpsCounter(): FpsCounter {
  const fpsRef = useRef<number>(0);

  const startFpsCounter = useCallback((viewer: Viewer) => {
    let fpsFrameCount = 0;
    let fpsLastUpdate = performance.now();
    const fpsPostRender = viewer.scene.postRender.addEventListener(() => {
      fpsFrameCount++;
    });
    const fpsInterval = setInterval(() => {
      const now = performance.now();
      const delta = now - fpsLastUpdate;
      if (delta > 0) {
        fpsRef.current = Math.round(fpsFrameCount / (delta / 1000));
      }
      fpsFrameCount = 0;
      fpsLastUpdate = now;
    }, 1000);

    return () => {
      clearInterval(fpsInterval);
      fpsPostRender();
    };
  }, []);

  return { fpsRef, startFpsCounter };
}
