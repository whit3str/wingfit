import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ApiService } from '../../services/api.service';
import { DialogService } from 'primeng/dynamicdialog';
import { UtilsService } from '../../services/utils.service';
import { Bloc, StashBloc } from '../../types/bloc';
import { BlocCreateModalComponent } from '../../modals/bloc-create-modal/bloc-create-modal.component';
import { SkeletonModule } from 'primeng/skeleton';
import { ToolbarModule } from 'primeng/toolbar';
import { YesNoModalComponent } from '../../modals/yes-no-modal/yes-no-modal.component';
import { StashHelpModalComponent } from '../../modals/stash-help-modal/stash-help-modal.component';

@Component({
  selector: 'app-stash',
  imports: [ButtonModule, CardModule, SkeletonModule, ToolbarModule],
  standalone: true,
  templateUrl: './stash.component.html',
  styleUrl: './stash.component.scss',
})
export class StashComponent {
  blocs: StashBloc[] = [];

  constructor(
    private apiService: ApiService,
    private dialogService: DialogService,
    private utilsService: UtilsService,
  ) {
    this.apiService.getStash().subscribe({
      next: (blocs) => (this.blocs = blocs),
    });
  }

  blocClicked(stash_bloc: Partial<Bloc>) {
    let modal = this.dialogService.open(BlocCreateModalComponent, {
      header: 'Create from Stash',
      modal: true,
      closable: true,
      focusOnShow: false,
      dismissableMask: true,
      width: '40vw',
      breakpoints: {
        '960px': '80vw',
        '640px': '90vw',
      },
      data: { ...stash_bloc, id: -1 }, // id: -1 to ensure the modal does not use ID (button would display Update instead of Create)
    });

    modal.onClose.subscribe((bloc: Bloc | null) => {
      if (bloc) {
        this.apiService.postBloc(bloc).subscribe({
          next: (_) => {
            this.utilsService.toast(
              'success',
              'Success',
              'Bloc added to planning',
            );
            this.apiService.deleteStash(stash_bloc.id!).subscribe({
              next: (_) => {
                let stashIndex =
                  this.blocs.findIndex((b) => b.id == stash_bloc.id) || -1;
                if (stashIndex > -1) {
                  this.blocs.splice(stashIndex, 1);
                }
              },
            });
          },
        });
      }
    });
  }

  removeAllStash() {
    let modal = this.dialogService.open(YesNoModalComponent, {
      header: 'Confirm',
      modal: true,
      closable: true,
      dismissableMask: true,
      breakpoints: {
        '640px': '90vw',
      },
      data: `Remove every blocs ?`,
    });

    modal.onClose.subscribe((bool) => {
      if (bool) {
        this.apiService.removeAllStash().subscribe((_) => {
          this.blocs = [];
        });
      }
    });
  }

  showHelp() {
    this.dialogService.open(StashHelpModalComponent, {
      header: 'iOS Shortcut Help',
      modal: true,
      closable: true,
      dismissableMask: true,
      width: '30vw',
      breakpoints: {
        '960px': '50vw',
        '640px': '90vw',
      },
    });
  }
}
