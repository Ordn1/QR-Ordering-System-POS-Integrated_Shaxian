import Sparkles from './Sparkles';

const PAPER = 'M72 96V56l4-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4V96Z';
const PESO = 'M-3.5 7.5V-7.5H1.5C5-7.5 7-5.5 7-3.5S5 0.5 1.5 0.5H-3.5M-7-4H8.5M-7-1H8.5';
const STARS = [
  [178, 30, 0.8, 0],
  [132, 34, 0.6, 0.45],
  [184, 62, 0.65, 0.7],
];
const COIN_AFTER_FEED = 16;

export default function TicketPrinter({ live, taps }) {
  return (
    <svg className="illo" viewBox="0 0 200 160">
      <ellipse className="illo-shadow" cx="100" cy="142" rx="58" ry="6" />
      <g className={live ? 'illo-jiggle' : undefined}>
        <rect className="illo-iron-light" x="58" y="84" width="84" height="16" rx="8" />
        <rect className="illo-ink" x="66" y="93" width="68" height="4" rx="2" />
        <g className={live ? 'illo-feed' : undefined}>
          <g className="illo-sway illo-base">
            <path className="illo-paper" d={PAPER} />
            <rect className="illo-ink" x="80" y="61" width="22" height="4" rx="2" />
            <rect className="illo-red" x="113" y="59.5" width="7" height="7" />
            <rect className="illo-faint" x="80" y="70" width="40" height="3" rx="1.5" />
            <rect className="illo-faint" x="80" y="76" width="30" height="3" rx="1.5" />
            <rect className="illo-faint" x="80" y="83" width="12" height="3" rx="1.5" />
            <rect className="illo-ink" x="100" y="82.5" width="20" height="4" rx="2" />
            <rect className="illo-shade" x="72" y="90" width="56" height="6" />
          </g>
        </g>
        <rect className="illo-iron" x="50" y="96" width="100" height="44" rx="10" />
        <rect className="illo-iron-light" x="54" y="97" width="92" height="4" rx="2" />
        <rect className="illo-gloss" x="58" y="106" width="30" height="3" rx="1.5" />
        <rect className="illo-red" x="60" y="119" width="9" height="9" />
        <rect className="illo-iron-light" x="118" y="124" width="20" height="6" rx="3" />
        <circle className="illo-gold illo-blink" cx="128" cy="113" r="3" />
      </g>
      <Sparkles stars={STARS} />
      <g transform="translate(156 44)">
        <g className={live ? 'illo-pop illo-center' : undefined} style={{ '--order': COIN_AFTER_FEED }}>
          <g key={taps} className={taps ? 'illo-coin-tap illo-center' : undefined}>
            <g className="illo-coin illo-center">
              <circle className="illo-gold-deep" cx="1.5" cy="1.5" r="15" />
              <circle className="illo-gold" r="15" />
              <circle className="illo-line-gold-deep" r="11" strokeWidth="1.5" />
              <path className="illo-line-gold-deep" strokeWidth="2.6" d={PESO} />
              <ellipse className="illo-shine" cx="-6" cy="-7" rx="3.5" ry="2" transform="rotate(-35 -6 -7)" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
