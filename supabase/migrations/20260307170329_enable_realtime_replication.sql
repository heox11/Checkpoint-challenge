/*
  # Enable Realtime Replication for Race Tables

  1. Changes
    - Enable realtime for `races` table
    - Enable realtime for `race_participants` table
  
  2. Purpose
    - Allows real-time updates when races are created, updated, or deleted
    - Allows real-time updates when participants join, ready up, or finish races
    - Ensures all users see live updates without needing to refresh
*/

-- Enable realtime for races table
ALTER PUBLICATION supabase_realtime ADD TABLE races;

-- Enable realtime for race_participants table
ALTER PUBLICATION supabase_realtime ADD TABLE race_participants;
