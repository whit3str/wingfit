import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { BlocComponent } from '../../shared/bloc/bloc.component';
import { Bloc } from '../../types/bloc';

@Component({
  selector: 'app-to-date-modal',
  imports: [
    ButtonModule,
    DatePickerModule,
    FloatLabelModule,
    ReactiveFormsModule,
    BlocComponent,
  ],
  standalone: true,
  templateUrl: './to-date-modal.component.html',
  styleUrl: './to-date-modal.component.scss',
})
export class ToDateModalComponent {
  dateInput = new FormControl(new Date());
  bloc: Bloc | undefined;

  constructor(
    private ref: DynamicDialogRef,
    private config: DynamicDialogConfig,
  ) {
    if (this.config.data) {
      this.bloc = this.config.data;
      delete this.bloc?.result;
    }
  }

  validate() {
    this.ref.close(this.dateInput.value);
  }
}
