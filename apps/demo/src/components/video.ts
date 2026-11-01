import { nowStamp } from "../data/mock";
import { isServerDb } from "../data/sync";
/**
 * Vídeo do freezer no checkout.
 * - Reduz o vídeo no próprio aparelho (480p, ~700 kbps, sem áudio, até 15 s) → ~1 MB por 10 s.
 * - Guarda no aparelho (IndexedDB) e, com o banco do site ligado, envia para o banco
 *   (a gestão assiste de outro aparelho). Se a internet falhar, reenvia depois.
 */

/** "agora" na mesma referência dos registros (dia de demonstração + hora real). */
const demoNow = () => Date.parse(nowStamp());

/** retentionDays: vídeo é apagado 60 dias após o checkout (a visita permanece no histórico). */
export const VIDEO_LIMITS = { maxSeconds: 15, maxSide: 640, bitrate: 700_000, fps: 24, maxBytes: 1024 * 1024, retentionDays: 60 };

/** Dias que faltam para o vídeo ser apagado (negativo = já venceu). */
export function daysUntilPurge(savedAt: string, now = demoNow()) {
  return Math.ceil((new Date(savedAt).getTime() + VIDEO_LIMITS.retentionDays * 86_400_000 - now) / 86_400_000);
}

/** Taxa de bits que cabe no limite de 1 MB para a duração (com folga de 12%). */
const bitrateFor = (seconds: number) => Math.min(VIDEO_LIMITS.bitrate, Math.floor((VIDEO_LIMITS.maxBytes * 8 * 0.88) / Math.max(1, seconds)));

/** Reduz até caber em 1 MB (refaz com qualidade menor se precisar). */
export async function compressToLimit(file: File, onProgress?: (p: number) => void): Promise<CompressedVideo> {
  const probe = document.createElement("video");
  const url = URL.createObjectURL(file); probe.src = url; probe.preload = "metadata";
  const secs = await new Promise<number>((res) => { probe.onloadedmetadata = () => res(isFinite(probe.duration) ? probe.duration : 10); probe.onerror = () => res(10); });
  URL.revokeObjectURL(url);
  const seconds = Math.min(secs, VIDEO_LIMITS.maxSeconds);
  let out = await compressVideo(file, (p) => onProgress?.(p * 0.9), bitrateFor(seconds));
  if (out.bytes > VIDEO_LIMITS.maxBytes) out = await compressVideo(file, (p) => onProgress?.(0.9 + p * 0.1), Math.floor(bitrateFor(seconds) * 0.6));
  if (out.bytes > VIDEO_LIMITS.maxBytes) throw new Error("O vídeo ficou maior que 1 MB. Grave um vídeo mais curto (até 10 segundos).");
  return out;
}

export interface CompressedVideo { blob: Blob; mime: string; bytes: number; seconds: number; originalBytes: number; width: number; height: number }

function pickMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"])
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  return null;
}

