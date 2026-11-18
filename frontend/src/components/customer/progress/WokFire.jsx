import Steam from './Steam';

const FLAME = 'M0 0C-9 0-11-8-8-15C-6-20-2-24 0-34C2-26 9-20 10-13C11-5 7 0 0 0Z';
const CORE = 'M0 0C-5 0-6-5-4-9C-3-12-1-14 0-20C1-15 5-12 5-8C6-3 4 0 0 0Z';
const FLAMES = [
  [62, -24, 1.05, 0, 1],
  [74, -13, 0.95, 0.4, 0.8],
  [87, -5, 0.8, 0.7, 1.2],
  [100, 0, 0.85, 0.2, 0.9],
  [113, 5, 0.8, 0.55, 1.1],
  [126, 13, 0.95, 0.85, 0.85],
  [138, 24, 1.05, 0.3, 1.05],
];
const MIDDLE = 3;
const SPARKS = [
  [56, 104, -6, 0],
  [146, 102, 6, 0.35],
  [68, 112, -3, 0.6],
  [134, 112, 4, 0.8],
];
const PUFFS = [
  [84, 66, 0],
  [100, 62, 0.33],
  [116, 66, 0.66],
];
const PIVOT = { '--pivot-x': 156, '--pivot-y': 84 };
const DROP_AFTER_IGNITE = 4;

function Noodle() {
  return <path className="illo-line-noodle" strokeWidth="3.5" d="M-8 0C-4-5 0 4 4-1S8 2 8 2" />;
}

function Leaf() {
  return (
    <>
      <ellipse className="illo-leaf" rx="7" ry="3.5" transform="rotate(-20)" />
      <path className="illo-line-scallion" strokeWidth="1.2" d="M-5 2L5-2" />
    </>
  );
}

function Carrot() {
  return (
    <>
      <circle className="illo-carrot" r="4" />
      <circle className="illo-flame-core" r="1.6" />
    </>
  );
}

function Meat() {
  return <rect className="illo-meat" x="-5.5" y="-2.5" width="11" height="5" rx="2.5" transform="rotate(12)" />;
}

const HOPS = [
  [Noodle, 98, 74, -6, -42, 1],
  [Leaf, 82, 77, -16, -30, -1],
  [Carrot, 114, 75, 12, -36, 1],
  [Meat, 104, 79, 5, -24, -1],
];

export default function WokFire({ live, taps }) {
  const flaring = taps > 0;

  return (
    <svg className="illo" viewBox="0 0 200 160">
      <ellipse className="illo-shadow" cx="100" cy="144" rx="60" ry="6" />
      {FLAMES.map(([x, angle, size, phase, speed], index) => (
        <g key={x} transform={`translate(${x} 121) rotate(${angle}) scale(${size})`}>
          <g key={taps} className={flaring ? 'illo-flare illo-base' : undefined} style={{ '--order': index % 3 }}>
            <g className={live ? 'illo-ignite illo-base' : undefined} style={{ '--order': Math.abs(index - MIDDLE) }}>
              <g className="illo-flicker illo-base" style={{ '--phase': phase, '--speed': speed }}>
                <path className="illo-flame" d={FLAME} />
                <path className="illo-flame-core" d={CORE} />
              </g>
            </g>
          </g>
        </g>
      ))}
      {SPARKS.map(([x, y, drift, phase]) => (
        <circle
          key={x}
          className="illo-flame-core illo-spark illo-center"
          cx={x}
          cy={y}
          r="1.8"
          style={{ '--drift': drift, '--phase': phase }}
        />
      ))}
      <path className="illo-iron" d="M62 124H138L146 139Q147 142 144 142H56Q53 142 54 139Z" />
      <rect className="illo-iron-light" x="58" y="119" width="84" height="7" rx="3.5" />
      <ellipse className="illo-flame" cx="100" cy="120" rx="30" ry="2.5" />
      <rect className="illo-gloss" x="64" y="130" width="24" height="2.5" rx="1.25" />
      <circle className="illo-red" cx="128" cy="133" r="3.5" />
      <g className="illo-toss illo-pivot" style={PIVOT}>
        <path className="illo-line-iron" strokeWidth="6" d="M150 84L176 74" />
        <path className="illo-line-wood" strokeWidth="8.5" d="M170 76.3L190 68.6" />
        <path className="illo-line-gloss" strokeWidth="2" d="M174 73.4L186 68.8" />
        <path className="illo-line-iron" strokeWidth="3.5" d="M47 84C40 83 38 90 44 92" />
        <ellipse className="illo-ink" cx="100" cy="82" rx="54" ry="10" />
        <path className="illo-line-iron-light" strokeWidth="2.5" d="M46 82A54 10 0 0 1 154 82" />
        <g className={live ? 'illo-drop illo-base' : undefined} style={{ '--order': DROP_AFTER_IGNITE }}>
          <path className="illo-noodle" d="M62 86C66 74 84 70 100 71C118 70 134 75 138 86Z" />
          <path className="illo-line-soy" strokeWidth="1.6" d="M70 82C76 77 82 80 88 76S100 79 106 75 118 78 124 76 132 80 134 82" />
          <path className="illo-line-soy" strokeWidth="1.6" d="M76 86C82 82 90 84 96 81S108 84 114 81 126 84 130 85" />
          <rect className="illo-meat" x="88" y="74" width="10" height="5" rx="2.5" transform="rotate(10 93 76.5)" />
          <ellipse className="illo-leaf" cx="122" cy="77" rx="7" ry="3.5" transform="rotate(18 122 77)" />
          <circle className="illo-carrot" cx="72" cy="80" r="3.5" />
        </g>
        {HOPS.map(([Piece, x, y, hopX, hopY, spin], index) => (
          <g key={x} transform={`translate(${x} ${y})`}>
            <g
              className={live ? 'illo-drop illo-base' : undefined}
              style={{ '--order': DROP_AFTER_IGNITE + 1 + index }}
            >
              <g
                className="illo-hop illo-center"
                style={{ '--hop-x': hopX, '--hop-y': hopY, '--spin': spin, '--order': index }}
              >
                <Piece />
              </g>
            </g>
          </g>
        ))}
        <path className="illo-iron" d="M46 82A54 10 0 0 0 154 82C149 104 124 115 100 115C76 115 51 104 46 82Z" />
        <path className="illo-line-iron-light" strokeWidth="2" d="M48 84A52 9 0 0 0 152 84" />
        <path className="illo-line-gloss" strokeWidth="3" d="M58 94C64 102 72 107 82 110" />
      </g>
      <Steam puffs={PUFFS} />
    </svg>
  );
}
