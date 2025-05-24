import { WeeklyDuration } from '../../types/stats';

export function processDurationsData(data: WeeklyDuration[]) {
  if (!data.length)
    return {
      durationsByCategory: { labels: [], datasets: [] },
      categoryDurationPerWeek: { labels: [], datasets: [] },
    };

  return {
    durationsByCategory: {
      labels: data.map((c) => c.label),
      datasets: [
        {
          data: data.map((c) => c.data.reduce((sum, value) => sum + value, 0)),
          borderColor: data.map((c) => c.backgroundColor),
          backgroundColor: data.map((c) => c.backgroundColor),
        },
      ],
    },
    categoryDurationPerWeek: {
      labels: Array.from({ length: 52 }, (_, i) => i + 1),
      datasets: data.map((d) => ({
        ...d,
        type: 'bar',
        order: data.length - d.order, //ChartJS stacks from bottom to top, we reverse to keep the order
        borderColor: d.backgroundColor,
      })),
    },
  };
}
