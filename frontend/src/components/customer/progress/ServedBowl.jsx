import Sparkles from './Sparkles';
import Steam from './Steam';

const WONTON = 'M-9 2C-11-3-6-8-1-6C3-9 10-6 9 0C8 4 2 6-2 5C-6 6-8 4-9 2Z';
const WONTONS = [
  [72, 87, -10],
  [104, 86, 14],
  [90, 92, 4],
];
const SCALLIONS = [
  [62, 90],
  [82, 85],
  [96, 84],
  [116, 91],
  [120, 86],
  [78, 93],
];
const SPECKLES = [
  [60, 104],
  [74, 114],
  [92, 110],
  [104, 119],
  [118, 106],
  [84, 121],
];
const PUFFS = [
  [74, 78, 0],
  [92, 74, 0.33],
  [110, 78, 0.66],
];
const STARS = [
  [30, 58, 0.75, 0],
  [124, 26, 0.6, 0.4],
  [190, 92, 0.6, 0.7],
];
const CONFETTI = [
  ['strip', 'red', -52, -30, 1, 0],
  ['strip', 'gold', -30, -46, -1, 1],
  ['dot', 'green', -8, -54, 1, 0],
  ['strip', 'flame-core', 14, -50, -1, 2],
  ['strip', 'red', 34, -42, 1, 1],
  ['dot', 'gold', 46, -22, -1, 0],
  ['strip', 'green', 40, 4, 1, 2],
  ['strip', 'red', -44, -8, 1, 2],
  ['dot', 'gold', -20, -30, 1, 3],
  ['strip', 'flame-core', 24, -24, -1, 3],
  ['strip', 'red-deep', 6, -36, 1, 4],
  ['dot', 'green', -36, -38, -1, 4],
];
const BADGE_AFTER_DROP = 4;
const CHECK_AFTER_BADGE = 3;
const CONFETTI_AFTER_BADGE = 2;

function Bowl() {
  return (
    <>
      <rect className="illo-speckle" x="78" y="122" width="28" height="7" rx="2.5" />
      <ellipse className="illo-ceramic" cx="92" cy="88" rx="46" ry="9.5" />
      <path className="illo-shade" d="M46 88A46 9.5 0 0 1 138 88A44 7 0 0 0 46 88Z" />
      <ellipse className="illo-broth" cx="92" cy="90" rx="40" ry="7" />
      <path className="illo-line-noodle" strokeWidth="2.4" d="M58 91C64 87 70 93 76 89S88 93 94 89 106 93 114 89" />
      {WONTONS.map(([x, y, angle]) => (
        <g key={x} transform={`translate(${x} ${y}) rotate(${angle})`}>
          <path className="illo-wrapper" d={WONTON} />
          <path className="illo-line-soy" strokeWidth="1" d="M-5 0C-2 2 2 2 5-1" />
          <ellipse className="illo-shine" cx="-3" cy="-3.5" rx="2.5" ry="1.2" />
        </g>
      ))}
      {SCALLIONS.map(([x, y]) => (
        <circle key={`${x}-${y}`} className="illo-scallion" cx={x} cy={y} r="1.6" />
      ))}
      <path className="illo-ceramic" d="M46 88A46 9.5 0 0 0 138 88C136 110 116 126 92 126C68 126 48 110 46 88Z" />
      <path className="illo-shade" d="M138 88C136 110 116 126 92 126C109 122 124 110 127 94Z" />
      <path className="illo-line-gold-deep" strokeWidth="2.5" d="M48.5 93A43.5 9 0 0 0 135.5 93" />
      {SPECKLES.map(([x, y]) => (
        <circle key={`${x}-${y}`} className="illo-speckle" cx={x} cy={y} r="1.1" />
      ))}
      <path className="illo-line-gloss" strokeWidth="3.5" d="M54 100C57 110 63 117 71 121" />
    </>
  );
}

export default function ServedBowl({ live, taps }) {
  const celebrating = live || taps > 0;

  return (
    <svg className="illo" viewBox="0 0 200 160">
      <ellipse className="illo-shadow" cx="98" cy="147" rx="84" ry="6" />
      <ellipse className="illo-red-deep" cx="96" cy="137" rx="84" ry="13" />
      <ellipse className="illo-red" cx="96" cy="134" rx="81" ry="11" />
      <path className="illo-line-gloss" strokeWidth="2" d="M24 132A78 9 0 0 1 112 123.2" />
      <path className="illo-line-wood" strokeWidth="3.6" d="M128 141L182 114" />
      <path className="illo-line-wood" strokeWidth="3.6" d="M136 144L188 118" />
      <path className="illo-line-gold-deep" strokeWidth="3.8" d="M174 118L182 114" />
      <path className="illo-line-gold-deep" strokeWidth="3.8" d="M180 122L188 118" />
      <ellipse className="illo-shade" cx="94" cy="131" rx="40" ry="6" />
      <g className={live ? 'illo-drop illo-base' : undefined}>
        <Bowl />
      </g>
      <Steam puffs={PUFFS} />
      <Sparkles stars={STARS} />
      <g transform="translate(156 50)">
        {celebrating ? (
          <g key={`confetti-${taps}`}>
            {CONFETTI.map(([shape, color, dx, dy, spin, order]) => {
              const style = {
                '--dx': dx,
                '--dy': dy,
                '--spin': spin,
                '--order': (live ? BADGE_AFTER_DROP : 0) + CONFETTI_AFTER_BADGE + order,
              };
              const className = `illo-${color} illo-confetti illo-center`;
              return shape === 'dot' ? (
                <circle key={`${dx}-${dy}`} className={className} r="2.6" style={style} />
              ) : (
                <rect key={`${dx}-${dy}`} className={className} x="-2.2" y="-4" width="4.4" height="8" style={style} />
              );
            })}
          </g>
        ) : null}
        <g
          key={taps}
          className={celebrating ? 'illo-pop illo-center' : undefined}
          style={{ '--order': live ? BADGE_AFTER_DROP : 0 }}
        >
          <circle className="illo-shade" cx="1.5" cy="2" r="15" />
          <circle className="illo-green" r="15" />
          <path
            className={`illo-line-paper${celebrating ? ' illo-draw' : ''}`}
            strokeWidth="4"
            pathLength="1"
            style={{ '--order': (live ? BADGE_AFTER_DROP : 0) + CHECK_AFTER_BADGE }}
            d="M-6.5 0.5L-2 5L7-5"
          />
          <ellipse className="illo-gloss" cx="-5" cy="-7.5" rx="5" ry="2.5" transform="rotate(-30 -5 -7.5)" />
        </g>
      </g>
    </svg>
  );
}
