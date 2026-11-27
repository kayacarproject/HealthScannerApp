import {useState, useRef, useEffect, useCallback} from 'react';

// Keeps a vision-camera <Camera> from ending up black:
//  • remounts it (new key) every time the screen regains focus
//  • on a camera error, retries a couple of times, then reports `cameraFailed`
//    so the screen can show a Retry button instead of a blank preview.
const MAX_AUTO_RETRIES = 2;

export default function useCameraRecovery(isFocused) {
  const [cameraKey, setCameraKey] = useState(0);
  const [cameraFailed, setCameraFailed] = useState(false);
  const retries = useRef(0);
  const retryTimer = useRef(null);
  const wasFocused = useRef(isFocused);

  useEffect(() => {
    if (isFocused && !wasFocused.current) {
      // Regained focus: fresh camera session
      retries.current = 0;
      setCameraFailed(false);
      setCameraKey(k => k + 1);
    }
    wasFocused.current = isFocused;
    return () => clearTimeout(retryTimer.current);
  }, [isFocused]);

  const onCameraError = useCallback(error => {
    console.warn('[Camera] error:', error?.code, error?.message);
    clearTimeout(retryTimer.current);
    if (retries.current < MAX_AUTO_RETRIES) {
      retries.current += 1;
      retryTimer.current = setTimeout(() => setCameraKey(k => k + 1), 600);
    } else {
      setCameraFailed(true);
    }
  }, []);

  const retryCamera = useCallback(() => {
    retries.current = 0;
    setCameraFailed(false);
    setCameraKey(k => k + 1);
  }, []);

  return {cameraKey, cameraFailed, onCameraError, retryCamera};
}
