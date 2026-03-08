/*
  # Add Checkpoint Sequences to Race Participants

  1. Changes
    - Add `checkpoint_sequence` column to `race_participants` table
      - Stores array of user IDs representing the order in which participant must visit other participants
      - Format: [user_id_1, user_id_2, ..., own_user_id]
    - Add `current_checkpoint_index` column to track progress through the sequence
    - Add `checkpoints_visited` column to track which checkpoints have been reached
    
  2. Purpose
    - Enables multi-checkpoint races where each participant visits all other participants in a unique order
    - Prevents race cancellation once started
    - Tracks individual progress through checkpoint sequence
*/

-- Add checkpoint sequence tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'race_participants' AND column_name = 'checkpoint_sequence'
  ) THEN
    ALTER TABLE race_participants 
    ADD COLUMN checkpoint_sequence uuid[] DEFAULT ARRAY[]::uuid[];
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'race_participants' AND column_name = 'current_checkpoint_index'
  ) THEN
    ALTER TABLE race_participants 
    ADD COLUMN current_checkpoint_index integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'race_participants' AND column_name = 'checkpoints_visited'
  ) THEN
    ALTER TABLE race_participants 
    ADD COLUMN checkpoints_visited integer DEFAULT 0;
  END IF;
END $$;

-- Add current target checkpoint to participants table for easy querying
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'race_participants' AND column_name = 'current_target_user_id'
  ) THEN
    ALTER TABLE race_participants 
    ADD COLUMN current_target_user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;