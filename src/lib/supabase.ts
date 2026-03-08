import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string;
  wallet_balance: number;
  total_races: number;
  total_wins: number;
  created_at: string;
  updated_at: string;
};

export type Race = {
  id: string;
  creator_id: string;
  title: string;
  entry_fee: number;
  prize_pool: number;
  distance_km: number;
  start_lat: number;
  start_lng: number;
  checkpoint_lat: number | null;
  checkpoint_lng: number | null;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  max_participants: number;
  start_time: string | null;
  created_at: string;
  countdown_started_at?: string | null;
  actual_start_time?: string | null;
};

export type RaceParticipant = {
  id: string;
  race_id: string;
  user_id: string;
  finish_time: number | null;
  average_heart_rate: number | null;
  average_speed: number | null;
  cheat_detected: boolean;
  status: 'joined' | 'racing' | 'finished' | 'disqualified';
  joined_at: string;
  finished_at: string | null;
  joined_lat?: number | null;
  joined_lng?: number | null;
  current_lat?: number | null;
  current_lng?: number | null;
  is_ready?: boolean;
  ready_at?: string | null;
  checkpoint_sequence?: string[];
  current_checkpoint_index?: number;
  checkpoints_visited?: number;
  current_target_user_id?: string | null;
};

export type WalletTransaction = {
  id: string;
  user_id: string;
  amount: number;
  type: 'entry_fee' | 'prize' | 'deposit' | 'withdrawal' | 'refund';
  race_id: string | null;
  description: string;
  created_at: string;
};
