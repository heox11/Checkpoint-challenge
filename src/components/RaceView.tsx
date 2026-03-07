import { useState, useEffect } from 'react';
import { X, Users, Play, Flag, Trophy, AlertTriangle } from 'lucide-react';
import { supabase, Race, RaceParticipant, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RaceMap } from './RaceMap';
import { useSensorFusion } from '../hooks/useSensorFusion';

type RaceViewProps = {
  race: Race;
  onClose: () => void;
  onRaceUpdated: () => void;
  simulationMode: boolean;
};

export function RaceView({ race, onClose, onRaceUpdated, simulationMode }: RaceViewProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [currentRace, setCurrentRace] = useState<Race>(race);
  const [participants, setParticipants] = useState<(RaceParticipant & { profiles: Profile })[]>([]);
  const [isParticipant, setIsParticipant] = useState(false);
  const [myParticipation, setMyParticipation] = useState<RaceParticipant | null>(null);
  const [loading, setLoading] = useState(false);
  const [racing, setRacing] = useState(false);
  const [raceStartTime, setRaceStartTime] = useState<number | null>(null);
  const [checkpointReached, setCheckpointReached] = useState(false);
  const [canFinish, setCanFinish] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const sensor = useSensorFusion({
    simulationMode,
    onCheatDetected: async () => {
      if (myParticipation) {
        await supabase
          .from('race_participants')
          .update({ cheat_detected: true, status: 'disqualified' })
          .eq('id', myParticipation.id);
        alert('Anti-cheat triggered! You have been disqualified.');
        sensor.stopTracking();
        setRacing(false);
      }
    },
  });

  const fetchParticipants = async () => {
    const { data, error } = await supabase
      .from('race_participants')
      .select('*, profiles(*)')
      .eq('race_id', race.id);

    if (error) {
      console.error('Error fetching participants:', error);
      return;
    }

    setParticipants(data || []);
    const myPart = data?.find(p => p.user_id === user?.id);
    setIsParticipant(!!myPart);
    setMyParticipation(myPart || null);
  };

  const fetchRaceData = async () => {
    const { data, error } = await supabase
      .from('races')
      .select('*')
      .eq('id', race.id)
      .single();

    if (!error && data) {
      setCurrentRace(data);
    }
  };

  useEffect(() => {
    fetchParticipants();
    fetchRaceData();

    const channel = supabase
      .channel(`race_${race.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'race_participants', filter: `race_id=eq.${race.id}` }, () => {
        fetchParticipants();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'races', filter: `id=eq.${race.id}` }, () => {
        fetchRaceData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [race.id, user]);

  // Auto-set checkpoint if race is full but checkpoint is missing
  useEffect(() => {
    const setMissingCheckpoint = async () => {
      if (participants.length >= currentRace.max_participants &&
          (!currentRace.checkpoint_lat || !currentRace.checkpoint_lng)) {

        // Get the last participant who joined (not the creator)
        const lastParticipant = participants.find(p => p.user_id !== currentRace.creator_id);
        if (!lastParticipant || !lastParticipant.joined_lat || !lastParticipant.joined_lng) {
          return;
        }

        const R = 6371;
        const dLat = (parseFloat(lastParticipant.joined_lat) - currentRace.start_lat) * Math.PI / 180;
        const dLon = (parseFloat(lastParticipant.joined_lng) - currentRace.start_lng) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(currentRace.start_lat * Math.PI / 180) * Math.cos(parseFloat(lastParticipant.joined_lat) * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = R * c;

        await supabase
          .from('races')
          .update({
            checkpoint_lat: parseFloat(lastParticipant.joined_lat),
            checkpoint_lng: parseFloat(lastParticipant.joined_lng),
            distance_km: distanceKm,
          })
          .eq('id', race.id);

        await fetchRaceData();
      }
    };

    setMissingCheckpoint();
  }, [participants, currentRace, race.id]);

  useEffect(() => {
    if (currentRace.countdown_started_at && !currentRace.actual_start_time) {
      const startedAt = new Date(currentRace.countdown_started_at).getTime();
      const interval = setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        const remaining = Math.max(0, 5 - elapsed);
        setCountdown(Math.ceil(remaining));

        if (remaining <= 0) {
          clearInterval(interval);
          setCountdown(null);
          if (myParticipation && myParticipation.is_ready) {
            handleStartRace();
          }
        }
      }, 100);

      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [currentRace.countdown_started_at, currentRace.actual_start_time, myParticipation]);

  const handleJoinRace = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      if (profile.wallet_balance < race.entry_fee) {
        alert('Insufficient balance');
        return;
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const joinLat = position.coords.latitude;
      const joinLng = position.coords.longitude;

      const { error: participantError } = await supabase
        .from('race_participants')
        .insert({
          race_id: race.id,
          user_id: user!.id,
          status: 'joined',
          joined_lat: joinLat,
          joined_lng: joinLng,
          current_lat: joinLat,
          current_lng: joinLng,
        });

      if (participantError) throw participantError;

      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: user!.id,
          amount: -race.entry_fee,
          type: 'entry_fee',
          race_id: race.id,
          description: `Entry fee for race: ${race.title}`,
        });

      if (transactionError) throw transactionError;

      // Fetch the latest race data to check if checkpoint is already set
      const { data: latestRace } = await supabase
        .from('races')
        .select('*')
        .eq('id', race.id)
        .single();

      const newPrizePool = race.prize_pool + race.entry_fee;

      let distanceKm = latestRace?.distance_km || currentRace.distance_km;
      const shouldSetCheckpoint = !latestRace?.checkpoint_lat || !latestRace?.checkpoint_lng;

      if (shouldSetCheckpoint) {
        const R = 6371;
        const dLat = (joinLat - currentRace.start_lat) * Math.PI / 180;
        const dLon = (joinLng - currentRace.start_lng) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(currentRace.start_lat * Math.PI / 180) * Math.cos(joinLat * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceKm = R * c;
      }

      const { error: raceError } = await supabase
        .from('races')
        .update({
          prize_pool: newPrizePool,
          checkpoint_lat: latestRace?.checkpoint_lat || joinLat,
          checkpoint_lng: latestRace?.checkpoint_lng || joinLng,
          distance_km: distanceKm,
        })
        .eq('id', race.id);

      if (raceError) throw raceError;

      const { error: walletError } = await supabase
        .from('profiles')
        .update({ wallet_balance: profile.wallet_balance - race.entry_fee })
        .eq('id', user!.id);

      if (walletError) throw walletError;

      await refreshProfile();
      await fetchRaceData();
      await fetchParticipants();
      onRaceUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to join race');
    } finally {
      setLoading(false);
    }
  };

  const handleReady = async () => {
    if (!myParticipation) return;

    await supabase
      .from('race_participants')
      .update({
        is_ready: true,
        ready_at: new Date().toISOString()
      })
      .eq('id', myParticipation.id);

    const { data: allParticipants } = await supabase
      .from('race_participants')
      .select('is_ready')
      .eq('race_id', race.id);

    const allReady = allParticipants?.every(p => p.is_ready);

    if (allReady && allParticipants && allParticipants.length >= 2) {
      await supabase
        .from('races')
        .update({ countdown_started_at: new Date().toISOString() })
        .eq('id', race.id);
    }
  };

  const handleStartRace = async () => {
    if (!myParticipation) return;

    setRacing(true);
    setRaceStartTime(Date.now());
    await sensor.startTracking();

    await supabase
      .from('race_participants')
      .update({ status: 'racing' })
      .eq('id', myParticipation.id);

    if (!currentRace.actual_start_time) {
      await supabase
        .from('races')
        .update({ actual_start_time: new Date().toISOString() })
        .eq('id', race.id);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    if (!racing || sensor.latitude === null || sensor.longitude === null) return;
    if (!currentRace.checkpoint_lat || !currentRace.checkpoint_lng) return;

    if (myParticipation) {
      supabase
        .from('race_participants')
        .update({
          current_lat: sensor.latitude,
          current_lng: sensor.longitude,
        })
        .eq('id', myParticipation.id);
    }

    const checkpointDistance = calculateDistance(
      sensor.latitude,
      sensor.longitude,
      currentRace.checkpoint_lat,
      currentRace.checkpoint_lng
    );

    const startDistance = calculateDistance(
      sensor.latitude,
      sensor.longitude,
      currentRace.start_lat,
      currentRace.start_lng
    );

    const THRESHOLD_KM = 0.05;

    if (!checkpointReached && checkpointDistance < THRESHOLD_KM) {
      setCheckpointReached(true);
    }

    if (checkpointReached && startDistance < THRESHOLD_KM) {
      setCanFinish(true);
    }
  }, [sensor.latitude, sensor.longitude, racing, checkpointReached, currentRace, myParticipation]);

  const handleFinishRace = async () => {
    if (!myParticipation || !raceStartTime) return;

    if (!canFinish) {
      alert('You must reach the checkpoint and return to the start position!');
      return;
    }

    const finishTime = (Date.now() - raceStartTime) / 1000;
    const avgSpeed = sensor.getAverageSpeed();
    const avgHR = sensor.getAverageHeartRate();

    await supabase
      .from('race_participants')
      .update({
        status: sensor.cheatDetected ? 'disqualified' : 'finished',
        finish_time: finishTime,
        average_speed: avgSpeed,
        average_heart_rate: avgHR,
        finished_at: new Date().toISOString(),
      })
      .eq('id', myParticipation.id);

    await supabase
      .from('profiles')
      .update({ total_races: (profile?.total_races || 0) + 1 })
      .eq('id', user!.id);

    sensor.stopTracking();
    setRacing(false);
    setCheckpointReached(false);
    setCanFinish(false);

    const allParticipants = await supabase
      .from('race_participants')
      .select('*')
      .eq('race_id', race.id)
      .eq('status', 'finished')
      .order('finish_time', { ascending: true });

    if (allParticipants.data && allParticipants.data.length > 0) {
      const winner = allParticipants.data[0];
      if (winner.user_id === user?.id && !sensor.cheatDetected) {
        const prizeAmount = race.prize_pool;

        await supabase
          .from('wallet_transactions')
          .insert({
            user_id: user!.id,
            amount: prizeAmount,
            type: 'prize',
            race_id: race.id,
            description: `Won race: ${race.title}`,
          });

        await supabase
          .from('profiles')
          .update({
            wallet_balance: (profile?.wallet_balance || 0) + prizeAmount,
            total_wins: (profile?.total_wins || 0) + 1,
          })
          .eq('id', user!.id);

        await supabase
          .from('races')
          .update({ status: 'completed' })
          .eq('id', race.id);

        await refreshProfile();
        alert(`Congratulations! You won €${prizeAmount.toFixed(2)}!`);
      }
    }

    await fetchParticipants();
    onRaceUpdated();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border-2 border-[#CEFF00] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-slate-900 border-b-2 border-slate-800 p-4 z-10 flex items-center justify-between">
          <h2 className="text-[#CEFF00] text-xl font-bold">{currentRace.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white flex-shrink-0">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex-1">
          <div className="space-y-6">
            <RaceMap
              startLat={currentRace.start_lat}
              startLng={currentRace.start_lng}
              checkpointLat={currentRace.checkpoint_lat}
              checkpointLng={currentRace.checkpoint_lng}
              currentLat={sensor.latitude || undefined}
              currentLng={sensor.longitude || undefined}
              participants={participants
                .filter(p => p.current_lat && p.current_lng)
                .map(p => ({
                  id: p.id,
                  lat: p.current_lat!,
                  lng: p.current_lng!,
                  username: p.profiles.username,
                }))}
            />

            {(!currentRace.checkpoint_lat || !currentRace.checkpoint_lng) && (
              <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded text-yellow-300 text-sm">
                <strong>Waiting for opponent...</strong> The race checkpoint will be set when another player joins.
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-800 p-4 rounded border border-slate-700">
                <div className="text-slate-400 text-sm">Distance</div>
                <div className="text-[#CEFF00] text-2xl font-bold">
                  {currentRace.distance_km > 0 ? `${currentRace.distance_km.toFixed(1)} km` : 'TBD'}
                </div>
              </div>
              <div className="bg-slate-800 p-4 rounded border border-slate-700">
                <div className="text-slate-400 text-sm">Entry Fee</div>
                <div className="text-[#CEFF00] text-2xl font-bold">€{currentRace.entry_fee.toFixed(2)}</div>
              </div>
              <div className="bg-slate-800 p-4 rounded border border-slate-700">
                <div className="text-slate-400 text-sm">Prize Pool</div>
                <div className="text-yellow-500 text-2xl font-bold flex items-center gap-1">
                  <Trophy className="w-5 h-5" />
                  €{currentRace.prize_pool.toFixed(2)}
                </div>
              </div>
            </div>

            {racing && (
              <div className="bg-slate-800 border-2 border-[#CEFF00] rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-slate-400 text-sm">Current Speed</div>
                    <div className="text-white text-3xl font-bold">{sensor.speed.toFixed(1)} km/h</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-sm">Heart Rate</div>
                    <div className="text-red-500 text-3xl font-bold">{sensor.heartRate} BPM</div>
                  </div>
                </div>

                <div className="mb-4 space-y-2">
                  <div className={`flex items-center gap-2 p-2 rounded ${checkpointReached ? 'bg-green-900/30 border border-green-500' : 'bg-slate-700'}`}>
                    <div className={`w-3 h-3 rounded-full ${checkpointReached ? 'bg-green-500' : 'bg-slate-500'}`}></div>
                    <span className={`text-sm font-bold ${checkpointReached ? 'text-green-400' : 'text-slate-400'}`}>
                      Checkpoint {checkpointReached ? 'Reached' : 'Pending'}
                    </span>
                  </div>
                  <div className={`flex items-center gap-2 p-2 rounded ${canFinish ? 'bg-green-900/30 border border-green-500' : 'bg-slate-700'}`}>
                    <div className={`w-3 h-3 rounded-full ${canFinish ? 'bg-green-500' : 'bg-slate-500'}`}></div>
                    <span className={`text-sm font-bold ${canFinish ? 'text-green-400' : 'text-slate-400'}`}>
                      Return to Start {canFinish ? 'Complete' : 'Pending'}
                    </span>
                  </div>
                </div>

                {sensor.cheatDetected && (
                  <div className="bg-red-900/30 border border-red-500 rounded p-3 flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <span className="text-red-400 text-sm font-bold">ANTI-CHEAT TRIGGERED</span>
                  </div>
                )}

                <button
                  onClick={handleFinishRace}
                  disabled={!canFinish}
                  className="w-full py-3 bg-[#CEFF00] text-slate-900 font-bold rounded hover:bg-[#bef000] uppercase flex items-center justify-center gap-2 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <Flag className="w-5 h-5" />
                  Finish Race
                </button>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-[#CEFF00]" />
                <h3 className="text-white font-bold">Participants ({participants.length}/{currentRace.max_participants})</h3>
              </div>

              <div className="space-y-2">
                {participants.map((p) => (
                  <div key={p.id} className="bg-slate-800 p-3 rounded border border-slate-700 flex items-center justify-between">
                    <div>
                      <div className="text-white font-bold">{p.profiles.username}</div>
                      <div className="text-slate-400 text-sm">
                        Status: {p.status}
                        {p.is_ready && p.status === 'joined' && (
                          <span className="ml-2 text-green-400 font-bold">✓ READY</span>
                        )}
                      </div>
                    </div>
                    {p.finish_time && (
                      <div className="text-[#CEFF00] font-bold">{p.finish_time.toFixed(2)}s</div>
                    )}
                    {p.cheat_detected && (
                      <div className="text-red-500 text-sm font-bold">DISQUALIFIED</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {!isParticipant && (
              <button
                onClick={handleJoinRace}
                disabled={loading || participants.length >= currentRace.max_participants}
                className="w-full py-3 bg-[#CEFF00] text-slate-900 font-bold rounded hover:bg-[#bef000] transition-colors disabled:bg-slate-700 disabled:text-slate-500 uppercase"
              >
                {loading ? 'Joining...' : `Join Race - €${currentRace.entry_fee.toFixed(2)}`}
              </button>
            )}

            {countdown !== null && (
              <div className="bg-[#CEFF00] text-slate-900 p-8 rounded-lg text-center">
                <div className="text-6xl font-bold mb-2">{countdown}</div>
                <div className="text-xl font-bold uppercase">Get Ready!</div>
              </div>
            )}

            {isParticipant && !racing && myParticipation?.status === 'joined' && !countdown && (
              <>
                {!myParticipation.is_ready ? (
                  <button
                    onClick={handleReady}
                    disabled={!currentRace.checkpoint_lat || !currentRace.checkpoint_lng}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded uppercase flex items-center justify-center gap-2 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
                  >
                    <Play className="w-5 h-5" />
                    {(!currentRace.checkpoint_lat || !currentRace.checkpoint_lng) ? 'Waiting for Opponent' : "I'm Ready"}
                  </button>
                ) : (
                  <div className="w-full py-3 bg-slate-800 border-2 border-green-500 text-green-400 font-bold rounded uppercase flex items-center justify-center gap-2">
                    <Play className="w-5 h-5" />
                    Waiting for Others...
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
