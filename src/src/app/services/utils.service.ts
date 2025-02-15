import { inject, Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root',
})
export class UtilsService {
  public emojiList: string[] = ['📝', '💯', '💦', '🎯', '⚡', '🚀', '⏱️'];

  constructor(private ngMessageService: MessageService) {}

  toGithubWingfit() {
    window.open('https://github.com/itskovacs/wingfit', '_blank');
  }

  // Toasts
  toast(severity = 'info', summary = 'Info', detail = '', life = 3000): void {
    this.ngMessageService.add({
      severity,
      summary,
      detail,
      life,
    });
  }

  // Emoji add to input
  addEmoji(content: HTMLTextAreaElement, emoji: string): string {
    let carrotPosition: number = content.selectionStart;
    content.value =
      content.value.substring(0, carrotPosition) +
      emoji +
      content.value.substring(carrotPosition);
    content.selectionStart = carrotPosition + emoji.length;
    content.selectionEnd = carrotPosition + emoji.length;
    content.focus();

    return content.value;
  }

  // Dict diff for PUT requests
  getModifiedFields<T extends object>(original: T, updated: T): Partial<T> {
    //Returns the modified keys only, to PUT only the object updated keys
    const result: Partial<T> = {};
    for (const key in updated) {
      if (updated.hasOwnProperty(key)) {
        const originalValue = original[key as keyof T];
        const updatedValue = updated[key as keyof T];

        if (
          typeof originalValue === 'object' &&
          originalValue !== null &&
          updatedValue !== null
        ) {
          //FIXME: If we modify a field to 'null', it is skipped and not sent to backend
          if (JSON.stringify(originalValue) !== JSON.stringify(updatedValue)) {
            result[key as keyof T] = updatedValue;
          }
        } else if (originalValue !== updatedValue) {
          result[key as keyof T] = updatedValue;
        }
      }
    }

    return result;
  }

  // Date(time) Fn
  public getFirstAndLastDaysOfWeek(selectedDate: Date): [Date, Date] {
    var day = selectedDate.getDay();

    let _date = new Date(selectedDate); //Deep copy date
    let firstDayOfWeek = new Date(
      _date.setDate(selectedDate.getDate() - day + (day == 0 ? -6 : 1)),
    );
    let lastDayOfWeek = new Date(_date.setDate(firstDayOfWeek.getDate() + 6));

    return [firstDayOfWeek, lastDayOfWeek];
  }

  public getDatesOfWeek(firstDayOfWeek: Date): Date[] {
    let _date = new Date(firstDayOfWeek);
    let dates: Date[] = [];

    _date.setDate(_date.getDate() - _date.getDay() + 1);
    for (var i = 0; i < 7; i++) {
      dates.push(new Date(_date));
      _date.setDate(_date.getDate() + 1);
    }

    return dates;
  }

  public setHoursNoon(date?: Date): Date {
    if (!date) {
      date = new Date();
    }
    return new Date(date.setHours(12, 0, 0, 0));
  }

  public Iso8601ToStr(date: Date): string {
    return this.setHoursNoon(date).toISOString().split('T')[0];
  }

  public dateStrToIso8601(dateStr: string): Date {
    return this.setHoursNoon(new Date(dateStr.split('/').reverse().join('-')));
  }

  public formatToSeconds(str: string): number {
    let _split = str.split(':');
    let _timeToSeconds: number = 0;

    for (let i = 0; i < _split.length; i++) {
      _timeToSeconds += +_split[i] * 60 ** (_split.length - 1 - i);
    }

    return _timeToSeconds;
  }

  public formatSecondsToString(seconds: number): string {
    if (seconds / 3600 > 1) {
      return new Date(seconds * 1000).toISOString().substring(11, 19);
    } else {
      return new Date(seconds * 1000).toISOString().substring(14, 19);
    }
  }
}
