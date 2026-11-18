-- Videos in Galerien: `media_type` 'video' = `full_path` ist die Videodatei (MP4/MOV/WebM, Metadaten entfernt),
-- `thumb_path`/`web_path` sind Vorschaubilder (WebP); `duration_seconds` = Laufzeit laut Browser (optional).
ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image';
ALTER TABLE gallery_images DROP CONSTRAINT IF EXISTS gallery_images_media_type_check;
ALTER TABLE gallery_images ADD CONSTRAINT gallery_images_media_type_check
	CHECK (media_type IN ('image', 'video'));
ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS duration_seconds real;
