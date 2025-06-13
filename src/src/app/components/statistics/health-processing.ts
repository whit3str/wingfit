import { Bloc } from '../../types/bloc';
import { HealthWatchData, StatGauge, Trend } from '../../types/stats';
import { calculateTrend, getQuartile } from './stats-utils';

export function processHealthData(
  data: HealthWatchData[],
  latestOnly: boolean,
  notes: Bloc[],
) {
  let ret = {
    averages: {
      sleep: 0,
      hrv: 0,
      strain: 0,
      recovery: 0,
      restingHR: 0,
    },
    trends: {
      sleep: undefined,
      hrv: undefined,
      strain: undefined,
      recovery: undefined,
      restingHR: undefined,
    },
    strainRecoveryComboGraph: { labels: [], datasets: [] },
    gauges: {
      strain: undefined,
      recovery: undefined,
      hrv: undefined,
    },
  };

  if (!data.length) return ret;
  const LATEST_COUNT = 30;

  const sorted = data.sort(
    (a, b) => new Date(a.cdate).getTime() - new Date(b.cdate).getTime(),
  );
  const slice = latestOnly ? sorted.slice(-LATEST_COUNT) : sorted;

  const sleep = slice.map((d) => d.sleep_duration_total);
  const hrv = slice.map((d) => d.hrv);
  const strain = slice.map((d) => d.strain);
  const recovery = slice.map((d) => d.recovery);
  const restingHR = slice.map((d) => d.resting_hr);

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const averages = {
    sleep: avg(sleep),
    hrv: Math.round(avg(hrv)),
    strain: +avg(strain).toFixed(1),
    recovery: Math.round(avg(recovery)),
    restingHR: Math.round(avg(restingHR)),
  };

  let trends: {
    sleep: Trend | undefined;
    hrv: Trend | undefined;
    strain: Trend | undefined;
    recovery: Trend | undefined;
    restingHR: Trend | undefined;
  } = {
    sleep: undefined,
    hrv: undefined,
    strain: undefined,
    recovery: undefined,
    restingHR: undefined,
  };

  //Trends only for latestOnly option, if 2x LATEST_COUNT(30d) sample size
  if (latestOnly && sorted.length > 2 * LATEST_COUNT) {
    const previous_data = sorted.slice(-LATEST_COUNT * 2, -LATEST_COUNT);
    const previoussleep = previous_data.map((d) => d.sleep_duration_total);
    const previoushrv = previous_data.map((d) => d.hrv);
    const previousstrain = previous_data.map((d) => d.strain);
    const previousrecovery = previous_data.map((d) => d.recovery);
    const previousrestingHR = previous_data.map((d) => d.resting_hr);

    trends = {
      sleep: calculateTrend(sleep, previoussleep),
      hrv: calculateTrend(hrv, previoushrv),
      strain: calculateTrend(strain, previousstrain),
      recovery: calculateTrend(recovery, previousrecovery),
      restingHR: calculateTrend(restingHR, previousrestingHR),
    };
  }

  // Normalize labels
  const labels = slice.map((d) =>
    new Date(d.cdate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    }),
  );

  // Parse notes to dict with key being cdate, append duplicates
  const parsedNotes = notes.reduce(
    (acc, note) => {
      if (acc[note.cdate]) acc[note.cdate] += '\n' + note.content;
      else acc[note.cdate] = note.content;
      return acc;
    },
    {} as { [date: string]: string },
  );

  const strainRecoveryComboGraph = {
    labels,
    datasets: [
      {
        label: 'Notes',
        data: slice.map((obj, index) => {
          if (!(obj.cdate in parsedNotes)) return { x: index, y: null };
          return {
            x: index,
            y: 0,
            content: parsedNotes[obj.cdate],
          };
        }),
        pointBackgroundColor: '#909090',
        pointRadius: 10,
        showLine: false,
        yAxisID: 'yNotes',
      },
      {
        label: 'HRV',
        data: hrv.map((hrv, index) => ({
          x: index,
          y: hrv,
          misc: 'ms',
        })),
        yAxisID: 'yHRV',
        borderColor: '#c088bf',
        backgroundColor: '#c088bf1A',
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        borderWidth: 1,
      },
      {
        label: 'Strain',
        data: strain,
        yAxisID: 'yStrain',
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f61A',
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        borderWidth: 0,
      },
      {
        label: 'Recovery',
        data: recovery,
        yAxisID: 'yRecovery',
        borderColor: '#15803d',
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        borderWidth: 2,
        segment: {
          borderColor: (ctx: any) => {
            const value = ctx.p0.parsed.y;
            return value >= 66
              ? '#15803d'
              : value >= 33
                ? '#facc15'
                : '#dc2626';
          },
        },
      },
    ],
  };

  const gauge = (arr: number[], avgValue: number): StatGauge => {
    const sorted = new Float64Array(arr).sort();
    const max = sorted[sorted.length - 1] || 1;
    return {
      first: sorted[0],
      last: max,
      average_pct: (100 * avgValue) / max,
      q_start_pct: (100 * getQuartile(0.25, sorted)) / max,
      q_end_pct: (100 * getQuartile(0.75, sorted)) / max,
    };
  };

  return {
    averages,
    trends: trends,
    strainRecoveryComboGraph,
    gauges: {
      strain: gauge(strain, averages.strain),
      recovery: gauge(recovery, averages.recovery),
      hrv: gauge(hrv, averages.hrv),
    },
  };
}
