export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location access is not supported on this device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Location permission is required to punch in or out."));
          return;
        }

        if (error.code === error.TIMEOUT) {
          reject(new Error("Location request timed out. Please try again."));
          return;
        }

        reject(new Error("Unable to get your current location. Please try again."));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
        ...options,
      }
    );
  });
}
