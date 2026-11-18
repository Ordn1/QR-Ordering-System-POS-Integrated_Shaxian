import { STAR } from '../../../lib/progress';

export default function Sparkles({ stars }) {
  return stars.map(([x, y, size, phase]) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${size})`}>
      <path className="illo-gold illo-twinkle illo-center" style={{ '--phase': phase }} d={STAR} />
    </g>
  ));
}
