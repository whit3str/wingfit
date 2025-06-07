import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { FocusTrapModule } from 'primeng/focustrap';

@Component({
  selector: 'app-settings-password-modal',
  imports: [
    FloatLabelModule,
    InputTextModule,
    ButtonModule,
    ReactiveFormsModule,
    FocusTrapModule,
  ],
  standalone: true,
  templateUrl: './settings-password-modal.component.html',
  styleUrl: './settings-password-modal.component.scss',
})
export class SettingsPasswordModalComponent {
  pwForm: FormGroup;

  constructor(
    private ref: DynamicDialogRef,
    private fb: FormBuilder,
  ) {
    this.pwForm = this.fb.group({
      current: ['', Validators.required],
      new: ['', Validators.required],
      new_verify: ['', Validators.required],
    });
  }

  closeDialog() {
    let ret = this.pwForm.value;
    this.ref.close(ret);
  }
}
