import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'minsToHour',
  pure: true,
  standalone: true,
})
export class MinutesToHoursPipe implements PipeTransform {
  transform(value: number): any {
    if (value) {
      return (
        `0${(value / 60) ^ 0}`.slice(-2) + ':' + ('0' + (value % 60)).slice(-2)
      );
    }
    return NaN;
  }
}
