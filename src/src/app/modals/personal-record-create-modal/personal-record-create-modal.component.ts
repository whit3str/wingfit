import { Component } from '@angular/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { CardModule } from 'primeng/card';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { UtilsService } from '../../services/utils.service';
import { MessageModule } from 'primeng/message';
import { recordFormatValidator } from '../../shared/validators.recordFormat';
import { uniqueValidator } from '../../shared/validators.unique';
import { FocusTrapModule } from 'primeng/focustrap';

@Component({
  selector: 'app-personal-record-create-modal',
  imports: [
    TabsModule,
    CardModule,
    FloatLabelModule,
    InputTextModule,
    ButtonModule,
    SelectModule,
    DatePickerModule,
    ReactiveFormsModule,
    FocusTrapModule,
    MessageModule,
  ],
  standalone: true,
  templateUrl: './personal-record-create-modal.component.html',
  styleUrl: './personal-record-create-modal.component.scss',
})
export class PersonalRecordCreateModalComponent {
  prForm: FormGroup;
  pr_keys: string[];

  constructor(
    private ref: DynamicDialogRef,
    private fb: FormBuilder,
    private utilsService: UtilsService,
  ) {
    this.pr_keys = ['kg', 'rep', 'time']; //TODO: Use backend Enum

    this.prForm = this.fb.group({
      name: ['', Validators.required],
      key: ['kg', Validators.required],
      values: this.fb.array([], uniqueValidator('cdate')),
    });

    this.prForm.get('key')?.valueChanges.subscribe((key) => {
      this.updateValuesValidators(key);
    });
  }

  get values(): FormArray {
    return this.prForm.get('values') as FormArray;
  }

  addValue(): void {
    const newValueGroup = this.fb.group({
      value: [
        '',
        [
          Validators.required,
          recordFormatValidator(this.prForm.get('key')?.value),
        ],
      ],
      cdate: [new Date(), Validators.required],
    });
    this.values.push(newValueGroup);
  }

  updateValuesValidators(key: string): void {
    this.values.controls.forEach((group) => {
      const valueControl = group.get('value');

      if (valueControl) {
        valueControl.clearValidators();
        valueControl.addValidators(Validators.required);
        valueControl.addValidators(recordFormatValidator(key));
        valueControl.updateValueAndValidity();
      }
    });
  }

  removeValue(index: number): void {
    this.values.removeAt(index);
  }

  closeDialog() {
    let ret = this.prForm.value;
    ret['values'] = ret['values'].map((v: { value: string; cdate: Date }) => {
      return { value: v.value, cdate: this.utilsService.Iso8601ToStr(v.cdate) };
    });
    this.ref.close(ret);
  }
}
