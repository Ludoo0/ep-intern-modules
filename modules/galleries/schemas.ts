/**
 * API-Vertrag des Moduls `galleries` (Bilder / Galerien): Zod-Eingaben, DTO-Typen, Konstanten.
 * Wird von Server UND UI genutzt – keine Server-Imports.
 */
import { z } from 'zod';
import { PRINCIPAL_TYPES, type PrincipalType } from '$lib/sdk/types/sharing';

export const MODULE_ID = 'galleries';
/** Benachrichtigung (core.notifications): Galerie mit mir geteilt */
export const NOTIFY_GALLERY_SHARED = 'gallery-shared';

/** Recht zum Veröffentlichen (Sichtbarkeit „öffentlich“ = Stammeswebsite), #67 01b-06 */
export const PUBLISH_PERMISSION = 'galleries.gallery.publish';
/** Ganze Galerie als ZIP herunterladen (eigenes Recht, kein Standard-Grant) */
export const DOWNLOAD_PERMISSION = 'galleries.gallery.download';

export const VISIBILITIES = ['private', 'public'] as const;
export type Visibility = (typeof VISIBILITIES)[number];
export const VISIBILITY_LABELS: Record<Visibility, string> = {
	private: 'Privat',
	public: 'Öffentlich'
};
export const VISIBILITY_DESCRIPTIONS: Record<Visibility, string> = {
	private: 'Nur Eigentümer*in und Personen mit Freigabe',
	public: 'Für alle intern sichtbar und für die Stammeswebsite abrufbar'
};

export const SHARE_LEVELS = ['read', 'edit'] as const;
export type ShareLevel = (typeof SHARE_LEVELS)[number];
export const SHARE_LEVEL_LABELS: Record<ShareLevel, string> = { read: 'Sehen', edit: 'Bearbeiten' };

/** Bildvarianten (vom Server mit `core.images` erzeugt) */
export const IMAGE_VARIANTS = ['thumb', 'web', 'full'] as const;
export type ImageVariant = (typeof IMAGE_VARIANTS)[number];
/**
 * Abrufbare Dateien: Bildvarianten plus `video` (nur bei Videos: die Videodatei zum Abspielen, mit
 * Range-Anfragen). Bei Videos sind `thumb`/`web` Vorschaubilder und `full` der Download des Videos.
 */
export const MEDIA_VARIANTS = ['thumb', 'web', 'full', 'video'] as const;
export type MediaVariant = (typeof MEDIA_VARIANTS)[number];
/** Für die Website freigegebene Varianten (`full` nur intern) */
export const WEBSITE_VARIANTS = ['thumb', 'web', 'video'] as const;
export type WebsiteVariant = (typeof WEBSITE_VARIANTS)[number];

/** Art eines Eintrags der Galerie */
export const MEDIA_TYPES = ['image', 'video'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/** Annahme beim Upload (Inhalt wird serverseitig zusätzlich per sharp geprüft) */
export const IMAGE_CONTENT_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/avif',
	'image/gif'
] as const;
export const IMAGE_ACCEPT = IMAGE_CONTENT_TYPES.join(',');
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
/**
 * Videos (Inhalt wird per Magic Bytes geprüft, nicht neu kodiert): MP4/M4V, MOV (iPhone), WebM.
 * Abspielbar ist, was der Browser kann (H.264 überall, HEVC/MOV v. a. Safari).
 */
export const VIDEO_CONTENT_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export type VideoContentTypeName = (typeof VIDEO_CONTENT_TYPES)[number];
/** Dateiendungen → Videotyp (Browser melden bei `.mov`/`.m4v` teils keinen oder einen anderen Typ) */
export const VIDEO_EXTENSIONS: Readonly<Record<string, VideoContentTypeName>> = {
	mp4: 'video/mp4',
	m4v: 'video/mp4',
	mov: 'video/quicktime',
	qt: 'video/quicktime',
	webm: 'video/webm'
};
export const VIDEO_ACCEPT = [...VIDEO_CONTENT_TYPES, '.mp4', '.m4v', '.mov', '.webm'].join(',');
/** Bilder und Videos zusammen (Dateiauswahl) */
export const MEDIA_ACCEPT = `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`;
/**
 * Obergrenze je Video (ein Request, unter `BODY_SIZE_LIMIT` 110 MB); es gilt zusätzlich die
 * Speichergrenze `core.storage.maxFileSizeMb` (siehe `GET /limits`)
 */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
