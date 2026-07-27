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

export default function TopItemsChart({ data, label }) {
  const theme = chartTheme();
  const anim = useMountAnimation(CHART_ANIMATION_MS);

  return (
    <>
      <ResponsiveContainer width="100%" height={40 * data.length + 24}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke={theme.grid} horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={170}
            tick={{ fill: theme.axis, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: theme.grid }} />
          <Bar
            dataKey="units"
            name={label}
            fill={theme.series[0]}
            barSize={16}
            {...anim}
          >
            <LabelList
              dataKey="units"
              position="right"
              fill={theme.axis}
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <table className="visually-hidden">
        <caption>{label}</caption>
        <tbody>
          {data.map((point) => (
            <tr key={point.name}>
              <th scope="row">{point.name}</th>
              <td>{point.units}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
