import { Trend } from '../../types/stats';

export function calculateTrend(data: number[], prev: number[]): Trend {
  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((sum, v) => sum + v, 0) / arr.length : 0;

  const prevAvg = avg(prev);
  const currAvg = avg(data);
  const change = currAvg - prevAvg;

  return {
    current: currAvg,
    previous: prevAvg,
    direction: change > 0 ? 'up' : change < 0 ? 'down' : '',
    change,
  };
}

export function getQuartile(q: number, arr: Float64Array): number {
  const pos = q * (arr.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);

  return lower === upper
    ? arr[lower]
    : arr[lower] + (arr[upper] - arr[lower]) * (pos - lower);
}
