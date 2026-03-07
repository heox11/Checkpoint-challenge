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
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-[#CEFF00]" fill="#CEFF00" />
              <div>
                <h1 className="text-2xl font-bold text-[#CEFF00] uppercase tracking-wider">
                  Checkpoint
                </h1>
                <p className="text-slate-400 text-xs uppercase">Challenge</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-slate-800 border-2 border-[#CEFF00] rounded-lg px-4 py-2 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#CEFF00]" />
                <div>
                  <div className="text-[#CEFF00] font-bold text-lg">
                    €{profile?.wallet_balance.toFixed(2)}
                  </div>
                  <div className="text-slate-500 text-xs uppercase">Balance</div>
                </div>
              </div>

              <button
                onClick={signOut}
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white text-2xl font-bold">
                Welcome, <span className="text-[#CEFF00]">{profile?.username}</span>
              </h2>
              <p className="text-slate-400 text-sm">
                Races: {profile?.total_races} | Wins: {profile?.total_wins}
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-[#CEFF00] text-slate-900 font-bold rounded hover:bg-[#bef000] transition-colors uppercase flex items-center gap-2 shadow-lg shadow-[#CEFF00]/20"
            >
              <Plus className="w-5 h-5" />
              Create Race
            </button>
          </div>

          <div className="bg-slate-900 border-2 border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-slate-400" />
                <span className="text-white font-bold uppercase text-sm">Settings</span>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simulationMode}
                    onChange={(e) => setSimulationMode(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-slate-300 text-sm">Simulation Mode</span>
                </label>

                {!simulationMode && (
                  <button
                    onClick={sensor.connectHeartRateMonitor}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Bluetooth className="w-4 h-4" />
                    Connect HR Monitor
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
                  className={`px-3 py-1 rounded flex items-center gap-1 text-sm font-bold transition-colors ${
                    sensor.isTracking
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-[#CEFF00] hover:bg-[#bef000] text-slate-900'
                  }`}
                >
                  <Power className="w-4 h-4" />
                  {sensor.isTracking ? 'Stop Tracking' : 'Start Tracking'}
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
