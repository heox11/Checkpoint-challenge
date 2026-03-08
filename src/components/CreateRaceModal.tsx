import { useState } from 'react';
import { X, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type CreateRaceModalProps = {
  onClose: () => void;
  onRaceCreated: () => void;
};

export function CreateRaceModal({ onClose, onRaceCreated }: CreateRaceModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    entryFee: '5.00',
    maxParticipants: '10',
    checkpointName: '',
    checkpointLat: '',
    checkpointLng: '',
  });

  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [customStartLocation, setCustomStartLocation] = useState({
    startLat: '',
    startLng: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const entryFee = parseFloat(formData.entryFee);

      if (!profile || profile.wallet_balance < entryFee) {
        setError('Insufficient balance to create race');
        setLoading(false);
        return;
      }

      let startLat: number, startLng: number;

      if (useCurrentLocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        startLat = position.coords.latitude;
        startLng = position.coords.longitude;
      } else {
        startLat = parseFloat(customStartLocation.startLat);
        startLng = parseFloat(customStartLocation.startLng);
      }

      const checkpointLat = formData.checkpointLat ? parseFloat(formData.checkpointLat) : null;
      const checkpointLng = formData.checkpointLng ? parseFloat(formData.checkpointLng) : null;
      const checkpointName = formData.checkpointName || null;

      const { data: race, error: raceError } = await supabase
        .from('races')
        .insert({
          creator_id: user!.id,
          title: formData.title,
          entry_fee: entryFee,
          prize_pool: entryFee,
          distance_km: 0,
          start_lat: startLat,
          start_lng: startLng,
          checkpoint_lat: checkpointLat,
          checkpoint_lng: checkpointLng,
          checkpoint_name: checkpointName,
          status: 'open',
          max_participants: parseInt(formData.maxParticipants),
        })
        .select()
        .single();

      if (raceError) throw raceError;

      const { error: participantError } = await supabase
        .from('race_participants')
        .insert({
          race_id: race.id,
          user_id: user!.id,
          status: 'joined',
          joined_lat: startLat,
          joined_lng: startLng,
          current_lat: startLat,
          current_lng: startLng,
        });

      if (participantError) throw participantError;

      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: user!.id,
          amount: -entryFee,
          type: 'entry_fee',
          race_id: race.id,
          description: `Entry fee for race: ${formData.title}`,
        });

      if (transactionError) throw transactionError;

      const { error: walletError } = await supabase
        .from('profiles')
        .update({ wallet_balance: profile.wallet_balance - entryFee })
        .eq('id', user!.id);

      if (walletError) throw walletError;

      await refreshProfile();
      onRaceCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create race');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-slate-900 border-2 border-[#CEFF00] rounded-lg max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-[#CEFF00] text-lg sm:text-2xl font-bold uppercase">Create Race</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-bold mb-2">
                Race Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:border-[#CEFF00] focus:outline-none"
                placeholder="Morning Sprint Challenge"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-bold mb-2">
                  Entry Fee (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.entryFee}
                  onChange={(e) => setFormData({ ...formData, entryFee: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:border-[#CEFF00] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-bold mb-2">
                  Max Participants
                </label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={formData.maxParticipants}
                  readOnly
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white opacity-80"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCurrentLocation}
                  onChange={(e) => setUseCurrentLocation(e.target.checked)}
                  className="w-4 h-4"
                />
                <MapPin className="w-4 h-4 text-[#CEFF00]" />
                <span className="text-slate-300 text-sm">Use my current location as starting point</span>
              </label>
            </div>

            {!useCurrentLocation && (
              <div className="space-y-3 p-4 bg-slate-800 rounded border border-slate-700">
                <div className="text-slate-300 text-sm font-bold mb-2">
                  Starting Location
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Latitude"
                    value={customStartLocation.startLat}
                    onChange={(e) => setCustomStartLocation({ ...customStartLocation, startLat: e.target.value })}
                    className="px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-[#CEFF00] focus:outline-none"
                    required={!useCurrentLocation}
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Longitude"
                    value={customStartLocation.startLng}
                    onChange={(e) => setCustomStartLocation({ ...customStartLocation, startLng: e.target.value })}
                    className="px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-[#CEFF00] focus:outline-none"
                    required={!useCurrentLocation}
                  />
                </div>
              </div>
            )}

            <div className="space-y-3 p-4 bg-slate-800 rounded border border-slate-700">
              <div className="text-slate-300 text-sm font-bold">
                Checkpoint (Optional)
              </div>
              <input
                type="text"
                placeholder="Checkpoint name (e.g., Central Park)"
                value={formData.checkpointName}
                onChange={(e) => setFormData({ ...formData, checkpointName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-[#CEFF00] focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  value={formData.checkpointLat}
                  onChange={(e) => setFormData({ ...formData, checkpointLat: e.target.value })}
                  className="px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-[#CEFF00] focus:outline-none"
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  value={formData.checkpointLng}
                  onChange={(e) => setFormData({ ...formData, checkpointLng: e.target.value })}
                  className="px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-[#CEFF00] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <div className="text-slate-400 text-sm mb-4">
                Your balance: <span className="text-[#CEFF00] font-bold">€{profile?.wallet_balance.toFixed(2)}</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 sm:py-3 bg-[#CEFF00] text-slate-900 font-bold rounded hover:bg-[#bef000] transition-colors disabled:bg-slate-700 disabled:text-slate-500 uppercase text-sm sm:text-base"
              >
                {loading ? 'Creating...' : 'Create Race'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
