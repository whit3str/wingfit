import { Component } from '@angular/core';
import { BlocComponent } from '../../shared/bloc/bloc.component';
import { SkeletonModule } from 'primeng/skeleton';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputIconModule } from 'primeng/inputicon';
import { ApiService } from '../../services/api.service';
import { Bloc } from '../../types/bloc';
import { debounceTime, startWith } from 'rxjs';
import { DialogService } from 'primeng/dynamicdialog';
import { ToDateModalComponent } from '../../modals/to-date-modal.component/to-date-modal.component';
import { UtilsService } from '../../services/utils.service';

@Component({
  selector: 'app-history',
  imports: [
    BlocComponent,
    SkeletonModule,
    ToolbarModule,
    InputTextModule,
    ButtonModule,
    IconFieldModule,
    ReactiveFormsModule,
    InputIconModule,
  ],
  standalone: true,
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  searchInput = new FormControl('');
  blocs: Bloc[] = [];
  displayedBlocs: Bloc[] = [];

  constructor(
    private apiService: ApiService,
    private dialogService: DialogService,
    private utilsService: UtilsService,
  ) {
    this.searchInput.valueChanges
      .pipe(startWith(''), debounceTime(200))
      .subscribe({
        next: (value) => {
          if (value) {
            value = value.toLowerCase();
            this.displayedBlocs = this.blocs.filter((b) =>
              b.content.toLowerCase().includes(value!),
            );
          } else {
            this.displayedBlocs = this.blocs;
          }
        },
      });

    this.apiService.getBlocs().subscribe({
      next: (blocs) => {
        this.blocs = blocs.map((bloc) => {
          return { ...bloc, result: undefined };
        }); // No result in history
        this.displayedBlocs = blocs;
      },
    });
  }

  blocClicked(bloc: Bloc) {
    let modal = this.dialogService.open(ToDateModalComponent, {
      header: 'Create on',
      modal: true,
      closable: true,
      focusOnShow: false,
      dismissableMask: true,
      data: { ...bloc },
    });

    modal.onClose.subscribe((date: Date | null) => {
      if (date) {
        // Override result in case it was defined previously
        this.apiService
          .postBloc({
            ...bloc,
            result: undefined,
            cdate: this.utilsService.Iso8601ToStr(date),
          })
          .subscribe({
            next: (_) =>
              this.utilsService.toast(
                'success',
                'Success',
                'Bloc added to planning',
              ),
          });
      }
    });
  }
}
