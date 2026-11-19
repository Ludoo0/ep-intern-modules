-- Material v2.3: Bilder an Lebensmitteln (Vorrat) – eigene Uploads und lokal gespeicherte Bilder aus Open Food Facts.

ALTER TABLE images ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES food_products(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS images_product_idx ON images (product_id);

-- Herkunft: eigener Upload oder Open Food Facts (Lizenzhinweis CC BY-SA)
ALTER TABLE images ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload';
ALTER TABLE images DROP CONSTRAINT IF EXISTS images_source_check;
ALTER TABLE images ADD CONSTRAINT images_source_check CHECK (source IN ('upload', 'off'));

-- Genau ein Besitzer: Typ, Artikel oder Lebensmittel
ALTER TABLE images DROP CONSTRAINT IF EXISTS images_owner_check;
ALTER TABLE images ADD CONSTRAINT images_owner_check CHECK (num_nonnulls(type_id, item_id, product_id) = 1);
