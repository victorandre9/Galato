/** Checkout da visita com vídeo obrigatório do freezer (reduzido no aparelho até 1 MB). */
import { useEffect, useRef, useState } from "react";
import { Video, LogOut, RefreshCw, CheckCircle2, AlertTriangle, Snowflake } from "lucide-react";
import { nowStamp, type Checkin, type Customer } from "../data/mock";
import { commit } from "../data/store";
import { Card, Sheet, Progress } from "./ui";
import { compressToLimit, saveVideo, loadVideo, fmtBytes, daysUntilPurge, VIDEO_LIMITS, type CompressedVideo } from "./video";

export function CheckoutSheet({ c, checkin, onClose }: { c: Customer; checkin: Checkin; onClose: () => void }) {
  const required = c.assets.length > 0;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [video, setVideo] = useState<CompressedVideo | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const minutes = Math.max(1, Math.round((Date.parse(nowStamp()) - new Date(checkin.inAt).getTime()) / 60000));

  async function onFile(f: File) {
    setError(null); setVideo(null); setBusy(0);
    try {
      const out = await compressToLimit(f, (p) => setBusy(p));
      setVideo(out); setUrl(URL.createObjectURL(out.blob));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  async function finish() {
    setSaving(true);
    const key = `ck-${checkin.id}`;
    try { if (video) await saveVideo(key, video.blob); } catch { /* sem armazenamento: segue só com os dados */ }
    commit(() => {
      checkin.outAt = nowStamp();
      if (video) checkin.video = { key, bytes: video.bytes, originalBytes: video.originalBytes, seconds: Math.round(video.seconds), mime: video.mime, savedAt: checkin.outAt };
    }, `Checkout registrado · visita de ${minutes} min${video ? ` · vídeo ${fmtBytes(video.bytes)}` : ""}`);
    onClose();
  }

  return (
    <Sheet title="Checkout da visita" onClose={onClose} icon={<LogOut size={18} />}>
      <div className="small t2 mb">{c.tradeName} · visita em andamento há {minutes} min</div>
      {required ? (
        <>
          <div className="card mb" style={{ background: "var(--gold-soft)" }}>
            <div className="semi flex" style={{ gap: 8 }}><Snowflake size={16} /> Vídeo do freezer obrigatório</div>
            <div className="small t2">Grave um vídeo curto (até 10 segundos) mostrando {c.assets.length > 1 ? `os ${c.assets.length} freezers` : "o freezer"} por dentro e por fora. O app reduz para no máximo 1 MB.</div>
          </div>
          <input ref={input} id="checkout-video" type="file" accept="video/*" capture="environment" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          {busy !== null ? (
            <Card>
              <div className="semi mb">{busy >= 0.9 ? "Finalizando o vídeo…" : `Reduzindo o vídeo… ${Math.round(busy * 100)}%`}</div>
              <Progress value={busy * 100} />
              <div className="xs muted mt">Fica pronto em poucos segundos. Não feche esta tela.</div>
            </Card>
          ) : video && url ? (
            <div className="stack">
              <video className="checkout-video" src={url} controls playsInline muted />
              <div className="flex between wrap small" style={{ gap: 6 }}>
                <span className="green semi flex" style={{ gap: 6 }}><CheckCircle2 size={16} /> Vídeo pronto</span>
                <span className="num">{fmtBytes(video.originalBytes)} → <b>{fmtBytes(video.bytes)}</b> · {Math.round(video.seconds)} s · {video.height}p</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => input.current?.click()}><RefreshCw size={14} /> Gravar outro</button>
            </div>
          ) : (
            <button className="upload photo-btn" onClick={() => input.current?.click()}>
              <span className="photo-ic"><Video size={30} /></span>
              <b>Gravar vídeo do freezer</b>
              <span className="xs muted">Até {VIDEO_LIMITS.maxSeconds} s · reduzido para no máximo 1 MB</span>
            </button>
          )}
          {error && <div className="small red semi mt flex" style={{ gap: 6 }}><AlertTriangle size={15} /> {error}</div>}
        </>
      ) : (
        <div className="small muted mb">Cliente sem freezer Galato cadastrado: vídeo não é necessário.</div>
      )}
      <button className="btn btn-primary btn-lg mt" disabled={(required && !video) || busy !== null || saving} onClick={finish}>
        {required && !video ? "Grave o vídeo para finalizar" : "Finalizar checkout"}
      </button>
    </Sheet>
  );
}

/** Reproduz o vídeo do checkout (se estiver neste aparelho). */
export function CheckinVideo({ checkin, onClose, title }: { checkin: Checkin; onClose: () => void; title: string }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const v = checkin.video!;
  useEffect(() => {
    if (v.purgedAt) { setUrl(null); return; }
    let u: string | null = null;
    loadVideo(v.key).then((b) => { u = b ? URL.createObjectURL(b) : null; setUrl(u); });
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [v.key, v.purgedAt]);
  const left = v.savedAt ? daysUntilPurge(v.savedAt) : null;
  return (
    <Sheet title={title} onClose={onClose} icon={<Video size={18} />}>
      {v.purgedAt ? (
        <div className="small" style={{ padding: 12, borderRadius: 12, background: "var(--neutral-soft)" }}>
          Vídeo apagado automaticamente em {new Date(v.purgedAt).toLocaleDateString("pt-BR")} ({VIDEO_LIMITS.retentionDays} dias após o checkout). A visita continua no histórico.
        </div>
      ) : url === undefined ? <div className="small muted">Carregando…</div>
        : url ? <video className="checkout-video" src={url} controls autoPlay playsInline muted />
        : <div className="small muted">O vídeo está guardado no aparelho do vendedor. Com o banco de dados ligado, ele aparece aqui para a gestão.</div>}
      <div className="xs muted mt">{fmtBytes(v.bytes)} · {v.seconds} s{left !== null && !v.purgedAt ? ` · apaga em ${Math.max(0, left)} dia(s)` : ""}</div>
    </Sheet>
  );
}
