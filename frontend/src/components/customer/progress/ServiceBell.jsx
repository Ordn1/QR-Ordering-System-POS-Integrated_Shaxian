import { STAR } from '../../../lib/progress';
import Sparkles from './Sparkles';
import Steam from './Steam';

const PIVOT = { '--pivot-x': 70, '--pivot-y': 125 };
const WAVES = [
  ['M53 84A18 18 0 0 1 58 67', -1, 0],
  ['M45 86A26 26 0 0 1 52 61', -1, 2],
  ['M87 84A18 18 0 0 0 82 67', 1, 0],
  ['M95 86A26 26 0 0 0 88 61', 1, 2],
];
const BURST = [
  [-36, -18, 0],
  [-22, -38, 1],
  [0, -46, 0],
  [22, -38, 1],
  [36, -18, 0],
  [44, 2, 2],
];
const STARS = [
  [30, 60, 0.7, 0],
  [112, 50, 0.6, 0.5],
  [186, 72, 0.6, 0.25],
];
const PUFFS = [
  [142, 94, 0],
  [154, 90, 0.33],
  [166, 94, 0.66],
];

function Bowl() {
  return (
    <>
      <rect className="illo-speckle" x="142" y="132" width="24" height="6" rx="2" />
      <ellipse className="illo-ceramic" cx="154" cy="104" rx="31" ry="7" />
      <ellipse className="illo-shade" cx="154" cy="103.5" rx="29" ry="6" />
      <ellipse className="illo-broth" cx="154" cy="105" rx="27" ry="5" />
      <path className="illo-line-noodle" strokeWidth="2.2" d="M136 105C142 101 148 107 154 103S164 107 170 104" />
      <ellipse className="illo-meat" cx="148" cy="102" rx="5" ry="2.4" />
      <path className="illo-wrapper" d="M158 104C156 100 161 98 163 100C166 98 170 101 168 104C166 107 160 107 158 104Z" />
      <circle className="illo-scallion" cx="141" cy="104" r="1.4" />
      <circle className="illo-scallion" cx="160" cy="101.5" r="1.4" />
      <circle className="illo-scallion" cx="165" cy="106.5" r="1.4" />
      <path className="illo-ceramic" d="M123 104A31 7 0 0 0 185 104C183 123 170 134 154 134C138 134 125 123 123 104Z" />
      <path className="illo-shade" d="M185 104C183 123 170 134 154 134C166 131 174 122 176 109Z" />
      <path className="illo-line-gold-deep" strokeWidth="2" d="M124.5 108.5A29.5 6.5 0 0 0 183.5 108.5" />
      <circle className="illo-speckle" cx="134" cy="116" r="1.1" />
      <circle className="illo-speckle" cx="146" cy="124" r="1.1" />
      <circle className="illo-speckle" cx="162" cy="119" r="1.1" />
      <circle className="illo-speckle" cx="140" cy="127" r="1" />
      <path className="illo-line-gloss" strokeWidth="3" d="M129 112C131 119 135 124 140 127" />
    </>
  );
}

export default function ServiceBell({ live, taps }) {
  const ringing = live || taps > 0;

  return (
    <svg className="illo" viewBox="0 0 200 160">
      <ellipse className="illo-shadow" cx="70" cy="141" rx="44" ry="5.5" />
      <ellipse className="illo-shadow" cx="154" cy="140" rx="32" ry="5" />
      <Bowl />
      <Steam puffs={PUFFS} />
      <rect className="illo-iron" x="30" y="124" width="80" height="14" rx="7" />
      <ellipse className="illo-iron-light" cx="70" cy="126" rx="38" ry="4.5" />
      <rect className="illo-gloss" x="38" y="131" width="22" height="2.5" rx="1.25" />
      <g key={taps} className={ringing ? 'illo-ring illo-pivot' : undefined} style={PIVOT}>
        <g className="illo-wobble illo-pivot" style={PIVOT}>
          <g className={ringing ? 'illo-ring-press' : undefined}>
            <g className="illo-press">
              <rect className="illo-gold-deep" x="67" y="78" width="6" height="16" rx="1.5" />
              <ellipse className="illo-gold" cx="70" cy="78" rx="8" ry="4.5" />
              <ellipse className="illo-shine" cx="66.5" cy="76.5" rx="3" ry="1.3" />
            </g>
          </g>
          <path className="illo-gold" d="M40 124C40 102 53 90 70 90C87 90 100 102 100 124Z" />
          <path className="illo-gold-deep" d="M80 92C93 96 100 108 100 124H89C89 108 86 98 80 92Z" />
          <rect className="illo-gold-deep" x="37" y="120" width="66" height="6" rx="3" />
          <ellipse className="illo-shine" cx="55" cy="104" rx="4.5" ry="9" transform="rotate(32 55 104)" />
          <circle className="illo-shine" cx="62" cy="95.5" r="2" />
        </g>
      </g>
      {WAVES.map(([d, dir, order]) => (
        <path
          key={d}
          className="illo-line-gold illo-wave illo-center"
          strokeWidth="3"
          style={{ '--dir': dir, '--order': order }}
          d={d}
        />
      ))}
      {ringing
        ? WAVES.map(([d, dir, order]) => (
            <path
              key={`${d}-${taps}`}
              className="illo-line-gold illo-ring-wave illo-center"
              strokeWidth="3.5"
              style={{ '--dir': dir, '--order': order }}
              d={d}
            />
          ))
        : null}
      {ringing ? (
        <g key={`burst-${taps}`} transform="translate(70 72)">
          {BURST.map(([dx, dy, order]) => (
            <path
              key={`${dx}-${dy}`}
              className="illo-gold illo-burst illo-center"
              style={{ '--dx': dx, '--dy': dy, '--order': order }}
              d={STAR}
            />
          ))}
        </g>
      ) : null}
      <Sparkles stars={STARS} />
    </svg>
  );
}
