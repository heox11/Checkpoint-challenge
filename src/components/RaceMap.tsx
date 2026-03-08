import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

function numberedIcon(n: number) {
  return L.divIcon({
    className: 'numbered-pin',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;background:#CEFF00;color:#0f172a;
      display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;
      border:2px solid #0f172a;box-shadow:0 1px 3px rgba(0,0,0,0.4);
    ">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const youIcon = L.divIcon({
  className: 'you-pin',
  html: `<div style="
    width:24px;height:24px;border-radius:50%;background:#3b82f6;color:#fff;
    display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;
    border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5);
  ">YOU</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export type OrderedCheckpoint = { lat: number; lng: number };

type RaceMapProps = {
  startLat: number;
  startLng: number;
  checkpointLat?: number | null;
  checkpointLng?: number | null;
  orderedCheckpoints?: OrderedCheckpoint[];
  currentLat?: number;
  currentLng?: number;
};

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export function RaceMap({
  startLat,
  startLng,
  checkpointLat,
  checkpointLng,
  orderedCheckpoints = [],
  currentLat,
  currentLng,
}: RaceMapProps) {
  const center: [number, number] = [startLat, startLng];
  const [scrollHint, setScrollHint] = useState(false);

  const useOrdered = orderedCheckpoints.length > 0;
  const hasLegacyCheckpoint =
    checkpointLat != null && checkpointLng != null && !useOrdered;

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
        <MapUpdater center={center} />

        <Marker position={[startLat, startLng]} />

        {useOrdered &&
          orderedCheckpoints.map((c, i) => (
            <Marker key={i} position={[c.lat, c.lng]} icon={numberedIcon(i + 1)} />
          ))}
        {hasLegacyCheckpoint && (
          <Marker position={[checkpointLat!, checkpointLng!]} />
        )}
        {currentLat != null && currentLng != null && (
          <Marker position={[currentLat, currentLng]} icon={youIcon} />
        )}

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
