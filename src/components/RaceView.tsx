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
    return data;
  };

  useEffect(() => {
    fetchParticipants();
    fetchRaceData();

    const channel = supabase
      .channel(`race_${race.id}_${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'race_participants',
        filter: `race_id=eq.${race.id}`
      }, (payload) => {
        console.log('Participant change detected:', payload);
        fetchParticipants();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'races',
        filter: `id=eq.${race.id}`
      }, (payload) => {
        console.log('Race change detected:', payload);
        fetchRaceData();
      })
      .subscribe((status) => {
        console.log('Race view subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [race.id]);

  // Auto-set checkpoint if race is full but checkpoint is missing
  useEffect(() => {
    const setMissingCheckpoint = async () => {
      const latestRace = await fetchRaceData();
      if (!latestRace) return;

      if (participants.length >= latestRace.max_participants &&
          (!latestRace.checkpoint_lat || !latestRace.checkpoint_lng)) {

        // Get the last participant who joined (not the creator)
        const lastParticipant = participants.find(p => p.user_id !== latestRace.creator_id);
        if (!lastParticipant || !lastParticipant.joined_lat || !lastParticipant.joined_lng) {
          return;
        }

        const R = 6371;
        const dLat = (parseFloat(lastParticipant.joined_lat) - latestRace.start_lat) * Math.PI / 180;
        const dLon = (parseFloat(lastParticipant.joined_lng) - latestRace.start_lng) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(latestRace.start_lat * Math.PI / 180) * Math.cos(parseFloat(lastParticipant.joined_lat) * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = R * c;

        const { error } = await supabase
          .from('races')
          .update({
            checkpoint_lat: parseFloat(lastParticipant.joined_lat),
            checkpoint_lng: parseFloat(lastParticipant.joined_lng),
            distance_km: distanceKm,
          })
          .eq('id', race.id);

        if (!error) {
          await fetchRaceData();
        }
      }
    };

    if (participants.length > 0) {
      setMissingCheckpoint();
    }
  }, [participants.length, race.id]);

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

    const { data: latest } = await supabase.from('races').select('countdown_started_at, actual_start_time').eq('id', race.id).single();
    if (latest?.countdown_started_at || latest?.actual_start_time) {
      alert('This race has already started.');
      return;
    }

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

    if (allReady && allParticipants && allParticipants.length >= currentRace.max_participants) {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-checkpoint-sequences`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ raceId: race.id })
      });

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
    if (!racing || sensor.latitude === null || sensor.longitude === null || !myParticipation) return;

    supabase
      .from('race_participants')
      .update({
        current_lat: sensor.latitude,
        current_lng: sensor.longitude,
      })
      .eq('id', myParticipation.id);

    if (!myParticipation.checkpoint_sequence || myParticipation.checkpoint_sequence.length === 0) {
      return;
    }

    const currentCheckpointUserId = myParticipation.checkpoint_sequence[myParticipation.current_checkpoint_index || 0];
    const targetParticipant = participants.find(p => p.user_id === currentCheckpointUserId);

    if (!targetParticipant || !targetParticipant.joined_lat || !targetParticipant.joined_lng) {
      return;
    }

    const checkpointDistance = calculateDistance(
      sensor.latitude,
      sensor.longitude,
      targetParticipant.joined_lat,
      targetParticipant.joined_lng
    );

    const THRESHOLD_KM = 0.05;
    const currentIndex = myParticipation.current_checkpoint_index || 0;
    const totalCheckpoints = myParticipation.checkpoint_sequence.length;

    if (checkpointDistance < THRESHOLD_KM && currentIndex < totalCheckpoints - 1) {
      const nextIndex = currentIndex + 1;
      supabase
        .from('race_participants')
        .update({
          current_checkpoint_index: nextIndex,
          checkpoints_visited: (myParticipation.checkpoints_visited || 0) + 1,
          current_target_user_id: myParticipation.checkpoint_sequence[nextIndex],
        })
        .eq('id', myParticipation.id);
    }

    if (currentIndex === totalCheckpoints - 1 && checkpointDistance < THRESHOLD_KM) {
      setCanFinish(true);
    }
  }, [sensor.latitude, sensor.longitude, racing, myParticipation, participants]);

  const handleFinishRace = async () => {
    if (!myParticipation || !raceStartTime) return;

    if (!canFinish) {
      alert('You must visit all checkpoints in order!');
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-slate-900 border-2 border-[#CEFF00] rounded-lg max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-slate-900 border-b-2 border-slate-800 p-3 sm:p-4 z-10 flex items-center justify-between">
          <h2 className="text-[#CEFF00] text-base sm:text-xl font-bold truncate pr-2">{currentRace.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white flex-shrink-0">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="p-3 sm:p-6 flex-1">
          <div className="space-y-3 sm:space-y-6">
            <RaceMap
              startLat={currentRace.start_lat}
              startLng={currentRace.start_lng}
              checkpointLat={currentRace.checkpoint_lat}
              checkpointLng={currentRace.checkpoint_lng}
              orderedCheckpoints={
                (myParticipation?.checkpoint_sequence?.length
                  ? myParticipation.checkpoint_sequence
                  : [...participants].sort(
                      (a, b) =>
                        new Date(a.joined_at).getTime() -
                        new Date(b.joined_at).getTime()
                    ).map((p) => p.user_id)
                )
                  .map((userId: string) => participants.find((p) => p.user_id === userId))
                  .filter(
                    (p): p is NonNullable<typeof p> =>
                      p != null &&
                      p.joined_lat != null &&
                      p.joined_lng != null
                  )
                  .map((p) => ({
                    lat: Number(p.joined_lat),
                    lng: Number(p.joined_lng),
                  }))
              }
              currentLat={sensor.latitude ?? myParticipation?.current_lat ?? undefined}
              currentLng={sensor.longitude ?? myParticipation?.current_lng ?? undefined}
            />

            {(!currentRace.checkpoint_lat || !currentRace.checkpoint_lng) && (
              <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded text-yellow-300 text-sm">
                <strong>Waiting for opponent...</strong> The race checkpoint will be set when another player joins.
              </div>
            )}

            {currentRace.checkpoint_name && (
              <div className="p-4 bg-slate-800 border border-slate-700 rounded">
                <div className="text-slate-400 text-sm">Checkpoint</div>
                <div className="text-[#CEFF00] text-lg font-bold">{currentRace.checkpoint_name}</div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="bg-slate-800 p-2 sm:p-4 rounded border border-slate-700">
                <div className="text-slate-400 text-xs sm:text-sm">Distance</div>
                <div className="text-[#CEFF00] text-base sm:text-2xl font-bold">
                  {currentRace.distance_km > 0 ? `${currentRace.distance_km.toFixed(1)} km` : 'TBD'}
                </div>
              </div>
              <div className="bg-slate-800 p-2 sm:p-4 rounded border border-slate-700">
                <div className="text-slate-400 text-xs sm:text-sm">Entry Fee</div>
                <div className="text-[#CEFF00] text-base sm:text-2xl font-bold">€{currentRace.entry_fee.toFixed(2)}</div>
              </div>
              <div className="bg-slate-800 p-2 sm:p-4 rounded border border-slate-700">
                <div className="text-slate-400 text-xs sm:text-sm">Prize Pool</div>
                <div className="text-yellow-500 text-base sm:text-2xl font-bold flex items-center gap-1">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                  €{currentRace.prize_pool.toFixed(2)}
                </div>
              </div>
            </div>

            {racing && myParticipation && (
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

                <div className="mb-4">
                  <div className="text-slate-400 text-sm mb-2">Checkpoint Progress</div>
                  <div className="space-y-2">
                    {myParticipation.checkpoint_sequence?.map((userId, index) => {
                      const targetParticipant = participants.find(p => p.user_id === userId);
                      const currentIndex = myParticipation.current_checkpoint_index || 0;
                      const isCompleted = index < currentIndex;
                      const isCurrent = index === currentIndex;
                      const isPending = index > currentIndex;

                      return (
                        <div
                          key={index}
                          className={`flex items-center gap-2 p-2 rounded ${
                            isCompleted ? 'bg-green-900/30 border border-green-500' :
                            isCurrent ? 'bg-yellow-900/30 border border-yellow-500' :
                            'bg-slate-700'
                          }`}
                        >
                          <div className={`w-3 h-3 rounded-full ${
                            isCompleted ? 'bg-green-500' :
                            isCurrent ? 'bg-yellow-500' :
                            'bg-slate-500'
                          }`}></div>
                          <span className={`text-sm font-bold flex-1 ${
                            isCompleted ? 'text-green-400' :
                            isCurrent ? 'text-yellow-400' :
                            'text-slate-400'
                          }`}>
                            {index + 1}. {targetParticipant?.profiles.username || 'Unknown'}
                            {userId === user?.id && ' (You)'}
                          </span>
                          {isCompleted && <span className="text-green-400 text-xs">✓</span>}
                          {isCurrent && <span className="text-yellow-400 text-xs">→</span>}
                        </div>
                      );
                    })}
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
                disabled={loading || participants.length >= currentRace.max_participants || !!currentRace.countdown_started_at || !!currentRace.actual_start_time}
                className="w-full py-2 sm:py-3 bg-[#CEFF00] text-slate-900 font-bold rounded hover:bg-[#bef000] transition-colors disabled:bg-slate-700 disabled:text-slate-500 uppercase text-sm sm:text-base"
              >
                {loading ? 'Joining...' : (currentRace.countdown_started_at || currentRace.actual_start_time) ? 'Race Started' : `Join Race - €${currentRace.entry_fee.toFixed(2)}`}
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
                    disabled={!currentRace.checkpoint_lat || !currentRace.checkpoint_lng || participants.length < currentRace.max_participants}
                    className="w-full py-2 sm:py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded uppercase flex items-center justify-center gap-2 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-sm sm:text-base"
                  >
                    <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                    {(participants.length < currentRace.max_participants || !currentRace.checkpoint_lat || !currentRace.checkpoint_lng) ? 'Waiting for Opponent' : "I'm Ready"}
                  </button>
                ) : (
                  <div className="w-full py-2 sm:py-3 bg-slate-800 border-2 border-green-500 text-green-400 font-bold rounded uppercase flex items-center justify-center gap-2 text-sm sm:text-base">
                    <Play className="w-4 h-4 sm:w-5 sm:h-5" />
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
