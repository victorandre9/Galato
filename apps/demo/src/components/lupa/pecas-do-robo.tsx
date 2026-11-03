import { IconeLupa } from "./icone-lupa";

/* Cores da Galato (logo: vermelho, amarelo e branco). */

/**
 * O microbot da lupa: um ícone de pesquisa que ganha vida por um instante.
 *
 * Um único SVG de 120 × 120, em que 1 unidade = 1 px. A cabeça é a própria
 * lupa (círculo de 52 px com centro em 60 × 30) e é o botão inteiro em
 * repouso; ela vem por último, na frente de tudo, e o resto sai de trás dela:
 * corpo em cápsula (42 × 29), dois suportes curtos com pé oval e dois braços
 * de uma peça só, com a mão. Tudo junto mede uns 88 px de altura.
 *
 * Os braços passam por uma máscara que esconde o que estiver sobre o corpo:
 * assim eles parecem sair de trás dele, e nunca aparecem soltos.
 *
 * A animação fica em globals.css (`.robo-*`). Os pontos de giro dela — ombros
 * em 40,5 / 79,5 × 58, punhos em 40,5 / 79,5 × 77 e o centro da cabeça em
 * 60 × 30 — são os deste desenho: mudou aqui, muda lá.
 */

const FUNDO = "#5A0610"; // vinho escuro (casca)
const CORPO = "#FFFFFF"; // branco da logo
const AZUL = "#F5A800"; // amarelo do anel da logo (contornos)
const DESTAQUE = "#FFD45C"; // amarelo claro
const VERMELHO = "#E31B2C"; // vermelho da letra

/** A cápsula do corpo: um pouco mais larga em cima, cantos de ~11 px. */
const CAPSULA =
  "M 50 50 H 70 Q 81 50 81 61 L 79.5 70 Q 78 79 68 79 H 52 Q 42 79 40.5 70 L 39 61 Q 39 50 50 50 Z";

export function LupaRobo() {
  return (
    <svg className="robo-svg" viewBox="0 0 120 120" width="120" height="120" aria-hidden>
      <defs>
        <radialGradient id="robo-cabeca-fundo" cx="0.34" cy="0.26" r="0.85">
          <stop offset="0" stopColor="#B3172A" />
          <stop offset="0.5" stopColor="#7E0A17" />
          <stop offset="1" stopColor={FUNDO} />
        </radialGradient>
        {/* O aro com as duas cores do logo; ele gira, e as cores correm em volta. */}
        <linearGradient id="robo-aro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE07A" />
          <stop offset="0.35" stopColor="#F5A800" />
          <stop offset="0.62" stopColor="#E31B2C" />
          <stop offset="1" stopColor="#FF6A72" />
        </linearGradient>
        <linearGradient id="robo-vidro" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="robo-corpo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F1E6D6" />
        </linearGradient>
        {/* Tudo menos o corpo: os braços só aparecem do lado de fora dele. */}
        <mask id="robo-fora-do-corpo" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <rect width="120" height="120" fill="#fff" />
          <path d={CAPSULA} fill="#000" />
        </mask>
      </defs>

      {/* Tudo o que sai de trás da lupa desliza junto. */}
      <g className="robo-montagem">
        <g id="legs" className="robo-pernas">
          {[51, 69].map((x) => (
            <g key={x}>
              <rect x={x - 3.5} y="76" width="7" height="12" rx="3" fill={CORPO} stroke={AZUL} strokeWidth="1.5" />
              <ellipse cx={x} cy="89" rx="6.5" ry="2.5" fill="#FFF4DC" stroke={AZUL} strokeWidth="1.5" />
            </g>
          ))}
        </g>

        <g id="body" className="robo-tronco">
          {/* Ombros: dois discos meio escondidos atrás do corpo. */}
          <circle cx="40.5" cy="58" r="3" fill={AZUL} />
          <circle cx="79.5" cy="58" r="3" fill={AZUL} />
          <path d={CAPSULA} fill="url(#robo-corpo)" stroke={AZUL} strokeOpacity="0.55" strokeWidth="1.5" />
          <path d="M 55 64 H 65" stroke={DESTAQUE} strokeWidth="2" strokeLinecap="round" className="robo-peito" />
          <circle cx="60" cy="71" r="1" fill={VERMELHO} />
        </g>

        <g mask="url(#robo-fora-do-corpo)">
          <g id="leftArm" className="robo-braco robo-braco--esquerdo">
            <Braco x={40.5} />
          </g>
          <g id="rightArm" className="robo-braco robo-braco--direito">
            <Braco x={79.5} acena />
          </g>
        </g>
      </g>

      {/* A lupa: é o botão em repouso, e fica na frente de tudo. */}
      <g id="head" className="robo-cabeca">
        <circle cx="60" cy="30" r="26" fill="url(#robo-cabeca-fundo)" />
        <g className="robo-aro">
          <circle cx="60" cy="30" r="25" fill="none" stroke="url(#robo-aro)" strokeWidth="2.4" />
        </g>
        <IconeLupa x={43} y={13} tamanho={34} />
        {/* O brilho de vidro no alto do orbe. */}
        <path d="M 44 18 Q 60 5 76 18 Q 60 13 44 18 Z" fill="url(#robo-vidro)" />
      </g>
    </svg>
  );
}

/**
 * Um braço: a cápsula (6 × 20) pendurada no ombro e a mão redonda no punho.
 * A mão do aceno tem três pontinhas de dedo.
 */
function Braco({ x, acena = false }: { x: number; acena?: boolean }) {
  return (
    <>
      <rect x={x - 3} y="57" width="6" height="21" rx="3" fill={CORPO} stroke={AZUL} strokeWidth="1.5" />
      <path d={`M ${x - 1.8} 74.5 H ${x + 1.8}`} stroke={DESTAQUE} strokeWidth="1.5" strokeLinecap="round" />
      <g className="robo-mao">
        <g className={acena ? "robo-aceno" : undefined}>
          {acena
            ? [-2.9, 0, 2.9].map((dx) => (
                <circle
                  key={dx}
                  cx={x + dx}
                  cy={dx === 0 ? 86.2 : 85.4}
                  r="1.5"
                  fill={CORPO}
                  stroke={AZUL}
                  strokeWidth="1.2"
                />
              ))
            : null}
          <circle cx={x} cy="81.5" r="4.5" fill="#FFF4DC" stroke={AZUL} strokeWidth="1.5" />
        </g>
      </g>
    </>
  );
}
