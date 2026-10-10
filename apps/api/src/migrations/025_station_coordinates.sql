-- Unknown station locations must not inherit an invented Lagos origin.
ALTER TABLE stations
  ALTER COLUMN lat DROP DEFAULT,
  ALTER COLUMN lng DROP DEFAULT,
  ALTER COLUMN lat DROP NOT NULL,
  ALTER COLUMN lng DROP NOT NULL;

-- Preserve all existing coordinates. The former placeholder pair requires
-- confirmation by the partner before customers rely on it for distance ranking.
ALTER TABLE stations ADD COLUMN IF NOT EXISTS location_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE stations SET location_confirmed = TRUE
WHERE lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180
  AND NOT (lat = 6.5244 AND lng = 3.3792);
