import { useState } from 'react';
import { Wallet, Plus, Zap, LogOut, Settings, Bluetooth, Power } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LiveStatsCard } from './LiveStatsCard';
import { RaceLobby } from './RaceLobby';
import { CreateRaceModal } from './CreateRaceModal';
import { RaceView } from './RaceView';
import { DevLocationOverride } from './DevLocationOverride';
import { Race } from '../lib/supabase';
import { useSensorFusion } from '../hooks/useSensorFusion';

export function Dashboard() {
  const { profile, signOut } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [simulationMode, setSimulationMode] = useState(false);
  const [devLocation, setDevLocation] = useState<{ lat: number; lng: number } | null>(null);

  const sensor = useSensorFusion({
    simulationMode,
    overrideLocation: devLocation,
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-[#0F172A]">
      <header className="bg-slate-900 border-b-2 border-[#CEFF00] sticky top-0 z-40 shadow-lg shadow-[#CEFF00]/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-[#CEFF00]" fill="#CEFF00" />
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-[#CEFF00] uppercase tracking-wider">
                  Checkpoint
                </h1>
                <p className="text-slate-400 text-xs uppercase hidden sm:block">Challenge</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="bg-slate-800 border-2 border-[#CEFF00] rounded-lg px-2 py-1 sm:px-4 sm:py-2 flex items-center gap-1 sm:gap-2">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-[#CEFF00]" />
                <div>
                  <div className="text-[#CEFF00] font-bold text-sm sm:text-lg">
                    €{profile?.wallet_balance.toFixed(2)}
                  </div>
                  <div className="text-slate-500 text-xs uppercase hidden sm:block">Balance</div>
                </div>
              </div>

              <button
                onClick={signOut}
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
            <div>
              <h2 className="text-white text-lg sm:text-2xl font-bold">
                Welcome, <span className="text-[#CEFF00]">{profile?.username}</span>
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm">
                Races: {profile?.total_races} | Wins: {profile?.total_wins}
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-3 bg-[#CEFF00] text-slate-900 font-bold rounded hover:bg-[#bef000] transition-colors uppercase flex items-center justify-center gap-2 shadow-lg shadow-[#CEFF00]/20 text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              Create Race
            </button>
          </div>

          <div className="bg-slate-900 border-2 border-slate-700 rounded-lg p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                <span className="text-white font-bold uppercase text-xs sm:text-sm">Settings</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simulationMode}
                    onChange={(e) => setSimulationMode(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-slate-300 text-xs sm:text-sm">Simulation Mode</span>
                </label>

                {!simulationMode && (
                  <button
                    onClick={sensor.connectHeartRateMonitor}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs sm:text-sm rounded hover:bg-blue-700 flex items-center justify-center gap-1"
                  >
                    <Bluetooth className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Connect HR Monitor</span>
                    <span className="sm:hidden">Connect HR</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    if (sensor.isTracking) {
                      sensor.stopTracking();
                    } else {
                      sensor.startTracking();
                    }
                  }}
                  className={`px-3 py-1.5 rounded flex items-center justify-center gap-1 text-xs sm:text-sm font-bold transition-colors ${
                    sensor.isTracking
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-[#CEFF00] hover:bg-[#bef000] text-slate-900'
                  }`}
                >
                  <Power className="w-3 h-3 sm:w-4 sm:h-4" />
                  {sensor.isTracking ? 'Stop' : 'Start'}<span className="hidden sm:inline"> Tracking</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <LiveStatsCard
              heartRate={sensor.heartRate}
              speed={sensor.speed}
              cheatDetected={sensor.cheatDetected}
              isTracking={sensor.isTracking}
            />
          </div>

          <div className="lg:col-span-2">
            <RaceLobby
              key={refreshKey}
              onJoinRace={(race) => setSelectedRace(race)}
              onViewRace={(race) => setSelectedRace(race)}
            />
          </div>
        </div>
      </main>

      {showCreateModal && (
        <CreateRaceModal
          onClose={() => setShowCreateModal(false)}
          onRaceCreated={handleRefresh}
        />
      )}

      {selectedRace && (
        <RaceView
          race={selectedRace}
          onClose={() => setSelectedRace(null)}
          onRaceUpdated={handleRefresh}
          simulationMode={simulationMode}
        />
      )}

      <DevLocationOverride
        onLocationChange={(lat, lng) => setDevLocation({ lat, lng })}
        onDisable={() => setDevLocation(null)}
      />
    </div>
  );
}
