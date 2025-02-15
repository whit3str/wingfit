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
import { UtilsService } from '../../services/utils.service';
import { BlocComponent } from '../../shared/bloc/bloc.component';
import { ProgramBloc } from '../../types/program';
import { Observable } from 'rxjs';
import { BlocCategory } from '../../types/bloc';
import { AsyncPipe } from '@angular/common';
import { FocusTrapModule } from 'primeng/focustrap';

@Component({
  selector: 'app-program-create-bloc-modal',
  imports: [
    TabsModule,
    CardModule,
    FloatLabelModule,
    InputTextModule,
    ButtonModule,
    SelectModule,
    BlocComponent,
    FocusTrapModule,
    DatePickerModule,
    ReactiveFormsModule,
    SkeletonModule,
    TextareaModule,
    InputNumberModule,
    AsyncPipe,
  ],
  standalone: true,
  templateUrl: './program-create-bloc-modal.component.html',
  styleUrl: './program-create-bloc-modal.component.scss',
})
export class ProgramCreateBlocModalComponent {
  programBlocForm: FormGroup;
  emojiList: string[] = [];
  categories$?: Observable<BlocCategory[]>;

  constructor(
    private ref: DynamicDialogRef,
    private apiService: ApiService,
    private utilsService: UtilsService,
    private fb: FormBuilder,
    private config: DynamicDialogConfig,
  ) {
    this.categories$ = this.apiService.getCategories();
    this.emojiList = this.utilsService.emojiList;

    this.programBlocForm = this.fb.group({
      id: -1,
      content: ['', Validators.required],
      category: [null, Validators.required],
      duration: [null, Validators.pattern('^[0-9]+$')],
      next_in: [1, Validators.pattern('^[0-9]+$')],
    });

    if (this.config.data) {
      let edit_bloc: ProgramBloc = this.config.data;
      this.programBlocForm.patchValue(edit_bloc);
    }
  }

  addEmoji(content: HTMLTextAreaElement, emoji: string): void {
    this.programBlocForm
      .get('content')
      ?.setValue(this.utilsService.addEmoji(content, emoji));
  }

  closeDialog() {
    // Normalize data for API POST
    let ret = this.programBlocForm.value;
    if (ret['duration']) ret['duration'] = +ret['duration'];
    else delete ret['duration'];

    if (ret['next_in']) ret['next_in'] = +ret['next_in'];
    else delete ret['next_in'];

    this.ref.close(ret);
  }
}
