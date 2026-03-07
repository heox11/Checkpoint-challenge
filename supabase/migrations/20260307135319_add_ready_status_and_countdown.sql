/*
  # Add Ready Status and Race Start System

  ## Changes
  1. Modifications to `race_participants` table
    - Add `is_ready` (boolean, default false) - Whether participant has clicked ready
    - Add `ready_at` (timestamptz) - When participant clicked ready
  
  2. Modifications to `races` table
    - Add `countdown_started_at` (timestamptz) - When countdown began (all participants ready)
    - Add `actual_start_time` (timestamptz) - Actual race start time after countdown
  
  ## Purpose
  Allows participants to ready-up before race starts, with automatic countdown when all are ready.
*/

-- Add ready status to race_participants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'race_participants' AND column_name = 'is_ready'
  ) THEN
    ALTER TABLE race_participants ADD COLUMN is_ready boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'race_participants' AND column_name = 'ready_at'
  ) THEN
    ALTER TABLE race_participants ADD COLUMN ready_at timestamptz;
  END IF;
END $$;

-- Add countdown and actual start time to races
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'races' AND column_name = 'countdown_started_at'
  ) THEN
    ALTER TABLE races ADD COLUMN countdown_started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'races' AND column_name = 'actual_start_time'
  ) THEN
    ALTER TABLE races ADD COLUMN actual_start_time timestamptz;
  END IF;
END $$;