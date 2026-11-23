---
paths: ["modules/galleries/**", "tests/**/galleries*", "src/lib/server/core/images/**", "tests/unit/images*"]
---

# Modul `galleries` (Galerien)

Fotos **und Videos** (seit 1.5.0) intern sammeln und ausgewählte Galerien auf der **Stammeswebsite** zeigen. Schema `mod_galleries`, Version 1.6.0,
startet deaktiviert, keine harten Abhängigkeiten; `optionalDependencies: ['members', 'events']` (Gruppen/Mitglieder als
Freigabe-Ziele, Termine für die Zuordnung **ganzer Galerien** (nicht einzelner Bilder) – ohne `events` entfällt die Zuordnung still, Eingabe → 422).
Freigabe nach dem Muster `events` (**Freigabe an Principals**, siehe `architecture.md`), dazu je Galerie **öffentlich/privat**
und je Bild **„nur intern“** (nie auf der Website, auch in öffentlichen Galerien).
Bildverarbeitung serverseitig über den Core-Dienst `core.images` (sharp). Navigation „Galerien“ (Icon `images`).

## Dateien (`modules/galleries/`)
| Datei | Inhalt |
|---|---|
| `module.ts` | Manifest (Rechte, `defaultRoleGrants` Mitglied → `galleries.gallery.view`, Navigation), Migrationen, `search`, `resetAreas`/`resetUsers`, `onUserDeleted`, `subjectExport` (kein `onMemberDeleted`, kein `backup`-Hook), Endpoints (Reihenfolge `website` → `meta` → `download` → `images` → `galleries`, erster Treffer gewinnt) |
| `ui.ts` | Route `''` → `GalleriesPage`, `':id'` → `GalleryDetailPage` |
| `schemas.ts` | API-Vertrag (Server + UI): `galleryInput`, `coverInput`, `uploadFields`, `imageUpdateInput`, `imageBulkInput` (`BULK_ACTIONS`), `shareInput`, `eventId`, Params (`idParams`, `imageParams`, `variantParams`, `websiteVariantParams`), Queries (`listQuery`, `principalSearchQuery`, `eventSearchQuery`, `websiteListQuery`, `websiteImagesQuery`), Konstanten (`VISIBILITIES` + Labels/Beschreibungen, `IMAGE_VARIANTS`, `WEBSITE_VARIANTS`, `IMAGE_CONTENT_TYPES`/`IMAGE_ACCEPT`, `MAX_IMAGE_BYTES` 25 MB, `MAX_IMAGES_PER_GALLERY` 2000, `MAX_EVENTS_PER_IMAGE` 20, `MAX_SHARES` 200, `MAX_BULK` 200, `UPLOAD_CONCURRENCY` 3), DTOs `GalleryItem`, `GalleryDetail`, `GalleryImage`, `GalleryShare`, `EventRef`, `ImageCover`, `Website*`, Helfer `imageUrl()` |
| `access.ts` | Nur Konfiguration des SDK-Bausteins `createShareAccess` (#35, `readIf` = `visibility = 'public'`): `resolveAccess`, `requireAccess` (404/403), `visibleGalleriesFilter` (SQL, Alias `g`), `accessForMany`, `canEditAll`/`canViewAll`, `loadShares`, `replaceShares` |
| `files.ts` | `db()`, `filesCtx()` (Systemkontext `galleries-files`), `VARIANT_SPECS`, `variantPath`, `VARIANT_COLUMN`, `removeFiles` (best-effort, Sammel-Löschung `core.storage.removeMany`), `fileResponse` (gestreamte Response über `core.storage.downloadStream`), `effectiveCoverSql`/`effectiveCover`, `eventsService()` |
| `galleries.service.ts` | `loadShares`/`replaceShares`, Termine der Galerie: `loadEventIds`, `eventIdsByGallery`, `replaceGalleryEvents`, `validateEventIds(ctx, ids, keep)`, `describeEvents`/`pickEvents`; `loadDetailData` (in der Transaktion, prüft Lesezugriff) + `finishDetail` (danach: Eigentümer*in, Termine, Freigaben), `buildGalleryDetail(ctx, id, keys)`, `describeShares`, `everyoneLabel()` (Einstellung `events.stamm.name`, sonst „Stamm“), `iso`, `likePattern`; Sortierung `STARTS_ON_SQL`/`ENDS_ON_SQL`/`CREATED_ON_SQL`, `sortRowOf`, `gallerySortDate`, `compareGalleries` |
| `images.service.ts` | `IMAGE_COLUMNS` (Alias `i`), `toGalleryImage`, `requireImageRow`/`requireImagesOfGallery`, `imagePathsOf`, `sanitizeOriginalName`, `downloadName` |
| `galleries.endpoints.ts` | CRUD `/galleries`, Titelbild `/galleries/:id/cover` |
| `download.endpoints.ts` | ZIP der ganzen Galerie (`GET /galleries/:id/download`): `zipStream` (fflate `Zip` + `ZipPassThrough`, gestreamt), `uniqueNames`, `MAX_ZIP_BYTES` |
| `images.endpoints.ts` | Upload (→ `upload.service.ts`), Bearbeiten, Sammelaktionen, Löschen, Auslieferung der Varianten (Videos mit Range) |
| `upload.service.ts` | `uploadMedia`: Bild (`core.images`, drei Varianten) oder Video (Typ per Magic Bytes, Metadaten entfernt, Pflichtfeld `poster` → `thumb`/`web`, `full_path` = Video) |
| `video.ts` | rein: `sniffVideoType` (MP4/MOV/WebM; AVIF/HEIC/Matroska abgelehnt), `stripVideoMetadata` (siehe Videos) |
| `pages/video-poster.ts` | Browser: Einzelbild (bei ≈ 1 s bzw. 10 %) als JPEG + Laufzeit; nicht dekodierbar → Platzhalter |
| `meta.endpoints.ts` | `/principals`, `/events` (Terminsuche über den `events`-Dienst), `/settings/stamm` → `{ name }` (für `everyoneLabel`), `/limits` → `UploadLimits` |
| `website.endpoints.ts` | `/website/galleries[/:id]` (mit Website-Terminen, Filter `eventId`), Bilddateien `thumb`/`web` |
| `website.schemas.ts` | Zod-Vertrag der Website-DTOs (#48): `websiteGallerySchema`, `websiteGalleryDetailSchema`, `websiteGalleryListSchema`, `websiteEventRefSchema`; Typgleichheit zu den DTOs geprüft, Integrationstests parsen die Antworten dagegen |
| `assist.ts` | KI-Schreibhilfe (`galleries.ai.use`): Galerie- und Bildbeschreibung; Kontext `galleries:image` (`<galerie>:<bild>`) schickt die Web-Variante nur mit `core.ai.assist.allowImages` |
| `search.ts` | Globale Suche (`galleriesSearch`): Galerien nach Titel/Beschreibung, sichtbar wie `GET /galleries` (`visibleGalleriesFilter`, Principal-Schlüssel vor der Transaktion), zuletzt geänderte zuerst |
| `user-deleted.ts` | `onUserDeleted`: Freigaben `user:<id>` löschen, Eigentum an `transferTo` (sonst unverändert), `created_by`/`uploaded_by`/`public_confirmed_by` → `NULL` |
| `reset.ts` | Reset-Bereich `all` (vier Tabellen, Kind vor Eltern, `storagePrefixes: 'all'`, `rebuild`), `resetUsers` (Benutzer-Freigaben löschen, `owner_id`/`created_by`/`uploaded_by` auf den verbleibenden Benutzer) |
| `pages/GalleriesPage.svelte` | Kartenraster (alle Kacheln gleich hoch: `auto-rows-fr`, Zeitraum- und Termin-Zeile immer reserviert) mit Titelbild, Zeitraum, Badge Öffentlich/Privat, Suche/Filter, „Neue Galerie“ |
| `pages/GalleryDialog.svelte` | Anlegen/Bearbeiten: Titel, Beschreibung, Sichtbarkeit, **Termine** (`EventPicker`), **Zeitraum** Von/Bis (wird beim Hinzufügen eines Termins vorbelegt, wenn leer), `SharePanel` lokal (nur Anlegen) |
| `pages/GalleryDetailPage.svelte` | Kopf mit **`ShareMenu` oben rechts** (`type`, `everyoneLabel`), Bearbeiten, Menü „Mehr“ (Als ZIP herunterladen mit `download`-Recht, Löschen mit `edit`), Zeitraum, Bilder |
| `pages/UploadZone.svelte` | Mehrfachauswahl, Drag & Drop, Fortschritt, 3 Uploads parallel (`UPLOAD_CONCURRENCY`) |
| `pages/ImageGrid.svelte` | Bildraster (`thumb`), Badges „Titelbild“ und „Nur intern“, Auswahlmodus |
| `pages/ImageViewer.svelte` | Lightbox (←/→), Beschreibung bearbeiten, „Als Titelbild festlegen“, „Nur intern“ / „Für Website freigeben“, Download `full` |
| `pages/EventPicker.svelte` | Terminsuche (`GET /events?search=`), Mehrfachauswahl – im `GalleryDialog` (Feld „Termine“) |
| `pages/EventBadges.svelte` | Termine als Badges (Detailkopf; Karte mit `max={1} compact`) |
| `pages/ImageBulkBar.svelte` | Sammelleiste im Auswahlmodus: Nur intern, Für Website freigeben, Löschen |
| `contract.ts`, `refs.service.ts` | Dienst `GalleryRefsService` über `provides` (2026-10-25, für `website`): `searchPublicGalleryRefs`, `publicGalleryRefs` – nur öffentliche Galerien, ohne Rechteprüfung |
| `subject-export.ts` | Datenauskunft (`subjectExport`, Art. 15/20): eigene Galerien, hochgeladene Bilder (nur Metadaten), Freigaben an das Konto, Veröffentlichungs-Bestätigungen |
| `migrations/0001_init.sql` … `0006_gallery_dates.sql` | Schema; Termine je Galerie; Bestätigung beim Veröffentlichen; Bilder „nur intern“; Videos; Zeitraum |

## Datenmodell (0001)
- IDs sind `text` (UUID per `crypto.randomUUID()`), Zeitstempel `timestamptz`, keine FKs auf Core-/Fremdschemata.
- `galleries`: `id`, `title`, `description`, `visibility` CHECK `private|public` (Standard `private`), `cover_image_id`
  (NULL = Standard, FK `galleries_cover_fk` → `gallery_images` **ON DELETE SET NULL**), `owner_id` (ohne FK), `created_by`,
  `created_at`, `updated_at`. Indizes `owner_id`, `visibility`.
- `gallery_images` (FK `gallery_id` CASCADE): `description`, `position`, `original_name`, `content_type`, `width`, `height`,
  `size_bytes`, `thumb_path`, `web_path`, `full_path`, `uploaded_by`, `created_at`. Index `(gallery_id, created_at, id)`.
  Gespeichert werden **nur** metadatenfreie Varianten, nie das Original.
- `gallery_image_events` (0001) ist mit **0002 entfernt**: Termine hängen seit 0002 an der Galerie.
- `gallery_events` (0002, PK `gallery_id` + `event_id`, FK `gallery_id` CASCADE): Zuordnung der **ganzen Galerie** zu Terminen
  aus `events` (`event_id` ohne FK, anderes Schema), Index `event_id`. Migration 0002 hat vorhandene Bild-Zuordnungen auf die Galerie übernommen.
- 0003: `galleries.public_confirmed_at`/`public_confirmed_by` (Benutzer-ID ohne FK) – letzte Bestätigung der Einwilligungen beim Veröffentlichen.
- 0004: `gallery_images.is_private` boolean NOT NULL DEFAULT false – Bild „nur intern“ (siehe Website-Anbindung).
- 0005: `gallery_images.media_type` text NOT NULL DEFAULT `'image'` CHECK `image|video`, `duration_seconds` real NULL. Bei Videos: `full_path` = Videodatei,
  `thumb_path`/`web_path` = Vorschaubilder, `content_type`/`size_bytes` vom Video, `width`/`height` vom Vorschaubild. Videos zählen wie Bilder
  (Anzahl, Grenze 2000, Titelbild = Vorschaubild, „nur intern“, Sammelaktionen).
- 0006: `galleries.starts_on`/`ends_on` date NULL, CHECK `galleries_dates_check` (Ende nur mit Start, nicht davor). Ausgabe immer per `to_char(…, 'YYYY-MM-DD')`.
- `gallery_shares`: `<obj>_shares`-Muster (PK `gallery_id` + `principal_type` + `principal_id`, `principal_type` CHECK
  `everyone|group|role|user|member`, `level` CHECK `read|edit`, `created_by`, `created_at`), Index `(principal_type, principal_id)`.

## Titelbild
- **Effektiv** = `cover_image_id` ?? ältestes Bild (`ORDER BY created_at, id`) – `effectiveCoverSql` (Alias `g`) bzw. `effectiveCover(tx, id)`.
- `PUT /galleries/:id/cover` mit `{ imageId }` setzt, `{ imageId: null }` setzt auf Standard zurück; Bild muss zur Galerie gehören (422).
- Gelöschtes Titelbild → FK setzt NULL → wieder Standard. Detail liefert `coverImageId` (effektiv) und `coverIsDefault`; ohne Bilder `cover: null`.

## Rechte
| Schlüssel | Bedeutung |
|---|---|
| `galleries.gallery.view` | Grundrecht für alle internen Endpoints; sieht eigene, freigegebene und **öffentliche** Galerien. Rolle „Mitglied“ per `defaultRoleGrants` |
| `galleries.gallery.create` | Galerien anlegen (Handler prüft zusätzlich `view`; nur Benutzer, System → 400) |
| `galleries.gallery.view-all` | alle Galerien lesen |
| `galleries.gallery.edit-all` | alle Galerien bearbeiten/löschen; System-Kontext ebenso |
| `galleries.gallery.publish` | Galerie öffentlich stellen (Stammeswebsite, #67 01b-06): POST mit `public` bzw. PUT privat → öffentlich ohne Recht **403** (vor der Einwilligungsprüfung 422); Zurücknehmen darf jede*r mit Bearbeitungsrecht; UI sperrt „Öffentlich“ ohne Recht |
| `galleries.gallery.download` | ganze Galerie als ZIP (`GET /galleries/:id/download`, zusätzlich Objekt-`read`); **kein** `defaultRoleGrant` (Nutzerentscheidung 2026-11-20) – nur per Rolle |
| `galleries.website.read` | **nur** `/website/…` – Scope für den API-Key der Stammeswebsite; kein Zugriff auf interne Endpoints |

Keine `galleries.storage.*`-Rechte: Dateien werden nach der Objektprüfung mit dem Systemkontext gelesen/geschrieben.

## Zugriffsregeln (`access.ts`)
1. System oder `edit-all` → bearbeiten. 2. Eigentümer*in (`owner_id`) → bearbeiten. 3. Freigabe `edit` an einen passenden
Principal → bearbeiten. 4. Freigabe `read`, `view-all` **oder `visibility = public`** → lesen. 5. Sonst **404**; Lesen ohne
Bearbeiten bei Änderungen → **403**.
- Principal-Schlüssel immer **vor** der Transaktion: `principalKeysFor(ctx, 'galleries')`; in SQL `principalMatchSql('s', keys)`.
- Freigaben wie bei `events`: `validatePrincipals` (422 `['shares', i, 'id']`), `describePrincipals`, `searchPrincipals`;
  `PUT` ersetzt Freigaben komplett, `shares` im Detail nur bei Bearbeiten-Zugriff.
- `public` heißt: **alle** Konten mit `galleries.gallery.view` (auch Elternkonten) sehen die Galerie, und die Website darf sie abrufen.

## API (`/api/v1/modules/galleries/…`, Session oder API-Key, nicht öffentlich)
| Methode + Pfad | Recht | Besonderheiten |
|---|---|---|
| GET `/galleries` | gallery.view | sichtbare Galerien; Query `search`, `visibility`, `eventId` (Galerien zu einem Termin), `limit` 1–200 (50), `offset`; **Sortierung** siehe „Zeitraum und Sortierung“; Item mit Titel, Sichtbarkeit, `startsOn`/`endsOn`, `imageCount`, `cover { imageId, width, height }`, `events` (sichtbare Termine), `access` |
| GET `/galleries/:id` | gallery.view | Detail inkl. `events` (nur für den Aufrufer sichtbare Termine) und Bilder (Beschreibung, Maße), `coverImageId` + `coverIsDefault`, `shares` nur bei `edit` |
| POST `/galleries` | gallery.create | `galleryInput` strikt (`title`, `description`, `visibility`, `shares`, `eventIds` ≤ 20, `startsOn`/`endsOn` optional `YYYY-MM-DD`, Ende ohne Start bzw. vor Start → 422 `endsOn`); Eigentümer*in = Aufrufer; Termine über den `events`-Dienst geprüft (422 `eventIds[i]`; `events` inaktiv + nicht leer → 422 `eventIds`) |
| PUT `/galleries/:id` | Objekt-`edit` | ersetzt alles inkl. Freigaben, Termine und Zeitraum (fehlt `startsOn` → gelöscht); bereits gespeicherte, inzwischen unsichtbare Termine bleiben ungeprüft |
| (POST/PUT) Veröffentlichen | – | wird die Galerie öffentlich (Neuanlage `public` oder privat → öffentlich), ist `consentConfirmed: true` Pflicht, sonst **422** Pfad `consentConfirmed`; speichert `public_confirmed_at`/`_by`, Audit-Metadaten `consentConfirmed: true`. Bleibt sie öffentlich, keine neue Bestätigung; zurück auf privat → Bestätigung bleibt als Historie, erneutes Veröffentlichen verlangt eine neue. Detail: `publicConfirmation { at, by: { id, name } \| null } \| null` |
| GET `/galleries/:id/download` | gallery.view + **gallery.download** (403) + Objekt-`read` (404) | ZIP aller Einträge in Upload-Reihenfolge: Bilder `full`, Videos die Videodatei, auch „nur intern“; Namen `downloadName` + `safeFileName` (Umlaute ausgeschrieben), Duplikate ohne Groß-/Kleinschreibung → `name (2).jpg`; gestreamt (fflate, ohne Kompression, Dateien nacheinander aus dem Storage), `attachment` `<Titel>.zip`, `no-store`; leer → 422, Σ `size_bytes` > 3,5 GB → 413 (kein ZIP64); Rate-Limit 10/60 s; Audit `galleries.gallery.downloaded` `{ images, videos }`. Fehler mitten im Stream → abgebrochener Download |
| DELETE `/galleries/:id` | Objekt-`edit` | CASCADE; Dateien **nach** der Transaktion best-effort entfernen |
| PUT `/galleries/:id/cover` | Objekt-`edit` | `{ imageId \| null }` (null = Standard); fremdes Bild → 422 |
| POST `/galleries/:id/images` | Objekt-`edit` | multipart `file` (+ optional `description`), Bild ≤ 25 MB, ≤ 2000 Einträge je Galerie; **ein Request je Datei**. Video (Typ oder Endung MP4/M4V/MOV/WebM): ≤ 100 MB bzw. `core.storage.maxFileSizeMb`, Pflichtfeld `poster` (JPEG/PNG/WebP, sonst 422 `poster`), optional `duration` (0–86400 s, 422 `duration`); Inhalt kein Video → 422 `file`; Speicher ohne Videotypen → 422 `file` mit Hinweis |
| PUT `/galleries/:id/images/:imageId` | Objekt-`edit` | `{ description, isPrivate? }` (strikt; `isPrivate` fehlt → unverändert; `eventIds` am Bild → 422) |
| POST `/galleries/:id/images/bulk` | Objekt-`edit` | `{ action: 'delete' \| 'make-private' \| 'make-public', ids ≤ 200 }` → `{ affected }`; fremde ID → 404, nichts geändert |
| DELETE `/galleries/:id/images/:imageId` | Objekt-`edit` | Bild + Dateien |
| GET `/limits` | gallery.view | `{ maxImageBytes, maxVideoBytes, videosAllowed }` aus `core.storage.maxFileSizeMb`/`allowedContentTypes` (UI: Hinweistext, `accept`, Vorprüfung) |
| GET `/galleries/:id/images/:imageId/:variant` | gallery.view + Objekt-`read` | `thumb\|web\|full\|video` (`video` nur bei Videos, sonst 404; `full`/`video` eines Videos beantworten **Range** mit 206/416, `accept-ranges: bytes`), rohe Response (gestreamt), `private, max-age=3600`, `nosniff`; `full` mit `content-disposition: attachment`; eigenes Rate-Limit `IMAGE_RATE_LIMIT` (1200/60 s, #23 – das Standardlimit 120/60 s gilt je Endpunktmuster, also für alle Bilder zusammen) |
| GET `/principals` | gallery.view | Query `search` (2–100 Zeichen) → `searchPrincipals`; nur mit `create`/`edit-all`/eigener Galerie/`edit`-Freigabe (sonst 403), 60/60 s; Mitglieder nur mit `members.member.view`, E-Mail nur mit `core.users.view` |
| GET `/events` | gallery.view | Terminsuche (`search`, `limit` 1–50) über den `events`-Dienst, nur sichtbare Termine; ohne `events` bzw. ohne `events.event.view` → `[]` |
| GET `/website/galleries` | **website.read** | nur `public`, sortiert wie intern (mit Website-Terminen): `id`, `title`, `description`, `startsOn`, `endsOn`, `imageCount`, `cover`, `events` (nur `onWebsite`), `updatedAt`; `eventId` = nur Galerien zu diesem Website-Termin (sonst leer); `limit`/`offset`; Rate-Limit 120/60 s |
| GET `/website/galleries/:id` | **website.read** | öffentliche Galerie (mit `events`, nur `onWebsite`) + Bilder (`id`, Beschreibung, Maße, `position`, `mediaType`, `durationSeconds`); privat → 404 |
| GET `/website/galleries/:id/images/:imageId/:variant` | **website.read** | nur `thumb\|web\|video` (`full` → 422; `video` mit Range, Dateiname `<imageId>.<ext>`, bei Bildern 404), Bild einer privaten Galerie → 404, Rate-Limit `IMAGE_RATE_LIMIT` (1200/60 s), `public, max-age=86400` |

Audit: `galleries.gallery.created|updated|deleted|cover_changed|published|unpublished|downloaded`, `galleries.image.uploaded|updated|deleted|bulk_updated` –
`target` = ID, metadata nur IDs/Zähler/`visibility`, **keine** Beschreibungen oder Dateinamen.

## Zeitraum und Sortierung (1.6.0, 2026-11-20)
- Galerie hat optional `startsOn`/`endsOn` (Wunsch des Nutzers: „damit sie richtig sortiert werden“). Anzeige mit `formatRefRange` (Karte, Detailkopf).
- **Sortierung** `GET /galleries` und `GET /website/galleries` (Nutzerentscheidung): eigenes Startdatum, sonst Beginn des **frühesten** verknüpften Termins,
  sonst Anlagedatum (Berliner Kalendertag), **neueste zuerst**; Gleichstand: `updated_at` absteigend, Titel, ID.
- Termine liegen in `mod_events` → Sortierung **in der App**: alle passenden Galerien (nur Sortierdaten) laden, Termine über den `events`-Dienst
  (`describeEvents` mit dem Aufrufer-Kontext bzw. `websiteEventRefs` mit „auf der Website“) auflösen, sortieren, Seite ausschneiden, volle Daten nur für die Seite.
  Unsichtbare Termine zählen also nicht; ändert sich ein Termindatum, ändert sich die Reihenfolge sofort. Aufwand wächst mit der Zahl der Galerien (für einen Stamm unkritisch).
- Widget, Suche und `refs.service.ts` sortieren weiter nach „zuletzt geändert“.

## Website-Anbindung
- Nur Galerien mit `visibility = public`, nur öffentliche Felder (`WebsiteGallery`, `WebsiteImage`): keine Freigaben,
  Eigentümer*innen, Dateinamen, Uploader. Termine der Galerie nur, wenn sie selbst „auf der Website“ stehen (`websiteEventRefs`). Bilder zu einem Termin: `GET /website/galleries?eventId=` und dann das Detail.
- **Bilder „nur intern“** (`is_private`, seit 1.4.0): erscheinen über `/website/…` **nie** – nicht im Detail, nicht in `imageCount`,
  nie als `cover` (gesetztes Titelbild privat → ältestes nicht privates Bild, `websiteCoverSql` in `files.ts`; nur private Bilder → `cover: null`),
  Datei → 404. Ebenso zählt `publicGalleryRefs`/`searchPublicGalleryRefs` (Blog im Modul `website`) nur nicht private Bilder.
  Intern unverändert sichtbar (`GalleryImage.isPrivate`, Badge), auch das interne Titelbild darf privat sein.
- **Bilddateien nur mit Key** über `/website/galleries/:id/images/:imageId/thumb|web`; `full` gibt es für die Website **nie**.
  Es gibt keine öffentlichen oder signierten Bild-URLs – die Website lädt Bilder serverseitig und liefert sie selbst aus (bzw. cacht sie).
- Einrichtung wie bei `events`: Benutzer*in mit `galleries.website.read` legt einen API-Key mit **nur** dem Scope
  `galleries.website.read` an (ggf. zusammen mit `events.website.read` in einem Key). Abruf **serverseitig** (Key nie im Browser, kein CORS):
  ```bash
  curl -H "Authorization: Bearer epk_…" \
    "https://intern.example.org/api/v1/modules/galleries/website/galleries?limit=20"
  curl -H "Authorization: Bearer epk_…" -o bild.webp \
    "https://intern.example.org/api/v1/modules/galleries/website/galleries/<id>/images/<imageId>/web"
  ```
- Antworten cachen; Modul deaktiviert → `404 module_disabled`. Ein Key nur mit diesem Scope bekommt intern **403**.

## Bildverarbeitung (`core.images`, `src/lib/server/core/images/index.ts`)
- `core.images.process(bytes, { variants, maxInputPixels?, maxInputBytes? })` → `{ format, width, height, hasAlpha, variants[] }`
  (je Variante `bytes`, `contentType`, `extension`, `width`, `height`). sharp **nur im Core**; Typen über `$lib/sdk/server`.
- Prüft den **Inhalt** per sharp-Metadaten (JPEG, PNG, WebP, AVIF, GIF – nur erstes Bild), nicht den angegebenen Typ;
  `limitInputPixels` 50 MP, ≤ 25 MB. Seit sharp 0.35.5 (2026-10-20): **Magic-Bytes-Prüfung** `sniffImageFormat` vor dem ersten
  sharp-Aufruf (Format muss zur libvips-Erkennung passen) und prozessweit gesperrte Loader außer JPEG/PNG/WebP/GIF/HEIF
  (`ALLOWED_VIPS_LOADERS`, `sharp.block`); Test `tests/unit/images-hardening.test.ts`. Dreht nach EXIF (`rotate()`), **entfernt alle Metadaten** (EXIF inkl. GPS, XMP, IPTC; ICC → sRGB).
- Varianten (`VARIANT_SPECS` in `files.ts`): `thumb` 480 px lange Kante WebP q75, `web` 2048 px WebP q82, `full`
  Originalauflösung metadatenfrei, JPEG q90 bzw. PNG bei Transparenz (`format: 'auto'`). Nie vergrößern.
- Fehler: leer/unlesbar/nicht unterstützt/zu viele Pixel → 400 (`badRequest`), zu groß → 413 (`tooLarge`); Texte deutsch mit Umlauten.

## Videos (1.5.0, 2026-11-18)
- Formate **MP4/M4V, MOV, WebM** (`VIDEO_CONTENT_TYPES`, Endungen `VIDEO_EXTENSIONS`, `videoTypeOf`): Erkennung des Uploads nach Browser-Typ **oder** Endung,
  Prüfung des Inhalts per `sniffVideoType` (ftyp-Marke ohne AVIF/HEIC, QuickTime ohne ftyp, EBML mit DocType `webm`). Kein ffmpeg im Core: **keine Neukodierung** –
  abspielbar ist, was der Browser kann (H.264 überall; HEVC-MOV vom iPhone v. a. in Safari, sonst nur Download).
- **Metadaten** (`stripVideoMetadata`, Länge bleibt gleich): MP4/MOV `udta`/`meta` (oberste Ebene, `moov`, `trak`, `mdia`, `minf`) und XMP-`uuid` → `free` mit Nullen
  (GPS `©xyz` bzw. `com.apple.quicktime.location.ISO6709`, Gerät, Software); WebM `Tags` im `Segment` → `Void`. Chunk-Offsets bleiben gültig. Nicht entfernt:
  Zeitstempel in `mvhd`, Metadaten-Spuren (`mebx`), Tags hinter Elementen unbekannter Größe (WebM aus MediaRecorder).
- **Vorschaubild** erzeugt der Browser (`pages/video-poster.ts`), der Server macht daraus per `core.images` `thumb`/`web` (`POSTER_SPECS`); API-Clients schicken `poster` selbst.
- **Größe**: `MAX_VIDEO_BYTES` 100 MB (ein Request, unter `BODY_SIZE_LIMIT` 110 MB), effektiv `min(100 MB, core.storage.maxFileSizeMb)` – Standard des Speichers 50 MB.
  Das Video liegt beim Upload komplett im Arbeitsspeicher (wie Bilder).
- **Speicher-Freigabe nötig**: Die Core-Standardliste (`DEFAULT_ALLOWED_CONTENT_TYPES`) enthält keine Videotypen. Ohne `video/mp4`, `video/quicktime`, `video/webm`
  in `core.storage.allowedContentTypes` (ersetzt die Standardliste komplett – Standardtypen mit eintragen) → 422, die UI blendet Videos dann aus.
  **Offen:** Videotypen in die Core-Standardliste aufnehmen (Core-Repo, danach Tag + Submodul).
- **Range**: `rangeFileResponse` (`files.ts`, `parseRange`/`sliceStream`) schneidet den Bereich aus `core.storage.downloadStream` – Bytes vor dem Bereich werden aus S3
  gelesen und verworfen (Spulen ans Ende liest die Datei einmal ganz). Antwort über `secureFileResponse` (Videotypen dort nicht inline → `attachment`, für `<video>` egal).
- UI: Raster mit Play-Symbol und Laufzeit, Betrachter mit `<video controls>` (Poster = `web`; Wischen/Pfeiltasten auf dem Video gehören dem Player), Texte „Bild“/„Video“.
  Zählungen heißen weiter „Bilder“.

## Storage
- Dateien über `core.storage` mit `filesCtx()` = `core.auth.systemContext('galleries-files')`, **erst nach** der Objektprüfung
  (Muster `actions/service.ts`). Pfad `<galleryId>/<imageId>-<variant>.<webp|jpg|png>` (`variantPath`), Videos `<galleryId>/<imageId>-video.<mp4|mov|webm>` (`videoPath`).
- Upload: verarbeiten → Storage → DB; bei DB-Fehler Dateien best-effort entfernen (`removeFiles`). Ohne S3 → **503**.
- Core-Aufrufe (`storage`, `audit`, `users.directory`, `events`-Dienst) **nie** in offener Modul-Transaktion (PGlite).
- Reset `all` löscht Dateien per `storagePrefixes: 'all'` (`core.storage.purge`).
- Löschen (Galerie, Bild, Sammelaktion) nach der Transaktion über `removeFiles` → `core.storage.removeMany` (#24): S3 `DeleteObjects` in Paketen
  à 1000, Sammel-Löschung der Metadaten, **ein** Audit-Eintrag `core.storage.files_deleted` (statt einem je Variante). Test `storage-batch-images.test.ts`.

## Benachrichtigungen (2026-10-25, `notify.ts`)
- `gallery-shared`: neu hinzugekommene Freigaben (ohne „ganzer Stamm“) beim Anlegen/Speichern, Empfänger über `principalUserIds` mit `galleries.gallery.view`.

## Tests
- Unit: `tests/unit/images.test.ts` (sharp-erzeugte Testbilder: EXIF-Drehung, Metadaten/GPS weg, Größen der Varianten,
  PNG mit Transparenz, falsches Format/Pixelgrenze, AVIF/GIF; HEIC abgelehnt), `galleries-schemas.test.ts`, `galleries-reset.test.ts`
  (Titelbild-FK `SET NULL` von der Reihenfolge-Prüfung ausgenommen), `galleries-files.test.ts`.
- Integration: `galleries.test.ts` (Zugriffsmatrix Owner/Freigabe/Public/view-all/edit-all/fremd 404, 422, Audit ohne Inhalte,
  Modul aus → 404), `galleries-images.test.ts` (Upload mit `tests/helpers/fake-storage.ts`, Titelbild-Fallback, Termin-Zuordnung der Galerie
  mit/ohne `events`, Sammelaktionen), `galleries-website.test.ts` (nur `public`, Felder, Varianten, Key nur mit Scope → 403 intern),
  `events-refs.test.ts` (Dienst `EventRefsService`); „nur intern“ (PUT, Sammelaktion, Website-Detail/Liste/Titelbild/Datei, Verweis-Dienst) in `galleries-website.test.ts`.
- Zeitraum/Sortierung/ZIP: Unit `galleries-dates.test.ts` (Schema, `compareGalleries`, `uniqueNames`), Integration `galleries-dates-download.test.ts`
  (POST/PUT/422, Sortierung intern + Website + Blättern, ZIP-Inhalt per `unzipSync`, 403/404/422, Audit).
- Videos: Unit `galleries-video.test.ts` (Erkennung, Metadaten MP4/MOV/WebM, `parseRange`/`sliceStream`, Schema-Hilfen), Integration `galleries-videos.test.ts`
  (`/limits`, 422 ohne Videotypen, Upload MP4/MOV/WebM, Ablehnungen, 403, Range 200/206/416, Website, Löschen, Audit); synthetische Testdateien in `tests/video-fixtures.ts`.
  Nicht geprüft: Vorschaubild und Abspielen im echten Browser/iOS, echter S3.
- E2E: `tests/e2e/galleries.spec.ts` (ohne S3: aktivieren, anlegen per Dialog, Teilen „Stamm (alle)“, bearbeiten, Filter, löschen; Upload ohne S3 → „Dateispeicher nicht eingerichtet“). Upload-Erfolg über Integrationstests (Fake-Storage) und manuell mit MinIO (API).

## Entscheidungen und offen
- **Termine je Galerie, nicht je Bild** (Wunsch des Nutzers, 2026-10-18): eine Galerie gehört zu einem oder mehreren Terminen;
  einzelne Bilder haben keine Termine (API, UI und Website entsprechend, Migration 0002).
- Termin-Zuordnung über `events`-Dienst (`events/contract.ts`, `EventRefsService`: `searchEventRefs`, `describeEventRefs`,
  `websiteEventRefs`) per `core.modules.useOptional('events', 'galleries')`; Termine im Detail nur, wenn der Aufrufer sie sehen darf.
- **HEIC/HEIF nicht unterstützt** (sharp-Prebuilt ohne HEIC; Safari/iOS wandelt beim Upload meist in JPEG).
- **Kein Sortieren per Drag & Drop**: Reihenfolge = Upload-Reihenfolge (`created_at`, `id`; `position` vorhanden, aber nicht änderbar).
- Website lädt Bilder **serverseitig** mit Key; keine öffentlichen Bild-URLs, kein CORS.
- Öffentliche Galerien sind für die Website gedacht: Beschreibungen ohne personenbezogene Daten pflegen.
- **Einwilligungen (#27, 2026-10-20)**: Das System prüft die Einwilligungen der abgebildeten Personen nicht inhaltlich, verlangt aber beim
  Veröffentlichen eine **dokumentierte Bestätigung** (Dialog „Einwilligungen bestätigen“ im `GalleryDialog`, Zeitpunkt + Person gespeichert,
  Anzeige „Veröffentlichung bestätigt am … von …“ in der Detailansicht). Gelöschtes Konto → `public_confirmed_by = NULL` (Zeitpunkt bleibt).
  **Offen:** neue Bilder in einer bereits öffentlichen Galerie werden ohne erneute Bestätigung öffentlich (Abhilfe: einzelne Bilder „nur intern“ setzen); kein Abgleich mit `members.consent_website`.
- Demo: `scripts/seed-demo-galleries.mjs` (braucht MinIO; Login über `DEMO_EMAIL`/`DEMO_PASSWORD`, Standard `admin@demo.test`).
- Wie bei `events`: Wer per `edit`-Freigabe die **eigene** Freigabe entfernt, bekommt 404 und die Änderung wird zurückgenommen (Detail wird in derselben Transaktion neu geladen) – Doku von `events` sagt „darf sich selbst entfernen“, Code verhält sich wie hier. Offen.
- Nicht geprüft: Docker-Image-Build mit sharp (Produktions-Build lokal grün, sharp bleibt extern), Upload mit echtem S3 **in der Oberfläche** (per API mit MinIO geprüft).

## Verweise auf andere Module, Löschen und Reset (Stand 2026-10-21, Issue #76 10-09)
- `gallery_shares` mit `group:`/`member:` (aus `members`) und `gallery_events.event_id` (aus `events`), jeweils ohne FK: kein `onMemberDeleted`,
  kein Ereignis beim Löschen von Gruppen/Terminen; Reset `members:all` bzw. `events:all` impliziert keinen `galleries`-Bereich – die Zeilen bleiben.
  Anzeige: unbekannte Freigaben „Unbekannt“ (`describePrincipals`), Termine nur, soweit der `events`-Dienst sie noch kennt.
- Benutzerkonten: `onUserDeleted` (`user-deleted.ts`) bzw. `resetUsers`.

## Verweis-Dienst für andere Module (2026-10-26)
`GalleryRefsService` (`contract.ts`, `refs.service.ts`) bietet zusätzlich `searchGalleryCards(ctx, …)` / `describeGalleryCards(ctx, ids)`: Galerien,
die `ctx` sehen darf (wie `GET /galleries`, prüft `galleries.gallery.view` selbst), mit `visibility`, `coverUrl` (Thumb des Titelbilds bzw. ersten Bilds) und `href`.
Nutzer: Karten im `whiteboard`.
