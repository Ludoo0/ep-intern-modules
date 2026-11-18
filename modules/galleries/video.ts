/**
 * Videos im Modul `galleries`: Formaterkennung per Magic Bytes und Entfernen von Metadaten (Ort, Gerät,
 * Software) ohne Neukodierung. Rein (keine Server-Imports), damit es sich als Unit testen lässt.
 *
 * - MP4/M4V/MOV (ISO-BMFF/QuickTime): `udta`- und `meta`-Boxen (oberste Ebene, in `moov`, `trak`,
 *   `mdia`, `minf`) sowie XMP-`uuid`-Boxen werden zu `free`-Boxen gleicher Länge mit Nullen. Dort stehen
 *   GPS (`©xyz`, `com.apple.quicktime.location.ISO6709`), Gerät, Software und Aufnahmezeit-Texte. Die
 *   Länge bleibt gleich, Chunk-Offsets (`stco`/`co64`) stimmen weiter – der Film spielt unverändert.
 * - WebM (Matroska): `Tags`-Elemente direkt im `Segment` werden zu `Void`-Elementen gleicher Länge.
 * Das Videobild selbst (Ton, Spuren, Drehung in `tkhd`) bleibt unverändert.
 */

export type VideoContentType = 'video/mp4' | 'video/quicktime' | 'video/webm';

const ascii = (bytes: Uint8Array, start: number, len: number): string =>
	String.fromCharCode(...bytes.subarray(start, start + len));

/** QuickTime-Atome, mit denen ältere `.mov` ohne `ftyp` beginnen */
const QT_FIRST_ATOMS = new Set(['moov', 'mdat', 'wide', 'free', 'skip', 'pnot']);

/**
 * Typ aus dem Inhalt: `ftyp` mit Video-Marke (nicht AVIF/HEIC), QuickTime ohne `ftyp`, EBML mit
 * DocType `webm`. `null` = kein unterstütztes Video (auch Matroska `.mkv`).
 */
export function sniffVideoType(bytes: Uint8Array): VideoContentType | null {
	if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
		const brand = ascii(bytes, 8, 4);
		if (/^(avi[fs]|hei[cxsm]|hev[cx]|mif1|msf1|jp2 )/.test(brand)) return null;
		return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
	}
	if (bytes.length >= 8 && QT_FIRST_ATOMS.has(ascii(bytes, 4, 4))) {
		// Erstes Atom muss eine plausible Größe haben
		const size = readU32(bytes, 0);
		if (size >= 8 || size === 1) return 'video/quicktime';
		return null;
	}
	if (
		bytes.length >= 4 &&
		bytes[0] === 0x1a &&
		bytes[1] === 0x45 &&
		bytes[2] === 0xdf &&
		bytes[3] === 0xa3
	) {
		// DocType (ID 0x4282) im EBML-Kopf suchen
		const head = ascii(bytes, 0, Math.min(bytes.length, 64));
		return /\x42\x82.webm/s.test(head) ? 'video/webm' : null;
	}
	return null;
}

function readU32(b: Uint8Array, o: number): number {
	return ((b[o]! << 24) >>> 0) + (b[o + 1]! << 16) + (b[o + 2]! << 8) + b[o + 3]!;
}

/** Container, in die beim Entfernen hineingeschaut wird */
const BMFF_CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf']);
/** Metadaten-Boxen, die zu `free` werden */
const BMFF_METADATA = new Set(['udta', 'meta']);
/** XMP in einer `uuid`-Box (BE7ACFCB-97A9-42E8-9C71-999491E3AFAC) */
const XMP_UUID = [
	0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac
];

function voidBox(b: Uint8Array, start: number, headerLen: number, end: number): void {
	b.set([0x66, 0x72, 0x65, 0x65], start + 4); // 'free'
	b.fill(0, start + headerLen, end);
}

