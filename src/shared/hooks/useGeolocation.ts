import { useState, useEffect } from 'react';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface ManualLocation {
  municipality: string;
  barangay: string;
}

interface UseGeolocationReturn {
  coordinates: Coordinates | null;
  loading: boolean;
  error: string | null;
  manualLocation: ManualLocation | null;
  setManualLocation: (location: ManualLocation) => void;
}

export function useGeolocation(): UseGeolocationReturn {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualLocation, setManualLocationState] = useState<ManualLocation | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('GEOLOCATION_UNSUPPORTED');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError('PERMISSION_DENIED');
        } else {
          setError(err.message);
        }
        setLoading(false);
      }
    );
  }, []);

  const setManualLocation = (location: ManualLocation) => {
    setManualLocationState(location);
    setError(null);
  };

  return {
    coordinates,
    loading,
    error,
    manualLocation,
    setManualLocation,
  };
}
