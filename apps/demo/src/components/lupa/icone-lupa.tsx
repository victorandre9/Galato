import { useId } from "react";

/**
 * A lupa desenhada com as cores da marca.
 *
 * Cores da Galato: o aro é o amarelo do anel da logo e o cabo é o vermelho da letra —
 * vista ao lado do logo, parece peça do mesmo jogo. O volume vem das luzes:
 * um degradê que escurece para baixo no aro, um brilho no alto da lente de
 * vidro e a sombra que o aro deixa dentro dela.
 *
 * Os ids dos degradês saem de `useId`: dois desenhos na mesma página, com o
 * mesmo id, fariam o segundo pintar com o degradê do primeiro.
 */
export function IconeLupa({
  className,
  x,
  y,
  tamanho,
}: {
  className?: string;
  /** Posição e tamanho quando a lupa vai dentro de outro desenho (o robô). */
  x?: number;
  y?: number;
  tamanho?: number;
}) {
  const base = useId().replace(/:/g, "");
  const id = (nome: string) => `${base}-${nome}`;

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      x={x}
      y={y}
      width={tamanho}
      height={tamanho}
      aria-hidden
    >
      <defs>
        <linearGradient id={id("aro")} x1="0.15" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#FFF1C2" />
          <stop offset="0.35" stopColor="#FFC93C" />
          <stop offset="0.75" stopColor="#F5A800" />
          <stop offset="1" stopColor="#B87400" />
        </linearGradient>
        <linearGradient id={id("cabo")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF7A83" />
          <stop offset="0.45" stopColor="#E31B2C" />
          <stop offset="1" stopColor="#9E0A1B" />
        </linearGradient>
        <radialGradient id={id("vidro")} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="1" stopColor="#F3E7D2" stopOpacity="0.9" />
        </radialGradient>
        <filter id={id("sombra")} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2.2" stdDeviation="1.6" floodColor="#020617" floodOpacity="0.7" />
        </filter>
      </defs>

      <g filter={`url(#${id("sombra")})`}>
        {/* Cabo: atrás do aro, saindo em diagonal */}
        <path
          d="M 38.5 38.5 L 52.5 52.5"
          stroke={`url(#${id("cabo")})`}
          strokeWidth="9"
          strokeLinecap="round"
        />
        {/* O reflexo no alto do cabo, que o faz parecer cilíndrico */}
        <path
          d="M 41.5 39.8 L 51.2 49.5"
          stroke="#ffd0d4"
          strokeOpacity="0.55"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        {/* A peça que prende o cabo ao aro */}
        <path
          d="M 36.2 36.2 L 40.4 40.4"
          stroke="#7A0A14"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Lente de vidro */}
        <circle cx="26" cy="26" r="15.5" fill={`url(#${id("vidro")})`} />
        {/* Aro */}
        <circle
          cx="26"
          cy="26"
          r="16"
          fill="none"
          stroke={`url(#${id("aro")})`}
          strokeWidth="6"
        />
        {/* A borda interna, mais escura: é ela que dá profundidade ao aro */}
        <circle cx="26" cy="26" r="12.6" fill="none" stroke="#8A5A00" strokeOpacity="0.55" strokeWidth="1.2" />
        {/* Brilho do alto do aro */}
        <path
          d="M 13.8 19.5 A 14 14 0 0 1 26 11.4"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.85"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        {/* Reflexo na lente */}
        <path
          d="M 19 22.5 A 8 8 0 0 1 25 17.6"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.75"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="31.5" cy="31" r="1.3" fill="#ffffff" fillOpacity="0.35" />
      </g>
    </svg>
  );
}
