import { QUIET_ZONE, code128, code128Width } from '../../lib/code128';

const MODULE_PX = 2;
const HEIGHT_PX = 44;

export default function Barcode({ value }) {
  const widths = code128(value);
  const width = code128Width(widths) * MODULE_PX;
  const bars = [];
  let x = QUIET_ZONE * MODULE_PX;
  widths.forEach((modules, index) => {
    if (index % 2 === 0) {
      bars.push(<rect key={index} x={x} y={0} width={modules * MODULE_PX} height={HEIGHT_PX} />);
    }
    x += modules * MODULE_PX;
  });

  return (
    <svg
      className="barcode"
      width={width}
      height={HEIGHT_PX}
      viewBox={`0 0 ${width} ${HEIGHT_PX}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={value}
    >
      <rect className="barcode-quiet" width={width} height={HEIGHT_PX} />
      <g className="barcode-bars">{bars}</g>
    </svg>
  );
}
