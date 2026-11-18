/**
 * Kleine, synthetische Videodateien für Tests (nur die Containerstruktur, kein echtes Bild):
 * MP4 bzw. MOV mit GPS/Gerät in `udta`/`meta` und WebM mit `Tags`. `MDAT_PAYLOAD` steht unverändert im
 * Medienteil, damit sich prüfen lässt, dass das Video selbst nicht angetastet wird.
 */
export const GPS_TEXT = '+53.0793+008.8017/';
export const DEVICE_TEXT = 'GeheimPhone 15';
export const MDAT_PAYLOAD = 'FRAMEDATA-unverändert';

const enc = (s: string) => new TextEncoder().encode(s);

function concat(...parts: Uint8Array[]): Uint8Array {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let o = 0;
	for (const p of parts) {
		out.set(p, o);
		o += p.length;
	}
	return out;
}

/** ISO-BMFF-Box mit 32-Bit-Größe */
export function box(type: string, ...children: Uint8Array[]): Uint8Array {
	const body = concat(...children);
	const head = new Uint8Array(8);
	new DataView(head.buffer).setUint32(0, 8 + body.length);
	// Typ als 4 Byte latin1 (`©xyz` → 0xA9 'x' 'y' 'z')
	head.set(
		Uint8Array.from(type, (c) => c.charCodeAt(0)),
		4
	);
	return concat(head, body);
}

/** MP4 (Marke `isom`) bzw. MOV (`qt  `) mit Metadaten auf Film- und Spurebene */
export function sampleMp4(brand: 'isom' | 'qt  ' = 'isom'): Uint8Array {
	return concat(
		box('ftyp', enc(brand), new Uint8Array(4), enc(brand)),
		box(
			'moov',
			box('mvhd', new Uint8Array(100)),
			box(
				'trak',
				box('tkhd', new Uint8Array(84)),
				box('mdia', box('mdhd', new Uint8Array(24)), box('udta', box('name', enc(DEVICE_TEXT))))
			),
			box('udta', box('©xyz', enc(GPS_TEXT))),
			box(
				'meta',
				new Uint8Array(4),
				box('keys', enc('com.apple.quicktime.location.ISO6709')),
				box('ilst', enc(GPS_TEXT), enc(DEVICE_TEXT))
			)
		),
		box('mdat', enc(MDAT_PAYLOAD))
	);
}

// --- WebM ------------------------------------------------------------------

function vint(n: number): Uint8Array {
	// 8-Byte-vint (einfach, für Tests ausreichend)
	const out = new Uint8Array(8);
	out[0] = 0x01;
	let v = n;
	for (let i = 7; i >= 1; i--) {
		out[i] = v & 0xff;
		v = Math.floor(v / 256);
	}
	return out;
}

function el(id: number[], ...children: Uint8Array[]): Uint8Array {
	const body = concat(...children);
	return concat(new Uint8Array(id), vint(body.length), body);
}

/** WebM mit EBML-Kopf (DocType webm), Info, Tags (GPS/Gerät) und Cluster */
export function sampleWebm(): Uint8Array {
	// DocType (0x4282) „webm“; Größen als 1-Byte-vint (0x80 | Länge)
	const docType = concat(new Uint8Array([0x42, 0x82, 0x84]), enc('webm'));
	const header = concat(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x80 | docType.length]), docType);
	const segment = el(
		[0x18, 0x53, 0x80, 0x67],
		el([0x15, 0x49, 0xa9, 0x66], enc('info')),
		el([0x12, 0x54, 0xc3, 0x67], enc(`${GPS_TEXT} ${DEVICE_TEXT}`)),
		el([0x1f, 0x43, 0xb6, 0x75], enc(MDAT_PAYLOAD))
	);
	return concat(header, segment);
}

/** Text in Bytes (latin1-Vergleich reicht für ASCII) */
export function contains(bytes: Uint8Array, text: string): boolean {
	return Buffer.from(bytes).includes(Buffer.from(text, 'utf8'));
}
