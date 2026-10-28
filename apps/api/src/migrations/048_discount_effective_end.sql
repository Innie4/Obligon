-- Preserve requested dates while approved replacements shorten the effective window.
ALTER TABLE station_discount_requests ADD COLUMN IF NOT EXISTS effective_ends_at timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='station_discount_effective_end_bounds'
      AND conrelid='station_discount_requests'::regclass
  ) THEN
    ALTER TABLE station_discount_requests ADD CONSTRAINT station_discount_effective_end_bounds
      CHECK (effective_ends_at IS NULL OR (effective_ends_at>starts_at AND effective_ends_at<=ends_at));
  END IF;
END $$;
COMMENT ON COLUMN station_discount_requests.effective_ends_at IS
  'Optional earlier end set by an approved replacement. Never extends requested expiry; requested dates remain unchanged.';