/** Höchste Laufzeit, die als `duration` angenommen wird (Sekunden) */
export const MAX_VIDEO_DURATION = 24 * 60 * 60;
export const MAX_IMAGES_PER_GALLERY = 2000;
export const MAX_EVENTS_PER_GALLERY = 20;
export const MAX_SHARES = 200;
export const MAX_BULK = 200;
export const MAX_TITLE = 200;
export const MAX_DESCRIPTION = 5000;
export const MAX_IMAGE_DESCRIPTION = 2000;
/** Gleichzeitige Uploads im Browser */
export const UPLOAD_CONCURRENCY = 3;

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max, `Höchstens ${max} Zeichen`)
		.nullish()
		.transform((v) => (v ? v : null));

/** Kalenderdatum `YYYY-MM-DD` (optional; leer → `null`) */
const optionalDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Format JJJJ-MM-TT')
	.refine((v) => {
		const d = new Date(`${v}T00:00:00Z`);
		return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
	}, 'Ungültiges Datum')
	.or(z.literal(''))
	.nullish()
	.transform((v) => (v ? v : null));

const refId = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[A-Za-z0-9*_-]+$/, 'Ungültige ID');

/** Termin-ID aus `events` (dort `text`, UUID) */
export const eventId = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[A-Za-z0-9_-]+$/, 'Ungültige Termin-ID');

export const shareInput = z
	.object({
		type: z.enum(PRINCIPAL_TYPES),
		id: refId,
		level: z.enum(SHARE_LEVELS)
	})
	.strict();
export type ShareInput = z.infer<typeof shareInput>;

const eventIdList = z
	.array(eventId)
	.max(MAX_EVENTS_PER_GALLERY, `Höchstens ${MAX_EVENTS_PER_GALLERY} Termine`)
	.transform((ids) => [...new Set(ids)]);

/** POST/PUT `/galleries[/:id]` – PUT ersetzt alles (auch Freigaben und Termine) */
export const galleryInput = z
	.object({
		title: z.string().trim().min(1, 'Pflichtfeld').max(MAX_TITLE, `Höchstens ${MAX_TITLE} Zeichen`),
		description: optionalText(MAX_DESCRIPTION),
		visibility: z.enum(VISIBILITIES).default('private'),
		shares: z.array(shareInput).max(MAX_SHARES).default([]),
		/** Termine aus `events`, denen die ganze Galerie zugeordnet ist */
		eventIds: eventIdList.default([]),
		/** Zeitraum (optional, für die Sortierung): Ende nur mit Start, nicht vor dem Start */
		startsOn: optionalDate,
		endsOn: optionalDate,
		/**
		 * Bestätigung „für alle erkennbaren Personen liegt eine Website-Einwilligung vor“ – Pflicht,
		 * wenn die Galerie dadurch öffentlich wird (Neuanlage öffentlich oder Wechsel privat → öffentlich)
		 */
		consentConfirmed: z.boolean().optional()
	})
	.strict()
	.superRefine((v, ctx) => {
		if (v.endsOn && !v.startsOn) {
			ctx.addIssue({
				code: 'custom',
				path: ['endsOn'],
				message: 'Für ein Enddatum wird ein Startdatum benötigt'
			});
		} else if (v.endsOn && v.startsOn && v.endsOn < v.startsOn) {
			ctx.addIssue({
				code: 'custom',
				path: ['endsOn'],
				message: 'Das Enddatum liegt vor dem Startdatum'
			});
		}
		const seen = new Set<string>();
		v.shares.forEach((s, i) => {
			const k = `${s.type}:${s.id}`;
			if (seen.has(k)) {
				ctx.addIssue({ code: 'custom', path: ['shares', i, 'id'], message: 'Doppelte Freigabe' });
			}
			seen.add(k);
			if (s.type === 'everyone' && s.id !== '*') {
				ctx.addIssue({ code: 'custom', path: ['shares', i, 'id'], message: 'Ungültige ID' });
			}
		});
	});
