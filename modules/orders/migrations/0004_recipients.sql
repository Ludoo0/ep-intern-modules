-- Bestellungen für Gruppen und den Stamm (1.3.0, 2026-11-20): ohne Rechnung, Empfängerart + Gruppe.
-- `member_name` bleibt der Namens-Snapshot des Empfängers (Gruppenname bzw. „Stamm“).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_kind text NOT NULL DEFAULT 'member';
-- Gruppe aus dem Modul `members` (ohne FK, wie `member_id`)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS group_id text;
ALTER TABLE orders ALTER COLUMN member_id DROP NOT NULL;

ALTER TABLE orders ADD CONSTRAINT orders_recipient_check CHECK (
	(recipient_kind = 'member' AND member_id IS NOT NULL AND group_id IS NULL)
	OR (recipient_kind = 'group' AND group_id IS NOT NULL AND member_id IS NULL)
	OR (recipient_kind = 'stamm' AND member_id IS NULL AND group_id IS NULL)
);

CREATE INDEX IF NOT EXISTS orders_group_idx ON orders (group_id) WHERE group_id IS NOT NULL;
