import { BlocCategory } from './bloc';

export interface HealthWatchData {
  id: number;
  cdate: string;
  recovery: number;
  resting_hr: number;
  hrv: number;
  temperature: number;
  oxy_level: number;
  strain: number;
  sleep_score: number;
  sleep_duration_light: number; //minutes
  sleep_duration_deep: number; //minutes
  sleep_duration_rem: number; //minutes
  sleep_duration_awake: number; //minutes
  sleep_efficiency: number;
  sleep_duration_total: number; //minutes
}

export interface BlocsByCategory extends BlocCategory {
  count: number;
}

export interface WeeklyDurationTotal {
  week: number;
  duration: number; //minutes
}

export interface WeeklyDuration {
  // Basically chartjs data interface
  label: string;
  order: number;
  backgroundColor: string;
  data: number[];
}

export interface StatGauge {
  first: number;
  last: number;
  average_pct: number;
  q_start_pct: number;
  q_end_pct: number;
}

export interface Trend {
  current: number;
  previous: number;
  direction: 'up' | 'down' | '';
  change: number;
}