export type GalleryInput = z.infer<typeof galleryInput>;

/** PUT `/galleries/:id/cover` – `null` = Standard (zuerst hochgeladenes Bild) */
export const coverInput = z.object({ imageId: z.uuid('Ungültige ID').nullable() }).strict();

/**
 * Textfelder des Upload-Formulars (multipart; Datei im Feld `file`). Bei Videos zusätzlich Pflichtfeld
 * `poster` (Vorschaubild, JPEG/PNG/WebP) und optional `duration` (Laufzeit in Sekunden).
 */
export const uploadFields = z.object({
	description: optionalText(MAX_IMAGE_DESCRIPTION),
	duration: z.coerce
		.number()
		.min(0, 'Ungültige Laufzeit')
		.max(MAX_VIDEO_DURATION, 'Ungültige Laufzeit')
		.nullish()
		.transform((v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10))
});

/**
 * PUT `/galleries/:id/images/:imageId` – ersetzt die Beschreibung; `isPrivate` (optional, sonst
 * unverändert) = Bild nur intern, nie über die Website-API
 */
export const imageUpdateInput = z
	.object({
		description: optionalText(MAX_IMAGE_DESCRIPTION),
		isPrivate: z.boolean().optional()
	})
	.strict();
export type ImageUpdateInput = z.infer<typeof imageUpdateInput>;

/** `make-private` = nur intern (nie auf der Website), `make-public` = wieder mit der Galerie sichtbar */
export const BULK_ACTIONS = ['delete', 'make-private', 'make-public'] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

/** POST `/galleries/:id/images/bulk` */
export const imageBulkInput = z
	.object({
		action: z.enum(BULK_ACTIONS),
		ids: z
			.array(z.uuid('Ungültige ID'))
			.min(1)
			.max(MAX_BULK)
			.transform((ids) => [...new Set(ids)])
	})
	.strict();
export type ImageBulkInput = z.infer<typeof imageBulkInput>;

export const idParams = z.object({ id: z.uuid('Ungültige ID') });
export const imageParams = z.object({
	id: z.uuid('Ungültige ID'),
	imageId: z.uuid('Ungültige ID')
});
export const variantParams = imageParams.extend({ variant: z.enum(MEDIA_VARIANTS) });
export const websiteVariantParams = imageParams.extend({ variant: z.enum(WEBSITE_VARIANTS) });

export const listQuery = z.object({
	search: z.string().trim().max(100).optional(),
	visibility: z.enum(VISIBILITIES).optional(),
	eventId: eventId.optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
	offset: z.coerce.number().int().min(0).default(0)
});
export type ListQuery = z.infer<typeof listQuery>;

export const principalSearchQuery = z.object({
	search: z.string().trim().min(2, 'Mindestens 2 Zeichen').max(100)
});

