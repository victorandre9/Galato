/** Captura de foto: no celular abre a câmera; no computador, escolhe imagem. Comprime para envio leve. */
import { useRef } from "react";
import { Camera, RefreshCw } from "lucide-react";

export async function compressImage(file: File, maxSide = 720, quality = 0.62): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality);
  } finally { URL.revokeObjectURL(url); }
}

export function PhotoCapture({ value, onChange, label }: { value: string | null; onChange: (dataUrl: string) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input ref={ref} id="photo-capture" type="file" accept="image/*" capture="environment" hidden
        onChange={async (e) => { const f = e.target.files?.[0]; if (f) onChange(await compressImage(f)); e.target.value = ""; }} />
      {value ? (
        <div className="photo-preview">
          <img src={value} alt="Comprovante" />
          <button className="btn btn-ghost btn-sm" data-instant onClick={() => ref.current?.click()}><RefreshCw size={14} /> Tirar outra</button>
        </div>
      ) : (
        <button className="upload photo-btn" data-instant onClick={() => ref.current?.click()}>
          <span className="photo-ic"><Camera size={30} /></span>
          <b>{label}</b>
          <span className="xs muted">No celular abre a câmera · no computador escolha uma imagem</span>
        </button>
      )}
    </div>
  );
}
