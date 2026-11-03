/** Foto do colaborador: quadrado com cantos arredondados (como os cards). Toque para trocar. */
import { useRef } from "react";
import { Camera } from "lucide-react";
import { commit, toast, useStore } from "../data/store";
import { viewerId } from "../data/notify";
import { PHOTOS, photoOf, shrinkPhoto } from "../data/photos";
import { nowStamp } from "../data/mock";

export function currentUserKey(role: ReturnType<typeof useStore>["role"]) { return role ? viewerId(role) : "anon"; }

export function UserPhoto({ name, size = 46, editable, userKey }: { name: string; size?: number; editable?: boolean; userKey?: string }) {
  const s = useStore();
  const key = userKey ?? currentUserKey(s.role);
  const src = photoOf(key);
  const input = useRef<HTMLInputElement>(null);
  const initials = name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const pick = async (f: File) => {
    try {
      const dataUrl = await shrinkPhoto(f);
      commit(() => {
        const i = PHOTOS.findIndex((p) => p.id === key);
        const rec = { id: key, dataUrl, updatedAt: nowStamp() };
        if (i >= 0) PHOTOS[i] = rec; else PHOTOS.unshift(rec);
      }, "Foto atualizada");
    } catch { toast("Não foi possível ler a imagem", "danger"); }
  };
  return (
    <span className={`user-photo ${editable ? "editable" : ""}`} style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), fontSize: Math.round(size * 0.36) }}
      onClick={editable ? (e) => { e.stopPropagation(); input.current?.click(); } : undefined} role={editable ? "button" : undefined} aria-label={editable ? "Trocar foto" : undefined} data-instant={editable ? "" : undefined}>
      {src ? <img src={src} alt={name} /> : <span className="up-initials">{initials}</span>}
      {editable && <span className="up-cam"><Camera size={Math.max(12, Math.round(size * 0.22))} /></span>}
      {editable && <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />}
    </span>
  );
}
