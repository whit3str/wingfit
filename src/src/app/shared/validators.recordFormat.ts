import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function recordFormatValidator(key: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    let expected_format: RegExp | undefined;
    if (key === 'time') {
      expected_format = /^(?:(?:(\d{0,3}):)?([0-5]?\d):)?([0-5]?\d)$/;
    } else {
      expected_format = /^\d+$/;
    }

    const value = control.value;
    return expected_format.test(value) ? null : { formaterror: true };
  };
}