export const eventSearchQuery = z.object({
	search: z.string().trim().max(100).optional(),
	limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const websiteListQuery = z.object({
	/** Nur Galerien zu diesem Termin (der Termin muss „auf der Website“ stehen) */
	eventId: eventId.optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
	offset: z.coerce.number().int().min(0).default(0)
});

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface GalleryAccess {
	level: ShareLevel;
	isOwner: boolean;
}

export interface GalleryShare {
	type: PrincipalType;
	id: string;
	name: string;
	detail: string | null;
	color: string | null;
	/** Profil- bzw. Gruppenbild oder `null` */
	image: string | null;
	level: ShareLevel;
}

/** Termin-Verweis (aus `events`, nur für den Aufrufer sichtbare Termine) */
export interface EventRef {
	id: string;
	title: string;
	startsOn: string;
	endsOn: string | null;
	color: string | null;
}

export interface ImageCover {
	imageId: string;
	width: number;
	height: number;
}

export interface GalleryItem {
	id: string;
	title: string;
	description: string | null;
	visibility: Visibility;
	/** Zeitraum der Galerie (`YYYY-MM-DD`), optional */
	startsOn: string | null;
	endsOn: string | null;
	imageCount: number;
	/** Effektives Titelbild (gesetzt oder ältestes Bild); `null` ohne Bilder */
	cover: ImageCover | null;
	/** Zugeordnete Termine, nur die für den Aufrufer sichtbaren */
	events: EventRef[];
	ownerId: string;
	access: GalleryAccess;
	createdAt: string;
	updatedAt: string;
}

export interface GalleryImage {
	id: string;
	description: string | null;
	width: number;
	height: number;
	sizeBytes: number;
	contentType: string;
	originalName: string;
	position: number;
	/** `video`: `contentType`/`sizeBytes` gehören zum Video, Maße zum Vorschaubild */
	mediaType: MediaType;
	/** Laufzeit in Sekunden (nur Videos, falls bekannt) */
	durationSeconds: number | null;
	/** Nur intern: nie über die Website-API, auch wenn die Galerie öffentlich ist */
	isPrivate: boolean;
	uploadedBy: string | null;
	createdAt: string;
}

export interface GalleryDetail extends GalleryItem {
	owner: { id: string; name: string; image: string | null } | null;
	/** Effektives Titelbild (wie `cover.imageId`) */
	coverImageId: string | null;
	/**
	 * Letzte Bestätigung der Einwilligungen beim Veröffentlichen (`by` = `null`, wenn das Konto nicht
	 * mehr existiert); bleibt nach dem Zurückstellen auf privat als Historie erhalten
	 */
	publicConfirmation: { at: string; by: { id: string; name: string } | null } | null;
	/** `true`, wenn kein Titelbild gesetzt ist (ältestes Bild gilt) */
	coverIsDefault: boolean;
	/** Nur bei Bearbeiten-Zugriff, sonst `[]` */
	shares: GalleryShare[];
	images: GalleryImage[];
}

export interface GalleryList {
	items: GalleryItem[];
	total: number;
}

export interface BulkResult {
	affected: number;
}

/** `GET /limits` – Grenzen für den Upload (Speicher-Einstellungen eingerechnet) */
export interface UploadLimits {
	maxImageBytes: number;
	maxVideoBytes: number;
	/** `false`, wenn der Dateispeicher Videotypen nicht zulässt (`core.storage.allowedContentTypes`) */
	videosAllowed: boolean;
}

// Website (nur öffentliche Felder: keine Freigaben, Eigentümer*innen, Dateinamen, Uploader)
export interface WebsiteEventRef {
	id: string;
	title: string;
	startsOn: string;
	endsOn: string | null;
}

export interface WebsiteGallery {
	id: string;
	title: string;
	description: string | null;
	/** Zeitraum der Galerie (`YYYY-MM-DD`), optional */
	startsOn: string | null;
	endsOn: string | null;
	imageCount: number;
	cover: ImageCover | null;
	/** Nur Termine mit „auf der Website“ */
	events: WebsiteEventRef[];
	updatedAt: string;
}

export interface WebsiteImage {
	id: string;
	galleryId: string;
	description: string | null;
	width: number;
	height: number;
	position: number;
	/** `video`: abspielen über die Variante `video`, `thumb`/`web` sind Vorschaubilder */
	mediaType: MediaType;
	durationSeconds: number | null;
}

export interface WebsiteGalleryDetail extends WebsiteGallery {
	images: WebsiteImage[];
}

/** Relativer Pfad der Bild- bzw. Videodatei für `apiFetch`/`<img src>` (intern) */
export function imageUrl(galleryId: string, imageId: string, variant: MediaVariant): string {
	return `/api/v1/modules/galleries/galleries/${galleryId}/images/${imageId}/${variant}`;
}

/** Videotyp einer Datei nach Browser-Angabe oder Endung; `null` = kein Video */
export function videoTypeOf(file: { type: string; name: string }): VideoContentTypeName | null {
	const type = file.type.toLowerCase();
	if ((VIDEO_CONTENT_TYPES as readonly string[]).includes(type))
		return type as VideoContentTypeName;
	if (type === 'video/x-m4v') return 'video/mp4';
	const ext = /\.([A-Za-z0-9]+)$/.exec(file.name)?.[1]?.toLowerCase();
	return ext ? (VIDEO_EXTENSIONS[ext] ?? null) : null;
}

/** Laufzeit als `m:ss` bzw. `h:mm:ss` */
export function formatDuration(seconds: number | null | undefined): string {
	if (seconds == null || !Number.isFinite(seconds)) return '';
	const total = Math.max(0, Math.round(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
