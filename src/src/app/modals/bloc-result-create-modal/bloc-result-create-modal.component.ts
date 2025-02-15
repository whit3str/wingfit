import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ApiService } from '../../services/api.service';
import { BlocResult } from '../../types/bloc';
import { FocusTrapModule } from 'primeng/focustrap';
import { recordFormatValidator } from '../../shared/validators.recordFormat';

@Component({
  selector: 'app-bloc-result-create-modal',
  imports: [
    TabsModule,
    FloatLabelModule,
    InputTextModule,
    SelectButtonModule,
    ButtonModule,
    ReactiveFormsModule,
    TextareaModule,
    FocusTrapModule,
  ],
  standalone: true,
  templateUrl: './bloc-result-create-modal.component.html',
  styleUrl: './bloc-result-create-modal.component.scss',
})
export class BlocResultCreateModalComponent {
  resultForm: FormGroup;
  isUpdate = false;
  keyOptions: any[] = [
    { label: 'kg', value: 'kg' },
    { label: 'Reps', value: 'rep' },
    { label: 'Time', value: 'time' },
  ];

  constructor(
    private ref: DynamicDialogRef,
    private apiService: ApiService,
    private fb: FormBuilder,
    private config: DynamicDialogConfig,
  ) {
    this.resultForm = this.fb.group({
      key: ['kg', Validators.required],
      value: ['', [Validators.required, recordFormatValidator('kg')]],
      comment: '',
    });

    this.resultForm.get('key')?.valueChanges.subscribe((key) => {
      this.updateValueValidator(key);
    });

    if (this.config.data.result) {
      this.isUpdate = true;
      let result: BlocResult = this.config.data.result;
      this.resultForm.patchValue(result);
    }
  }

  updateValueValidator(key: string): void {
    const valueControl = this.resultForm.get('value');
    if (valueControl) {
      valueControl.clearValidators();
      valueControl.addValidators(Validators.required);
      valueControl.addValidators(recordFormatValidator(key));
      valueControl.updateValueAndValidity();
    }
  }

  deleteResult() {
    this.apiService.deleteBlocResult(this.config.data.bloc_id).subscribe({
      next: (_) => this.ref.close(true),
    });
  }

  closeDialog() {
    // Normalize data for API POST
    let ret = this.resultForm.value;
    this.ref.close(ret);
  }
}
