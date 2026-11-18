/**
 * Vorschaubild und Laufzeit eines Videos im Browser ermitteln (der Server kodiert Videos nicht).
 * Kann der Browser das Video nicht dekodieren (z. B. HEVC-MOV außerhalb von Safari), entsteht ein
 * neutrales Platzhalterbild – der Upload klappt trotzdem.
 */

/** Lange Kante des Vorschaubilds (der Server erzeugt daraus `thumb`/`web`) */
const POSTER_MAX_EDGE = 2048;
const TIMEOUT_MS = 15_000;

export interface VideoPoster {
	blob: Blob;
	/** Laufzeit in Sekunden oder `null` */
	duration: number | null;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(b) => (b ? resolve(b) : reject(new Error('Vorschaubild fehlgeschlagen'))),
			'image/jpeg',
			0.85
		)
	);
}

/** Platzhalter 16:9 mit Abspielsymbol */
async function placeholder(): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = 1280;
	canvas.height = 720;
	const g = canvas.getContext('2d');
	if (!g) throw new Error('Canvas nicht verfügbar');
	g.fillStyle = '#27272a';
	g.fillRect(0, 0, canvas.width, canvas.height);
	g.fillStyle = '#a1a1aa';
	g.beginPath();
	g.arc(640, 360, 110, 0, Math.PI * 2);
	g.fill();
	g.fillStyle = '#27272a';
	g.beginPath();
	g.moveTo(605, 295);
	g.lineTo(605, 425);
	g.lineTo(715, 360);
	g.closePath();
	g.fill();
	return toBlob(canvas);
}

/** Einzelbild nach kurzer Zeit (erstes Bild ist oft schwarz) als JPEG, dazu die Laufzeit */
export async function videoPoster(file: File): Promise<VideoPoster> {
	const url = URL.createObjectURL(file);
	const video = document.createElement('video');
	video.muted = true;
	video.playsInline = true;
	video.preload = 'auto';
	let duration: number | null = null;
	try {
		const frame = await new Promise<Blob>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('Zeitüberschreitung')), TIMEOUT_MS);
			const done = (fn: () => void) => {
				clearTimeout(timer);
				fn();
			};
			video.onerror = () => done(() => reject(new Error('Video nicht lesbar')));
			video.onloadedmetadata = () => {
				if (Number.isFinite(video.duration) && video.duration > 0) duration = video.duration;
				const target = duration ? Math.min(1, duration / 10) : 0;
				// Ohne Sprung feuert `seeked` nicht – dann reicht das erste geladene Bild
				if (target > 0) video.currentTime = target;
				else video.onloadeddata = () => video.onseeked?.(new Event('seeked'));
			};
			video.onseeked = () => {
				const w = video.videoWidth;
				const h = video.videoHeight;
				if (!w || !h) return done(() => reject(new Error('Keine Bildgröße')));
				const scale = Math.min(1, POSTER_MAX_EDGE / Math.max(w, h));
				const canvas = document.createElement('canvas');
				canvas.width = Math.round(w * scale);
				canvas.height = Math.round(h * scale);
				const g = canvas.getContext('2d');
				if (!g) return done(() => reject(new Error('Canvas nicht verfügbar')));
				g.drawImage(video, 0, 0, canvas.width, canvas.height);
				toBlob(canvas).then(
					(b) => done(() => resolve(b)),
					(e: unknown) => done(() => reject(e))
				);
			};
			video.src = url;
		});
		return { blob: frame, duration };
	} catch {
		return { blob: await placeholder(), duration };
	} finally {
		video.removeAttribute('src');
		video.load();
		URL.revokeObjectURL(url);
	}
}
