import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import useMountAnimation from '../../hooks/useMountAnimation';
import { CHART_ANIMATION_MS, chartTheme } from '../../lib/chartTheme';
import ChartTooltip from './ChartTooltip';

// Colour binds to the segment, never to the bar's position. The three segments
// are a closed set, so each keeps its hue however the counts happen to sort.
const SLOT = { standard: 0, priority: 1, group: 2 };

export default function SegmentMixChart({ data, label }) {
  const theme = chartTheme();
  const anim = useMountAnimation(CHART_ANIMATION_MS);
  const ordered = [...data].sort((a, b) => SLOT[a.segment] - SLOT[b.segment]);

  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={ordered} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="segment"
            tick={{ fill: theme.axis, fontSize: 12 }}
            axisLine={{ stroke: theme.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: theme.axis, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: theme.grid }} />
          <Bar dataKey="orders" name={label} barSize={56} {...anim}>
            {ordered.map((point) => (
              <Cell key={point.segment} fill={theme.series[SLOT[point.segment]]} />
            ))}
            <LabelList dataKey="orders" position="top" fill={theme.axis} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <table className="visually-hidden">
        <caption>{label}</caption>
        <tbody>
          {ordered.map((point) => (
            <tr key={point.segment}>
              <th scope="row">{point.segment}</th>
              <td>{point.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
