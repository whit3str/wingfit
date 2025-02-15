import { Component } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { UtilsService } from '../../services/utils.service';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { PRvalue } from '../../types/personal-record';
import { uniqueValidator } from '../../shared/validators.unique';
import { FocusTrapModule } from 'primeng/focustrap';
import { MessageModule } from 'primeng/message';
import { recordFormatValidator } from '../../shared/validators.recordFormat';

@Component({
  selector: 'app-personal-record-create-value-modal',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    FloatLabelModule,
    InputTextModule,
    DatePickerModule,
    ButtonModule,
    FocusTrapModule,
    MessageModule,
  ],
  standalone: true,
  templateUrl: './personal-record-create-value-modal.component.html',
  styleUrl: './personal-record-create-value-modal.component.scss',
})
export class PersonalRecordCreateValueModalComponent {
  prValueForm: FormGroup;
  recordKey: string = '';
  editingValue: boolean = false;
  today: Date = new Date(new Date().setHours(23, 59, 59)); // Max selector date for datepicker, set to midnight to ensure no conflict

  constructor(
    private ref: DynamicDialogRef,
    private fb: FormBuilder,
    private utilsService: UtilsService,
    private config: DynamicDialogConfig,
  ) {
    this.prValueForm = this.fb.group({
      values: this.fb.array([], uniqueValidator('cdate')),
    });

    this.recordKey = this.config.data.key;
    this.addValue();

    if (this.config.data.value) {
      this.editingValue = true;
      let value: PRvalue = this.config.data.value;
      this.values.at(0).patchValue({ ...value, cdate: new Date(value.cdate) });
    }
  }

  get values(): FormArray {
    return this.prValueForm.get('values') as FormArray;
  }

  addValue(): void {
    const newValueGroup = this.fb.group({
      value: ['', [Validators.required, recordFormatValidator(this.recordKey)]],
      cdate: [new Date(), Validators.required],
    });

    this.values.push(newValueGroup);
  }

  removeValue(index: number): void {
    this.values.removeAt(index);
  }

  closeDialog() {
    let ret = this.prValueForm.value;
    ret = ret['values'].map((v: { value: string; cdate: Date }) => {
      return { value: v.value, cdate: this.utilsService.Iso8601ToStr(v.cdate) };
    });
    this.ref.close(ret);
  }
}
