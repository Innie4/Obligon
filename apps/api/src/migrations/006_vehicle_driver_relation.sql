-- 006: link fleet vehicles to the existing driver entity
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vehicles_driver_idx ON vehicles(driver_id);