/** Boxen in `[start, end)` durchgehen; liefert die Anzahl ersetzter Boxen */
function stripBmff(b: Uint8Array, start: number, end: number, depth: number): number {
	let removed = 0;
	let pos = start;
	while (pos + 8 <= end) {
		let size = readU32(b, pos);
		const type = ascii(b, pos + 4, 4);
		let header = 8;
		if (size === 1) {
			if (pos + 16 > end) break;
			const hi = readU32(b, pos + 8);
			const lo = readU32(b, pos + 12);
			size = hi * 2 ** 32 + lo;
			header = 16;
		} else if (size === 0) {
			size = end - pos;
		}
		if (size < header || pos + size > end) break; // kaputt/abgeschnitten: Rest unverändert lassen
		const boxEnd = pos + size;
		if (BMFF_METADATA.has(type)) {
			voidBox(b, pos, header, boxEnd);
			removed++;
		} else if (
			type === 'uuid' &&
			depth === 0 &&
			size >= header + 16 &&
			XMP_UUID.every((v, i) => b[pos + header + i] === v)
		) {
			voidBox(b, pos, header, boxEnd);
			removed++;
		} else if (BMFF_CONTAINERS.has(type) && depth < 6) {
			removed += stripBmff(b, pos + header, boxEnd, depth + 1);
		}
		pos = boxEnd;
	}
	return removed;
}

// --- Matroska/WebM ---------------------------------------------------------

/** EBML-Element-ID (mit Längenmarke) an `o` → Länge in Byte, 0 = ungültig */
function ebmlIdLength(first: number): number {
	if (first & 0x80) return 1;
	if (first & 0x40) return 2;
	if (first & 0x20) return 3;
	if (first & 0x10) return 4;
	return 0;
}

/** EBML-Größe (vint) an `o` → { len, value }; `value = -1` = unbekannte Größe */
function readVint(b: Uint8Array, o: number): { len: number; value: number } | null {
	const first = b[o];
	if (first === undefined || first === 0) return null;
	let len = 1;
	while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
	if (len > 8 || o + len > b.length) return null;
	let value = first & (0xff >> len);
	let allOnes = value === 0xff >> len;
	for (let i = 1; i < len; i++) {
		value = value * 256 + b[o + i]!;
		if (b[o + i] !== 0xff) allOnes = false;
	}
	return { len, value: allOnes ? -1 : value };
}

const MKV_SEGMENT = 0x18538067;
const MKV_TAGS = 0x1254c367;

function readId(b: Uint8Array, o: number, len: number): number {
	let id = 0;
	for (let i = 0; i < len; i++) id = id * 256 + b[o + i]!;
	return id;
}

/** Element ab `start` (Gesamtlänge `total` ≥ 9) durch ein Void-Element (0xEC) gleicher Länge ersetzen */
function voidEbml(b: Uint8Array, start: number, total: number): void {
	b[start] = 0xec;
	// 8-Byte-vint: 0x01 + 7 Byte Länge des Inhalts
	let rest = total - 1 - 8;
	b[start + 1] = 0x01;
	for (let i = 8; i >= 2; i--) {
		b[start + i] = rest & 0xff;
		rest = Math.floor(rest / 256);
	}
	b.fill(0, start + 9, start + total);
}

function stripWebm(b: Uint8Array): number {
	let pos = 0;
	let removed = 0;
	// Oberste Ebene: EBML-Kopf, dann Segment
	while (pos < b.length) {
		const idLen = ebmlIdLength(b[pos] ?? 0);
		if (!idLen) break;
		const id = readId(b, pos, idLen);
		const size = readVint(b, pos + idLen);
		if (!size) break;
		const dataStart = pos + idLen + size.len;
		const dataEnd = size.value < 0 ? b.length : Math.min(b.length, dataStart + size.value);
		if (id === MKV_SEGMENT) {
			let p = dataStart;
			while (p < dataEnd) {
				const cl = ebmlIdLength(b[p] ?? 0);
				if (!cl) break;
				const cid = readId(b, p, cl);
				const cs = readVint(b, p + cl);
				// Unbekannte Größe (z. B. Cluster aus MediaRecorder): nicht weiter durchsuchbar
				if (!cs || cs.value < 0) break;
				const total = cl + cs.len + cs.value;
				if (p + total > dataEnd) break;
				if (cid === MKV_TAGS && total >= 9) {
					voidEbml(b, p, total);
					removed++;
				}
				p += total;
			}
			break;
		}
		if (size.value < 0) break;
		pos = dataEnd;
	}
	return removed;
}

/**
 * Metadaten aus einem Video entfernen. Liefert eine **Kopie** gleicher Länge (das Original bleibt
 * unverändert) und die Anzahl ersetzter Metadaten-Blöcke.
 */
export function stripVideoMetadata(
	bytes: Uint8Array,
	type: VideoContentType
): { bytes: Uint8Array; removed: number } {
	const copy = new Uint8Array(bytes);
	const removed = type === 'video/webm' ? stripWebm(copy) : stripBmff(copy, 0, copy.length, 0);
	return { bytes: copy, removed };
}
