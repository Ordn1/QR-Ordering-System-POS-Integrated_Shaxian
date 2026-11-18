const CURL = 'M0 0C-5-5 5-9 0-14C-5-19 4-23 0-28';

export default function Steam({ puffs }) {
  return puffs.map(([x, y, phase]) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
      <path className="illo-line-paper illo-rise illo-base" strokeWidth="4" style={{ '--phase': phase }} d={CURL} />
    </g>
  ));
}
