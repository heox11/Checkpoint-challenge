/*
  # Prevent Race Cancellation Once Started

  1. Changes
    - Add database trigger to prevent status changes to 'cancelled' after race has started
    - Ensures races cannot be cancelled once countdown begins or race is in progress
    
  2. Purpose
    - Enforces rule that participants must complete all checkpoints
    - Prevents abandoning races after they've begun
*/

CREATE OR REPLACE FUNCTION prevent_race_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('in_progress') AND NEW.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot cancel a race that is already in progress';
  END IF;
  
  IF OLD.countdown_started_at IS NOT NULL AND NEW.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot cancel a race after countdown has started';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_race_cancellation_trigger ON races;

CREATE TRIGGER prevent_race_cancellation_trigger
  BEFORE UPDATE ON races
  FOR EACH ROW
  EXECUTE FUNCTION prevent_race_cancellation();
