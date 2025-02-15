import {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
  FormArray,
} from '@angular/forms';

export function uniqueValidator(field: string): ValidatorFn {
  return (formArray: AbstractControl): ValidationErrors | null => {
    if (!(formArray instanceof FormArray)) return null;

    const values = formArray.controls.map((control) => {
      let control_value = control.get(field)?.value;
      if (control_value instanceof Date)
        control_value = control_value.toDateString();
      return control_value;
    });
    const uniqueValues = new Set(values);
    return values.length !== uniqueValues.size ? { duplicate: true } : null;
  };
}
