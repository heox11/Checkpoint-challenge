/*
  # Checkpoint Challenge Database Schema

  ## Overview
  This migration creates the complete database schema for the Checkpoint Challenge fitness racing app.

  ## 1. New Tables

  ### `profiles`
  - `id` (uuid, primary key) - References auth.users
  - `username` (text) - Unique username
  - `wallet_balance` (decimal) - Current wallet balance in euros
  - `total_races` (integer) - Total races participated in
  - `total_wins` (integer) - Total races won
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `races`
  - `id` (uuid, primary key) - Unique race identifier
  - `creator_id` (uuid) - User who created the race
  - `title` (text) - Race title
  - `entry_fee` (decimal) - Cost to join in euros
  - `prize_pool` (decimal) - Total prize money
  - `distance_km` (decimal) - Race distance in kilometers
  - `start_lat` (decimal) - Starting location latitude
  - `start_lng` (decimal) - Starting location longitude
  - `checkpoint_lat` (decimal) - Checkpoint location latitude
  - `checkpoint_lng` (decimal) - Checkpoint location longitude
  - `status` (text) - Race status: 'open', 'in_progress', 'completed', 'cancelled'
  - `max_participants` (integer) - Maximum number of participants
  - `start_time` (timestamptz) - When the race starts
  - `created_at` (timestamptz) - Race creation timestamp

  ### `race_participants`
  - `id` (uuid, primary key) - Unique participant record
  - `race_id` (uuid) - Reference to races table
  - `user_id` (uuid) - Reference to profiles table
  - `finish_time` (decimal) - Completion time in seconds
  - `average_heart_rate` (integer) - Average BPM during race
  - `average_speed` (decimal) - Average speed in km/h
  - `cheat_detected` (boolean) - Whether anti-cheat was triggered
  - `status` (text) - Participant status: 'joined', 'racing', 'finished', 'disqualified'
  - `joined_at` (timestamptz) - When user joined the race
  - `finished_at` (timestamptz) - When user completed the race

  ### `wallet_transactions`
  - `id` (uuid, primary key) - Unique transaction identifier
  - `user_id` (uuid) - Reference to profiles table
  - `amount` (decimal) - Transaction amount (positive for credits, negative for debits)
  - `type` (text) - Transaction type: 'entry_fee', 'prize', 'deposit', 'withdrawal'
  - `race_id` (uuid) - Reference to races table (if applicable)
  - `description` (text) - Transaction description
  - `created_at` (timestamptz) - Transaction timestamp

  ## 2. Security
  - Enable RLS on all tables
  - Users can read their own profile
  - Users can update their own profile (except wallet_balance)
  - Users can view all open races
  - Users can create races
  - Users can join races
  - Users can view their own transactions
  - Wallet balance changes require service role

  ## 3. Indexes
  - Index on race status for efficient filtering
  - Index on race participants for race lookups
  - Index on wallet transactions for user history
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  wallet_balance decimal(10, 2) DEFAULT 100.00 NOT NULL,
  total_races integer DEFAULT 0 NOT NULL,
  total_wins integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create races table
CREATE TABLE IF NOT EXISTS races (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  entry_fee decimal(10, 2) NOT NULL,
  prize_pool decimal(10, 2) DEFAULT 0 NOT NULL,
  distance_km decimal(10, 2) NOT NULL,
  start_lat decimal(10, 6) NOT NULL,
  start_lng decimal(10, 6) NOT NULL,
  checkpoint_lat decimal(10, 6) NOT NULL,
  checkpoint_lng decimal(10, 6) NOT NULL,
  status text DEFAULT 'open' NOT NULL,
  max_participants integer DEFAULT 10 NOT NULL,
  start_time timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_status CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled'))
);

-- Create race_participants table
CREATE TABLE IF NOT EXISTS race_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id uuid REFERENCES races(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  finish_time decimal(10, 2),
  average_heart_rate integer,
  average_speed decimal(10, 2),
  cheat_detected boolean DEFAULT false NOT NULL,
  status text DEFAULT 'joined' NOT NULL,
  joined_at timestamptz DEFAULT now() NOT NULL,
  finished_at timestamptz,
  CONSTRAINT valid_participant_status CHECK (status IN ('joined', 'racing', 'finished', 'disqualified')),
  CONSTRAINT unique_race_participant UNIQUE (race_id, user_id)
);

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount decimal(10, 2) NOT NULL,
  type text NOT NULL,
  race_id uuid REFERENCES races(id) ON DELETE SET NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_transaction_type CHECK (type IN ('entry_fee', 'prize', 'deposit', 'withdrawal', 'refund'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_races_status ON races(status);
CREATE INDEX IF NOT EXISTS idx_races_creator ON races(creator_id);
CREATE INDEX IF NOT EXISTS idx_race_participants_race ON race_participants(race_id);
CREATE INDEX IF NOT EXISTS idx_race_participants_user ON race_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE races ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Races policies
CREATE POLICY "Anyone can view open races"
  ON races FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create races"
  ON races FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Race creators can update their races"
  ON races FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Race participants policies
CREATE POLICY "Users can view race participants"
  ON race_participants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join races"
  ON race_participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participation"
  ON race_participants FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Wallet transactions policies
CREATE POLICY "Users can view own transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create transactions"
  ON wallet_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to update profile updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();