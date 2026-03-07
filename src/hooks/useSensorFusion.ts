import { useState, useEffect, useRef, useCallback } from 'react';

type SensorData = {
  speed: number;
  heartRate: number;
  latitude: number | null;
  longitude: number | null;
  cheatDetected: boolean;
  isTracking: boolean;
  error: string | null;
};

type UseSensorFusionOptions = {
  simulationMode?: boolean;
  onCheatDetected?: () => void;
  overrideLocation?: { lat: number; lng: number } | null;
};

export function useSensorFusion(options: UseSensorFusionOptions = {}) {
  const { simulationMode = false, onCheatDetected, overrideLocation = null } = options;

  const [data, setData] = useState<SensorData>({
    speed: 0,
    heartRate: 0,
    latitude: null,
    longitude: null,
    cheatDetected: false,
    isTracking: false,
    error: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const hrDeviceRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const lastPositionRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);
  const cheatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speedHistoryRef = useRef<number[]>([]);
  const hrHistoryRef = useRef<number[]>([]);

  const calculateSpeed = useCallback((lat1: number, lon1: number, lat2: number, lon2: number, timeDiff: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    const timeInHours = timeDiff / 3600000;
    return timeInHours > 0 ? distance / timeInHours : 0;
  }, []);

  const checkForCheat = useCallback((speed: number, heartRate: number) => {
    if (speed > 25 && heartRate < 100) {
      if (!cheatTimerRef.current) {
        cheatTimerRef.current = setTimeout(() => {
          setData(prev => ({ ...prev, cheatDetected: true }));
          if (onCheatDetected) onCheatDetected();
        }, 15000);
      }
    } else {
      if (cheatTimerRef.current) {
        clearTimeout(cheatTimerRef.current);
        cheatTimerRef.current = null;
      }
    }
  }, [onCheatDetected]);

  const connectHeartRateMonitor = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
      });

      const server = await device.gatt?.connect();
      if (!server) throw new Error('Failed to connect to GATT server');

      const service = await server.getPrimaryService('heart_rate');
      const characteristic = await service.getCharacteristic('heart_rate_measurement');

      hrDeviceRef.current = characteristic;

      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const heartRate = value.getUint8(1);

        hrHistoryRef.current.push(heartRate);
        if (hrHistoryRef.current.length > 10) hrHistoryRef.current.shift();

        setData(prev => {
          const newData = { ...prev, heartRate };
          checkForCheat(prev.speed, heartRate);
          return newData;
        });
      });
    } catch (error) {
      console.error('Heart rate monitor connection failed:', error);
      setData(prev => ({ ...prev, error: 'Failed to connect to heart rate monitor' }));
    }
  };

  const startSimulation = () => {
    let baseSpeed = 8;
    let targetSpeed = 8;
    let restingHR = 70;
    let currentHR = restingHR;
    let exerciseTime = 0;

    const interval = setInterval(() => {
      exerciseTime += 1;

      if (Math.random() < 0.1) {
        targetSpeed = 3 + Math.random() * 20;
      }

      baseSpeed += (targetSpeed - baseSpeed) * 0.1;
      const speedVariation = (Math.random() - 0.5) * 2;
      const simulatedSpeed = Math.max(0, baseSpeed + speedVariation);

      let targetHR = restingHR;
      if (simulatedSpeed < 5) {
        targetHR = restingHR + 20 + simulatedSpeed * 5;
      } else if (simulatedSpeed < 10) {
        targetHR = restingHR + 40 + (simulatedSpeed - 5) * 8;
      } else if (simulatedSpeed < 15) {
        targetHR = restingHR + 80 + (simulatedSpeed - 10) * 6;
      } else if (simulatedSpeed < 20) {
        targetHR = restingHR + 110 + (simulatedSpeed - 15) * 4;
      } else {
        targetHR = restingHR + 130 + (simulatedSpeed - 20) * 2;
      }

      const fitnessDelay = Math.max(0, (targetHR - currentHR) / 10);
      currentHR += (targetHR - currentHR) * 0.05;

      const hrVariation = (Math.random() - 0.5) * 4;
      const simulatedHR = Math.round(Math.max(60, Math.min(200, currentHR + hrVariation)));

      speedHistoryRef.current.push(simulatedSpeed);
      hrHistoryRef.current.push(simulatedHR);

      if (speedHistoryRef.current.length > 10) speedHistoryRef.current.shift();
      if (hrHistoryRef.current.length > 10) hrHistoryRef.current.shift();

      setData(prev => {
        checkForCheat(simulatedSpeed, simulatedHR);
        const baseLat = overrideLocation?.lat ?? 37.7749;
        const baseLng = overrideLocation?.lng ?? -122.4194;
        return {
          ...prev,
          speed: simulatedSpeed,
          heartRate: simulatedHR,
          latitude: baseLat + (Math.random() - 0.5) * 0.01,
          longitude: baseLng + (Math.random() - 0.5) * 0.01,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  };

  const startTracking = async () => {
    if (simulationMode) {
      setData(prev => ({ ...prev, isTracking: true, error: null }));
      return;
    }

    if (!navigator.geolocation) {
      setData(prev => ({ ...prev, error: 'Geolocation not supported' }));
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const actualLat = position.coords.latitude;
        const actualLng = position.coords.longitude;
        const latitude = overrideLocation?.lat ?? actualLat;
        const longitude = overrideLocation?.lng ?? actualLng;
        const currentTime = Date.now();

        let calculatedSpeed = 0;
        if (lastPositionRef.current) {
          const timeDiff = currentTime - lastPositionRef.current.timestamp;
          calculatedSpeed = calculateSpeed(
            lastPositionRef.current.lat,
            lastPositionRef.current.lng,
            latitude,
            longitude,
            timeDiff
          );
        }

        speedHistoryRef.current.push(calculatedSpeed);
        if (speedHistoryRef.current.length > 10) speedHistoryRef.current.shift();

        lastPositionRef.current = { lat: latitude, lng: longitude, timestamp: currentTime };

        setData(prev => {
          checkForCheat(calculatedSpeed, prev.heartRate);
          return {
            ...prev,
            speed: calculatedSpeed,
            latitude,
            longitude,
            isTracking: true,
            error: null,
          };
        });
      },
      (error) => {
        setData(prev => ({ ...prev, error: error.message }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (cheatTimerRef.current) {
      clearTimeout(cheatTimerRef.current);
      cheatTimerRef.current = null;
    }

    setData(prev => ({ ...prev, isTracking: false }));
  };

  const resetCheatDetection = () => {
    setData(prev => ({ ...prev, cheatDetected: false }));
    if (cheatTimerRef.current) {
      clearTimeout(cheatTimerRef.current);
      cheatTimerRef.current = null;
    }
  };

  const getAverageSpeed = () => {
    if (speedHistoryRef.current.length === 0) return 0;
    return speedHistoryRef.current.reduce((a, b) => a + b, 0) / speedHistoryRef.current.length;
  };

  const getAverageHeartRate = () => {
    if (hrHistoryRef.current.length === 0) return 0;
    return Math.round(hrHistoryRef.current.reduce((a, b) => a + b, 0) / hrHistoryRef.current.length);
  };

  useEffect(() => {
    if (overrideLocation && data.isTracking) {
      setData(prev => ({
        ...prev,
        latitude: overrideLocation.lat,
        longitude: overrideLocation.lng,
      }));
    }
  }, [overrideLocation]);

  useEffect(() => {
    if (simulationMode && data.isTracking) {
      return startSimulation();
    }
  }, [simulationMode, data.isTracking]);

  useEffect(() => {
    return () => {
      stopTracking();
      if (hrDeviceRef.current) {
        hrDeviceRef.current.stopNotifications();
      }
    };
  }, []);

  return {
    ...data,
    startTracking,
    stopTracking,
    connectHeartRateMonitor,
    resetCheatDetection,
    getAverageSpeed,
    getAverageHeartRate,
  };
}
