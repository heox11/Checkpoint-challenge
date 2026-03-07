import { useState, useEffect } from 'react';
import { MapPin, X, Crosshair } from 'lucide-react';

type DevLocationOverrideProps = {
  onLocationChange: (lat: number, lng: number) => void;
  onDisable: () => void;
};

export function DevLocationOverride({ onLocationChange, onDisable }: DevLocationOverrideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const presets = [
    { name: 'New York Central Park', lat: 40.785091, lng: -73.968285 },
    { name: 'London Hyde Park', lat: 51.507268, lng: -0.165730 },
    { name: 'Paris Eiffel Tower', lat: 48.858370, lng: 2.294481 },
    { name: 'Tokyo Shibuya', lat: 35.661777, lng: 139.704051 },
    { name: 'Sydney Opera House', lat: -33.856784, lng: 151.215297 },
  ];

  const handleApply = () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      onLocationChange(lat, lng);
      setIsOpen(false);
    } else {
      alert('Invalid coordinates');
    }
  };

  const handlePreset = (lat: number, lng: number) => {
    setLatitude(lat.toString());
    setLongitude(lng.toString());
    onLocationChange(lat, lng);
    setIsOpen(false);
  };

  const handleDisable = () => {
    onDisable();
    setLatitude('');
    setLongitude('');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-full shadow-lg z-50 flex items-center gap-2"
        title="Developer Location Override"
      >
        <MapPin className="w-5 h-5" />
        <span className="text-sm font-bold">DEV</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-slate-900 border-2 border-orange-500 rounded-lg p-4 shadow-xl z-50 w-80">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-orange-500" />
          <h3 className="text-white font-bold">Location Override</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-slate-300 text-sm font-bold mb-1">
            Latitude
          </label>
          <input
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="40.785091"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-slate-300 text-sm font-bold mb-1">
            Longitude
          </label>
          <input
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="-73.968285"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>

        <button
          onClick={handleApply}
          className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded text-sm flex items-center justify-center gap-2"
        >
          <Crosshair className="w-4 h-4" />
          Apply Location
        </button>

        <div className="border-t border-slate-700 pt-3">
          <div className="text-slate-400 text-xs font-bold mb-2 uppercase">Quick Presets</div>
          <div className="space-y-1">
            {presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePreset(preset.lat, preset.lng)}
                className="w-full text-left px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleDisable}
          className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded text-sm"
        >
          Use Real GPS
        </button>
      </div>
    </div>
  );
}
