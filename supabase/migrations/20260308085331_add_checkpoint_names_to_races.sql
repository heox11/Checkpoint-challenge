/*
  # Add Checkpoint Names to Races

  1. Changes
    - Add `checkpoint_name` column to races table for naming the checkpoint
    - Checkpoints now have human-readable names
  
  2. Notes
    - Existing races will have NULL checkpoint names
    - New races should include a checkpoint name
*/

-- Add checkpoint name column
ALTER TABLE races 
ADD COLUMN IF NOT EXISTS checkpoint_name text;

-- Add comment for clarity
COMMENT ON COLUMN races.checkpoint_name IS 'Human-readable name for the checkpoint location';
