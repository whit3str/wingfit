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
import { Bloc, BlocCategory } from '../../types/bloc';
import { BlocComponent } from '../../shared/bloc/bloc.component';
import { SkeletonModule } from 'primeng/skeleton';
import { Observable } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { UtilsService } from '../../services/utils.service';
import { FocusTrapModule } from 'primeng/focustrap';

@Component({
  selector: 'app-bloc-create-modal',
  imports: [
    TabsModule,
    CardModule,
    FloatLabelModule,
    InputTextModule,
    ButtonModule,
    SelectModule,
    BlocComponent,
    DatePickerModule,
    ReactiveFormsModule,
    SkeletonModule,
    TextareaModule,
    AsyncPipe,
    FocusTrapModule,
  ],
  standalone: true,
  templateUrl: './bloc-create-modal.component.html',
  styleUrl: './bloc-create-modal.component.scss',
})
export class BlocCreateModalComponent {
  blocForm: FormGroup;
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

    this.blocForm = this.fb.group({
      id: -1,
      cdate: [new Date(), Validators.required],
      content: ['', Validators.required],
      category: [null, Validators.required],
      duration: [null, Validators.pattern('^[0-9]+$')],
      program: [{ value: null, disabled: true }],
    });

    if (this.config.data) {
      let edit_bloc: Bloc = this.config.data;
      this.blocForm.patchValue({
        ...edit_bloc,
        cdate: new Date(this.utilsService.dateStrToIso8601(edit_bloc.cdate)),
      });
    }
  }

  addEmoji(content: HTMLTextAreaElement, emoji: string): void {
    this.blocForm
      .get('content')
      ?.setValue(this.utilsService.addEmoji(content, emoji));
  }

  closeDialog() {
    // Normalize data for API POST
    let ret = this.blocForm.value;
    ret['cdate'] = this.utilsService.Iso8601ToStr(ret['cdate']);
    this.ref.close(ret);
  }
}
