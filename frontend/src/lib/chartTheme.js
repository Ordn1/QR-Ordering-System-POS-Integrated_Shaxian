const token = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function chartTheme() {
  return {
    series: [token('--chart-1'), token('--chart-5'), token('--chart-6')],
    grid: token('--surface-2'),
    axis: token('--text-muted'),
    axisSize: token('--font-xs'),
  };
}

export const CHART_ANIMATION_MS = 300;
