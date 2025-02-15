import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { ColorPickerModule } from 'primeng/colorpicker';
import { BlocCategory } from '../../types/bloc';
import { FocusTrapModule } from 'primeng/focustrap';

@Component({
  selector: 'app-settings-create-category',
  imports: [
    CardModule,
    FloatLabelModule,
    InputTextModule,
    ButtonModule,
    ReactiveFormsModule,
    ColorPickerModule,
    FocusTrapModule,
  ],
  standalone: true,
  templateUrl: './settings-create-category.component.html',
  styleUrl: './settings-create-category.component.scss',
})
export class SettingsCreateCategoryComponent {
  categoryForm: FormGroup;

  constructor(
    private ref: DynamicDialogRef,
    private fb: FormBuilder,
    private config: DynamicDialogConfig,
  ) {
    this.categoryForm = this.fb.group({
      id: -1,
      color: ['#333', Validators.required],
      name: ['', Validators.required],
      weight: null,
    });

    if (this.config.data) {
      let edit_category: BlocCategory = this.config.data;
      this.categoryForm.patchValue(edit_category);
    }
  }

  closeDialog() {
    // Normalize data for API POST
    let ret = this.categoryForm.value;
    this.ref.close(ret);
  }
}