/** Reduz o vídeo. `onProgress` recebe 0..1. */
export async function compressVideo(file: File, onProgress?: (p: number) => void, bitrate = VIDEO_LIMITS.bitrate): Promise<CompressedVideo> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url; video.muted = true; video.playsInline = true; video.preload = "auto";
  try {
    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = () => rej(new Error("Não foi possível ler este vídeo."));
    });
    const duration = Math.min(isFinite(video.duration) ? video.duration : VIDEO_LIMITS.maxSeconds, VIDEO_LIMITS.maxSeconds);
    const scale = Math.min(1, VIDEO_LIMITS.maxSide / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.max(2, Math.round((video.videoWidth * scale) / 2) * 2);
    const h = Math.max(2, Math.round((video.videoHeight * scale) / 2) * 2);
    const mime = pickMime();
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    if (!mime || !("captureStream" in canvas)) {
      // aparelho sem gravação de vídeo no navegador: aceita o original se já for pequeno
      if (file.size <= VIDEO_LIMITS.maxBytes) return { blob: file, mime: file.type || "video/mp4", bytes: file.size, seconds: duration, originalBytes: file.size, width: video.videoWidth, height: video.videoHeight };
      throw new Error("Este aparelho não consegue reduzir o vídeo. Grave um vídeo mais curto (até 10 segundos).");
    }
    const stream = (canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(VIDEO_LIMITS.fps);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>((res) => { rec.onstop = () => res(); });

    video.currentTime = 0;
    await new Promise((r) => setTimeout(r, 50));
    rec.start(250);
    await video.play();
    await new Promise<void>((res) => {
      const draw = () => {
        ctx.drawImage(video, 0, 0, w, h);
        onProgress?.(Math.min(1, video.currentTime / duration));
        if (video.ended || video.currentTime >= duration) { res(); return; }
        requestAnimationFrame(draw);
      };
      video.onended = () => res();
      draw();
    });
    video.pause();
    rec.stop();
    await done;
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: mime.split(";")[0] });
    onProgress?.(1);
    return { blob, mime: blob.type, bytes: blob.size, seconds: duration, originalBytes: file.size, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------- armazenamento no aparelho (IndexedDB)
const DB = "galato-videos", STORE = "videos";
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function saveVideo(key: string, blob: Blob) {
  const db = await open();
  await new Promise<void>((res, rej) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(blob, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}
async function loadLocalVideo(key: string): Promise<Blob | null> {
  try {
    const db = await open();
    return await new Promise((res) => { const r = db.transaction(STORE).objectStore(STORE).get(key); r.onsuccess = () => res((r.result as Blob) ?? null); r.onerror = () => res(null); });
  } catch { return null; }
}
/** Neste aparelho primeiro; senão, do banco do site. */
export async function loadVideo(key: string): Promise<Blob | null> {
  const local = await loadLocalVideo(key);
  if (local) return local;
  if (!isServerDb()) return null;
  try {
    const r = await fetch(`/api/data?r=video&key=${encodeURIComponent(key)}`);
    return r.ok ? await r.blob() : null;
  } catch { return null; }
}

export async function deleteVideo(key: string) {
  try {
    const db = await open();
    await new Promise<void>((res) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(key); tx.oncomplete = () => res(); tx.onerror = () => res(); });
  } catch { /* ok */ }
  setPending(getPending().filter((k) => k !== key));
  if (isServerDb()) { try { await fetch(`/api/data?r=video&key=${encodeURIComponent(key)}`, { method: "DELETE" }); } catch { /* ok */ } }
}

// ---------------------------------------------------------------- envio para o banco do site
const PENDING = "galato-video-pending";
function getPending(): string[] { try { return JSON.parse(localStorage.getItem(PENDING) ?? "[]"); } catch { return []; } }
function setPending(keys: string[]) { try { localStorage.setItem(PENDING, JSON.stringify([...new Set(keys)])); } catch { /* ok */ } }

function toBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1] ?? "");
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}

/** Envia o vídeo para o banco. true = enviado (ou sem banco, nada a fazer). */
export async function uploadVideo(key: string, blob?: Blob | null): Promise<boolean> {
  if (!isServerDb()) return true;
  const b = blob ?? (await loadLocalVideo(key));
  if (!b) { setPending(getPending().filter((k) => k !== key)); return true; }
  try {
    const r = await fetch("/api/data?r=video", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, mime: b.type || "video/mp4", data: await toBase64(b) }) });
    if (!r.ok) throw new Error(String(r.status));
    setPending(getPending().filter((k) => k !== key));
    return true;
  } catch {
    setPending([...getPending(), key]);
    return false;
  }
}

/** Reenvia vídeos que não subiram (sem internet na hora do checkout). */
export async function retryPendingUploads() {
  if (!isServerDb() || !navigator.onLine) return;
  for (const k of getPending()) await uploadVideo(k);
}

export const fmtBytes = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
