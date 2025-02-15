import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { SkeletonModule } from 'primeng/skeleton';
import { InputNumberModule } from 'primeng/inputnumber';
import { ProgramStep } from '../../types/program';
import { FocusTrapModule } from 'primeng/focustrap';

@Component({
  selector: 'app-program-create-step-modal',
  imports: [
    TabsModule,
    CardModule,
    FloatLabelModule,
    InputTextModule,
    ButtonModule,
    SelectModule,
    DatePickerModule,
    ReactiveFormsModule,
    SkeletonModule,
    TextareaModule,
    InputNumberModule,
    FocusTrapModule,
  ],
  standalone: true,
  templateUrl: './program-create-step-modal.component.html',
  styleUrl: './program-create-step-modal.component.scss',
})
export class ProgramCreateStepModalComponent {
  stepForm: FormGroup;

  constructor(
    private ref: DynamicDialogRef,
    private fb: FormBuilder,
    private config: DynamicDialogConfig,
  ) {
    this.stepForm = this.fb.group({
      id: -1,
      name: ['', Validators.required],
      repeat: [0, Validators.pattern('^[0-9]+$')],
      next_in: [1, Validators.pattern('^[0-9]+$')],
    });

    if (this.config.data) {
      let editStep: ProgramStep = this.config.data;
      this.stepForm.patchValue(editStep);
    }
  }

  closeDialog() {
    // Normalize data for API POST
    let ret = this.stepForm.value;
    if (ret['next_in']) ret['next_in'] = +ret['next_in'];
    else delete ret['next_in'];

    if (ret['repeat']) ret['repeat'] = +ret['repeat'];
    else delete ret['repeat'];

    this.ref.close(ret);
  }
}
