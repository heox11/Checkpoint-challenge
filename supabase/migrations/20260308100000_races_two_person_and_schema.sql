ALTER TABLE races ALTER COLUMN max_participants SET DEFAULT 2;

UPDATE races SET max_participants = 2 WHERE max_participants != 2;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'races_max_participants_two'
  ) THEN
    ALTER TABLE races ADD CONSTRAINT races_max_participants_two CHECK (max_participants = 2);
  END IF;
END $$;
