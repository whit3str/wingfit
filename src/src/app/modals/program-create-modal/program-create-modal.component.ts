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
import { ApiService } from '../../services/api.service';
import { FocusTrapModule } from 'primeng/focustrap';

@Component({
  selector: 'app-program-create-modal',
  imports: [
    TabsModule,
    CardModule,
    FloatLabelModule,
    InputTextModule,
    ButtonModule,
    SelectModule,
    FocusTrapModule,
    DatePickerModule,
    ReactiveFormsModule,
    SkeletonModule,
    TextareaModule,
    InputNumberModule,
  ],
  standalone: true,
  templateUrl: './program-create-modal.component.html',
  styleUrl: './program-create-modal.component.scss',
})
export class ProgramCreateModalComponent {
  programForm: FormGroup;

  previous_image_id: number | null = null;
  previous_image: string | null = null;

  constructor(
    private ref: DynamicDialogRef,
    private fb: FormBuilder,
    private config: DynamicDialogConfig,
    private apiService: ApiService,
  ) {
    this.programForm = this.fb.group({
      id: -1,
      name: ['', Validators.required],
      description: '',
      image: null,
      image_id: null,
    });

    if (this.config.data) {
      let image = this.config.data.image;
      this.programForm.patchValue({
        ...this.config.data,
        image: image ? `${this.apiService.assetsBaseUrl}/${image}` : null,
      });
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        if (this.programForm.get('image_id')?.value) {
          this.previous_image_id = this.programForm.get('image_id')?.value;
          this.previous_image = this.programForm.get('image')?.value;
          this.programForm.get('image_id')?.setValue(null);
        }

        this.programForm.get('image')?.setValue(e.target?.result as string);
        this.programForm.get('image')?.markAsDirty();
      };

      reader.readAsDataURL(file);
    }
  }

  clearImage() {
    this.programForm.get('image')?.setValue(null);

    if (this.previous_image && this.previous_image_id) {
      this.programForm.get('image_id')?.setValue(this.previous_image_id);
      this.programForm.get('image')?.setValue(this.previous_image);
    }
  }

  closeDialog() {
    // Normalize data for API POST
    let ret = this.programForm.value;
    this.ref.close(ret);
  }
}
