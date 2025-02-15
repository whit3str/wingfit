import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { UtilsService } from '../../services/utils.service';

@Component({
  selector: 'app-select-range-date-modal',
  imports: [DatePickerModule, ButtonModule, ReactiveFormsModule],
  standalone: true,
  templateUrl: './select-range-date-modal.component.html',
  styleUrl: './select-range-date-modal.component.scss',
})
export class SelectRangeDateModalComponent {
  dateInput = new FormControl(new Date(), Validators.required);

  constructor(
    private ref: DynamicDialogRef,
    private utilsService: UtilsService,
    private config: DynamicDialogConfig,
  ) {
    if (this.config.data) {
      this.dateInput.setValue(this.config.data);
    }
  }

  closeDialog() {
    if (this.dateInput.value) {
      this.ref.close(this.dateInput.value);
    }
  }
}
