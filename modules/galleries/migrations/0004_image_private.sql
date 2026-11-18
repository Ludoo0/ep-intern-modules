-- Einzelne Bilder „nur intern“: private Bilder einer öffentlichen Galerie liefert die Website-API nie aus
-- (nicht in Liste/Detail, nicht als Datei, nicht als Titelbild, nicht in der Bildanzahl).
ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
