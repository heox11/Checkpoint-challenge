import { useEffect, useState } from 'react';
import { MapPin, Users, Trophy, Clock } from 'lucide-react';
import { supabase, Race } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type RaceLobbyProps = {
  onJoinRace: (race: Race) => void;
  onViewRace: (race: Race) => void;
};

type RaceWithParticipants = Race & {
  participant_count: number;
};

export function RaceLobby({ onJoinRace, onViewRace }: RaceLobbyProps) {
  const { user } = useAuth();
  const [races, setRaces] = useState<RaceWithParticipants[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRaces = async () => {
    const { data: racesData, error } = await supabase
      .from('races')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching races:', error);
      return;
    }

    const racesWithCounts = await Promise.all(
      (racesData || []).map(async (race) => {
        const { count } = await supabase
          .from('race_participants')
          .select('*', { count: 'exact', head: true })
          .eq('race_id', race.id);

        return {
          ...race,
          participant_count: count || 0,
        };
      })
    );

    setRaces(racesWithCounts);
    setLoading(false);
  };

  useEffect(() => {
    fetchRaces();

    const channel = supabase
      .channel(`races_lobby_${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'races'
      }, (payload) => {
        console.log('Race lobby - races change:', payload);
        fetchRaces();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'race_participants'
      }, (payload) => {
        console.log('Race lobby - participants change:', payload);
        fetchRaces();
      })
      .subscribe((status) => {
        console.log('Race lobby subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-900 border-2 border-slate-700 rounded-lg p-6">
        <div className="text-center text-slate-400">Loading races...</div>
      </div>
    );
  }

  if (races.length === 0) {
    return (
      <div className="bg-slate-900 border-2 border-slate-700 rounded-lg p-6">
        <div className="text-center text-slate-400">
          No active races. Create one to get started!
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[#CEFF00] text-xl font-bold uppercase tracking-wider">
        Active Races
      </h2>

      {races.map((race) => (
        <div
          key={race.id}
          className="bg-slate-900 border-2 border-slate-700 hover:border-[#CEFF00] rounded-lg p-3 sm:p-4 transition-all cursor-pointer"
          onClick={() => onViewRace(race)}
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0 mb-3">
            <div className="flex-1">
              <h3 className="text-white font-bold text-base sm:text-lg">{race.title}</h3>
              <div className="flex items-center gap-3 sm:gap-4 mt-2 text-xs sm:text-sm text-slate-400">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{race.distance_km.toFixed(1)} km</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{race.participant_count}/{race.max_participants}</span>
                </div>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-[#CEFF00] font-bold text-xl sm:text-2xl">€{race.entry_fee.toFixed(2)}</div>
              <div className="text-slate-400 text-xs">Entry Fee</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
              <div>
                <div className="text-yellow-500 font-bold text-sm sm:text-base">€{race.prize_pool.toFixed(2)}</div>
                <div className="text-xs text-slate-500">Prize Pool</div>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onJoinRace(race);
              }}
              disabled={race.participant_count >= race.max_participants || race.creator_id === user?.id}
              className="w-full sm:w-auto px-4 py-2 bg-[#CEFF00] text-slate-900 font-bold rounded hover:bg-[#bef000] transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed uppercase text-xs sm:text-sm"
            >
              {race.creator_id === user?.id ? 'Your Race' : 'Join Race'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
