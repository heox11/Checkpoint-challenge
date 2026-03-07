/*
  # Add Participant Location Tracking

  ## Changes
  1. Modifications to `race_participants` table
    - Add `current_lat` (decimal) - Participant's current latitude
    - Add `current_lng` (decimal) - Participant's current longitude
    - Add `joined_lat` (decimal) - Latitude when participant joined
    - Add `joined_lng` (decimal) - Longitude when participant joined
  
  2. Modifications to `races` table
    - Make `checkpoint_lat` and `checkpoint_lng` nullable since they'll be set when someone joins
  
  ## Purpose
  These changes allow participants' locations to be tracked and used as checkpoint destinations.
*/

-- Add location columns to race_participants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'race_participants' AND column_name = 'current_lat'
  ) THEN
    ALTER TABLE race_participants ADD COLUMN current_lat decimal(10, 6);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'race_participants' AND column_name = 'current_lng'
  ) THEN
    ALTER TABLE race_participants ADD COLUMN current_lng decimal(10, 6);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'race_participants' AND column_name = 'joined_lat'
  ) THEN
    ALTER TABLE race_participants ADD COLUMN joined_lat decimal(10, 6);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'race_participants' AND column_name = 'joined_lng'
  ) THEN
    ALTER TABLE race_participants ADD COLUMN joined_lng decimal(10, 6);
  END IF;
END $$;

-- Make checkpoint columns nullable in races table
DO $$
BEGIN
  ALTER TABLE races ALTER COLUMN checkpoint_lat DROP NOT NULL;
  ALTER TABLE races ALTER COLUMN checkpoint_lng DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;