import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const startIcon = L.divIcon({
  className: 'start-pin',
  html: `<div style="
    width:22px;height:22px;border-radius:50%;background:#0ea5e9;color:#fff;
    display:flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;
    border:2px solid #0f172a;box-shadow:0 1px 4px rgba(0,0,0,0.4);
  ">S</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function checkpointIcon(index: number, status: 'visited' | 'current' | 'pending') {
  const bg = status === 'visited' ? '#22c55e' : status === 'current' ? '#CEFF00' : '#475569';
  const content = status === 'visited' ? '✓' : String(index + 1);
  const isCurrent = status === 'current';
  const size = isCurrent ? 28 : 24;
  const pulse = isCurrent
    ? 'box-shadow:0 0 0 0 rgba(206,255,0,0.6);animation:checkpoint-pulse 1.5s ease-out infinite;'
    : 'box-shadow:0 1px 4px rgba(0,0,0,0.4);';
  return L.divIcon({
    className: 'checkpoint-pin',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:#0f172a;
      display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${isCurrent ? 13 : 12}px;
      border:2px solid #0f172a;${pulse}
    ">${content}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const youIcon = L.divIcon({
  className: 'you-pin',
  html: `<div style="
    width:26px;height:26px;border-radius:50%;background:#3b82f6;color:#fff;
    display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;letter-spacing:-0.5px;
    border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5);
  ">YOU</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

export type OrderedCheckpoint = { lat: number; lng: number };

type RaceMapProps = {
  startLat: number;
  startLng: number;
  checkpointLat?: number | null;
  checkpointLng?: number | null;
  orderedCheckpoints?: OrderedCheckpoint[];
  currentCheckpointIndex?: number;
  currentLat?: number;
  currentLng?: number;
  pathTraveled?: [number, number][];
};

function MapBoundsUpdater({
  positions,
  padding = 0.15,
}: {
  positions: [number, number][];
  padding?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (positions.length < 2) return;
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds.pad(padding), { maxZoom: 16, animate: true });
  }, [positions, map, padding]);
  return null;
}

export function RaceMap({
  startLat,
  startLng,
  checkpointLat,
  checkpointLng,
  orderedCheckpoints = [],
  currentCheckpointIndex = 0,
  currentLat,
  currentLng,
  pathTraveled = [],
}: RaceMapProps) {
  const center: [number, number] = [startLat, startLng];
  const [scrollHint, setScrollHint] = useState(false);

  const useOrdered = orderedCheckpoints.length > 0;
  const hasLegacyCheckpoint =
    checkpointLat != null && checkpointLng != null && !useOrdered;

  const boundsPositions: [number, number][] = useOrdered
    ? [[startLat, startLng], ...orderedCheckpoints.map((c) => [c.lat, c.lng] as [number, number])]
    : hasLegacyCheckpoint
      ? [[startLat, startLng], [checkpointLat!, checkpointLng!]]
      : [[startLat, startLng]];

  const linePositions: [number, number][] = useOrdered
    ? [
        [startLat, startLng],
        ...orderedCheckpoints.map((c) => [c.lat, c.lng] as [number, number]),
        [startLat, startLng],
      ]
    : hasLegacyCheckpoint
      ? [
          [startLat, startLng],
          [checkpointLat!, checkpointLng!],
          [startLat, startLng],
        ]
      : [[startLat, startLng]];

  const handleWheel = (e: React.WheelEvent) => {
    if (e.currentTarget.contains(e.target as Node)) {
      setScrollHint(true);
      setTimeout(() => setScrollHint(false), 2000);
    }
  };

  return (
    <div
      className="h-64 rounded-lg overflow-hidden border-2 border-slate-700 relative"
      onWheel={handleWheel}
    >
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        dragging={true}
        touchZoom={true}
        doubleClickZoom={true}
        zoomControl={true}
        className="h-full w-full touch-none"
        style={{ cursor: 'grab' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBoundsUpdater positions={boundsPositions} />

        <Marker position={[startLat, startLng]} icon={startIcon} />

        {useOrdered &&
          orderedCheckpoints.map((c, i) => {
            const status = i < currentCheckpointIndex ? 'visited' : i === currentCheckpointIndex ? 'current' : 'pending';
            return (
              <Marker key={i} position={[c.lat, c.lng]} icon={checkpointIcon(i, status)} />
            );
          })}
        {hasLegacyCheckpoint && (
          <Marker position={[checkpointLat!, checkpointLng!]} icon={checkpointIcon(0, 'current')} />
        )}
        {currentLat != null && currentLng != null && (
          <Marker position={[currentLat, currentLng]} icon={youIcon} />
        )}

        {pathTraveled.map((pos, i) => (
          <CircleMarker key={i} center={pos} radius={3} pathOptions={{ fillColor: '#3b82f6', color: '#1d4ed8', weight: 1, fillOpacity: 0.9 }} />
        ))}

        {linePositions.length > 1 && (
          <Polyline positions={linePositions} color="#CEFF00" weight={3} />
        )}
      </MapContainer>

      {scrollHint && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-slate-900/90 border-2 border-[#CEFF00] px-4 py-2 rounded text-[#CEFF00] text-sm font-bold">
            Use zoom controls to zoom map
          </div>
        </div>
      )}
    </div>
  );
}
