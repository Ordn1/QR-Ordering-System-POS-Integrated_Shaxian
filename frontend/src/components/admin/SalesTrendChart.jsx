import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import useMountAnimation from '../../hooks/useMountAnimation';
import { CHART_ANIMATION_MS, chartTheme } from '../../lib/chartTheme';
import { peso } from '../../lib/format';
import ChartTooltip from './ChartTooltip';

const dayLabel = (iso) =>
  new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

export default function SalesTrendChart({ data, label }) {
  const theme = chartTheme();
  const anim = useMountAnimation(CHART_ANIMATION_MS);

  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={dayLabel}
            tick={{ fill: theme.axis, fontSize: 12 }}
            axisLine={{ stroke: theme.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: theme.axis, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip
            content={<ChartTooltip format={peso} />}
            labelFormatter={dayLabel}
            cursor={{ stroke: theme.grid }}
          />
          <Line
            type="monotone"
            dataKey="net"
            name={label}
            stroke={theme.series[0]}
            strokeWidth={2}
            dot={{ r: 3, fill: theme.series[0] }}
            activeDot={{ r: 5 }}
            {...anim}
          />
        </LineChart>
      </ResponsiveContainer>
      <table className="visually-hidden">
        <caption>{label}</caption>
        <tbody>
          {data.map((point) => (
            <tr key={point.date}>
              <th scope="row">{dayLabel(point.date)}</th>
              <td>{peso(point.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
