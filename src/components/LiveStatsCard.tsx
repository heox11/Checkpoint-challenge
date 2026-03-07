import { Heart, Gauge, AlertTriangle } from 'lucide-react';

type LiveStatsCardProps = {
  heartRate: number;
  speed: number;
  cheatDetected: boolean;
  isTracking: boolean;
};

export function LiveStatsCard({ heartRate, speed, cheatDetected, isTracking }: LiveStatsCardProps) {
  return (
    <div className="bg-slate-900 border-2 border-[#CEFF00] rounded-lg p-6 shadow-lg shadow-[#CEFF00]/20">
      <h2 className="text-[#CEFF00] text-xl font-bold mb-4 uppercase tracking-wider">
        Live Stats
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center justify-center bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Heart
              className={`w-6 h-6 text-red-500 ${isTracking && heartRate > 0 ? 'animate-pulse' : ''}`}
              fill={isTracking && heartRate > 0 ? 'currentColor' : 'none'}
            />
            <span className="text-slate-400 text-sm uppercase">BPM</span>
          </div>
          <div className="text-4xl font-bold text-[#CEFF00]">
            {heartRate > 0 ? heartRate : '--'}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="w-6 h-6 text-blue-500" />
            <span className="text-slate-400 text-sm uppercase">Speed</span>
          </div>
          <div className="text-4xl font-bold text-[#CEFF00]">
            {speed > 0 ? speed.toFixed(1) : '0.0'}
          </div>
          <div className="text-xs text-slate-500 mt-1">km/h</div>
        </div>
      </div>

      {cheatDetected && (
        <div className="mt-4 bg-red-900/30 border border-red-500 rounded-lg p-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
          <div className="flex-1">
            <div className="text-red-400 font-bold text-sm">CHEAT DETECTED</div>
            <div className="text-red-300 text-xs">Suspicious speed/heart rate detected</div>
          </div>
        </div>
      )}

      {!isTracking && (
        <div className="mt-4 text-center text-slate-500 text-sm">
          Start tracking to see live stats
        </div>
      )}
    </div>
  );
}
