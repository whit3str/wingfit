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
          backgroundColor: data.map((c) => c.backgroundColor),
        },
      ],
    },
    categoryDurationPerWeek: {
      labels: Array.from({ length: 52 }, (_, i) => i + 1),
      datasets: data.map((d) => ({ ...d, type: 'bar' })),
    },
  };
}
