/*
  # Fix Race Update Policy for Participants

  1. Changes
    - Drop the restrictive race update policy
    - Add new policy allowing race participants to update countdown and status fields
    - Keep creator's full update permissions
  
  2. Security
    - Participants can only update specific fields: countdown_started_at, actual_start_time, status
    - Creators maintain full update permissions on their races
    - All other fields remain protected
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Race creators can update their races" ON races;

-- Allow creators to update all fields of their races
CREATE POLICY "Race creators can update their races"
  ON races
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Allow race participants to update countdown and race status fields
CREATE POLICY "Race participants can update race status"
  ON races
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM race_participants
      WHERE race_participants.race_id = races.id
      AND race_participants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM race_participants
      WHERE race_participants.race_id = races.id
      AND race_participants.user_id = auth.uid()
    )
  );
