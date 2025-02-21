import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'minsToHour',
  pure: true,
  standalone: true,
})
export class MinutesToHoursPipe implements PipeTransform {
  transform(
    value: number,
    pad: boolean = true,
    hourOnly: boolean = false,
  ): string | null {
    if (value == null || isNaN(value)) return null;

    const hours = Math.floor(value / 60);
    const minutes = Math.round(value % 60); // Ensure proper rounding

    if (hourOnly) return pad ? String(hours).padStart(2, '0') : String(hours);

    const formattedHours = pad ? String(hours).padStart(2, '0') : String(hours);
    const formattedMinutes = String(minutes).padStart(2, '0');

    return `${formattedHours}h${formattedMinutes}`;
  }
}
