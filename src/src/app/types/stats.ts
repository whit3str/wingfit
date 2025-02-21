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
