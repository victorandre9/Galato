/** Fotos de perfil dos colaboradores (pequenas, comprimidas no aparelho; sincronizam pelo banco). */
export interface UserPhoto { id: string; dataUrl: string; updatedAt: string }
export const PHOTOS: UserPhoto[] = [];
export const photoOf = (key: string) => PHOTOS.find((p) => p.id === key)?.dataUrl;

/** Recorta no centro em quadrado e reduz para 320 px (JPEG ~20–40 KB). */
export async function shrinkPhoto(file: File, size = 320): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const cv = document.createElement("canvas"); cv.width = cv.height = size;
    cv.getContext("2d")!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return cv.toDataURL("image/jpeg", 0.82);
  } finally { URL.revokeObjectURL(url); }
}
