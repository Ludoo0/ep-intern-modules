-- Optionaler Zeitraum einer Galerie (Sortierung der Liste: Start ?? frühester Termin ?? Anlagedatum)
ALTER TABLE galleries ADD COLUMN IF NOT EXISTS starts_on date;
ALTER TABLE galleries ADD COLUMN IF NOT EXISTS ends_on date;
ALTER TABLE galleries DROP CONSTRAINT IF EXISTS galleries_dates_check;
ALTER TABLE galleries ADD CONSTRAINT galleries_dates_check
	CHECK (ends_on IS NULL OR (starts_on IS NOT NULL AND ends_on >= starts_on));
