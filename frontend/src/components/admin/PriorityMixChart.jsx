import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import useMountAnimation from '../../hooks/useMountAnimation';
import { CHART_ANIMATION_MS, chartTheme } from '../../lib/chartTheme';
import ChartTooltip from './ChartTooltip';

/**
 * Declared status has four values, and only three chart hues survive the colourblind
 * check — so this is deliberately a single series with identity carried by the axis
 * labels rather than by colour. See UIDesign.md §2.5 and §13.
 */
export default function PriorityMixChart({ data, label, labelFor }) {
  const theme = chartTheme();
  const anim = useMountAnimation(CHART_ANIMATION_MS);
  const rows = data.map((point) => ({ ...point, name: labelFor(point.status) }));

  return (
    <>
      <ResponsiveContainer width="100%" height={40 * rows.length + 24}>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={theme.grid} horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fill: theme.axis, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: theme.grid }} />
          <Bar dataKey="sessions" name={label} fill={theme.series[0]} barSize={16} {...anim}>
            <LabelList dataKey="sessions" position="right" fill={theme.axis} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <table className="visually-hidden">
        <caption>{label}</caption>
        <tbody>
          {rows.map((point) => (
            <tr key={point.status}>
              <th scope="row">{point.name}</th>
              <td>{point.sessions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
