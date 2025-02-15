import { Component, ViewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ApiService } from '../../services/api.service';
import { Observable } from 'rxjs';
import { BlocCategory } from '../../types/bloc';
import { AsyncPipe } from '@angular/common';
import { UtilsService } from '../../services/utils.service';
import { User } from '../../types/user';
import { DialogService } from 'primeng/dynamicdialog';
import { YesNoModalComponent } from '../../modals/yes-no-modal/yes-no-modal.component';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { Popover, PopoverModule } from 'primeng/popover';
import { SettingsCreateCategoryComponent } from '../../modals/settings-create-category/settings-create-category.component';
import { SettingsViewTokenComponent } from '../../modals/settings-view-token/settings-view-token.component';
import { Info } from '../../types/info';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-settings',
  imports: [
    CardModule,
    ButtonModule,
    AsyncPipe,
    InputTextModule,
    SkeletonModule,
    FloatLabelModule,
    PopoverModule,
  ],
  standalone: true,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  @ViewChild('op') op?: Popover;
  categories$: Observable<BlocCategory[]>;
  info: Info | undefined;
  user: User | undefined;
  categoryInteracted: BlocCategory | undefined;

  constructor(
    private apiService: ApiService,
    private utilsService: UtilsService,
    private dialogService: DialogService,
  ) {
    this.categories$ = this.apiService.getCategories();
    this.apiService.getInfo().subscribe({
      next: (info) => (this.info = info),
    });

    this.apiService.getSettings().subscribe({
      next: (settings) => {
        this.user = settings;
      },
    });
  }

  toGithubWingfit() {
    this.utilsService.toGithubWingfit();
  }

  check_update() {
    this.apiService.checkVersion().subscribe({
      next: (remote_version) => {
        if (this.info && remote_version != this.info?.version)
          this.info.update = remote_version;
      },
    });
  }

  // Category
  addCategory() {
    let modal = this.dialogService.open(SettingsCreateCategoryComponent, {
      header: 'Create Category',
      modal: true,
      closable: true,
      dismissableMask: true,
      width: '25vw',
      breakpoints: {
        '960px': '50vw',
        '640px': '90vw',
      },
    });

    modal.onClose.subscribe((category: BlocCategory | null) => {
      if (category) {
        this.apiService.postCategory(category).subscribe();
      }
    });
  }

  editCategory() {
    let selectedCategory = { ...this.categoryInteracted };
    this.op?.hide();

    if (selectedCategory) {
      let modal = this.dialogService.open(SettingsCreateCategoryComponent, {
        header: `Update ${this.categoryInteracted?.name}`,
        modal: true,
        closable: true,
        dismissableMask: true,
        width: '25vw',
        breakpoints: {
          '960px': '50vw',
          '640px': '90vw',
        },
        data: { ...selectedCategory },
      });

      modal.onClose.subscribe((editedCategory: BlocCategory | null) => {
        if (editedCategory) {
          let categoryModifiedKeysOnly: Partial<BlocCategory> =
            this.utilsService.getModifiedFields(
              selectedCategory,
              editedCategory,
            );
          if (Object.keys(categoryModifiedKeysOnly).length) {
            this.apiService
              .putCategory(selectedCategory.id!, categoryModifiedKeysOnly)
              .subscribe((category) => {
                category = category;
              });
          }
        }
      });
    }
  }

  deleteCategory() {
    let selectedCategory = { ...this.categoryInteracted };
    this.op?.hide();

    if (selectedCategory) {
      this.apiService.getCategoryBlocsCount(selectedCategory.id!).subscribe({
        next: (count) => {
          if (count) {
            this.utilsService.toast(
              'error',
              'Category used',
              'You cannot delete a category in use (Planning and Programs blocs)',
              5000,
            );
          } else {
            let modal = this.dialogService.open(YesNoModalComponent, {
              header: 'Confirm deletion',
              modal: true,
              closable: true,
              dismissableMask: true,
              breakpoints: {
                '640px': '90vw',
              },
              data: `Delete ${selectedCategory.name} ?`,
            });

            modal.onClose.subscribe((bool) => {
              if (bool && selectedCategory) {
                this.apiService
                  .deleteCategory(selectedCategory.id!)
                  .subscribe((_) => {});
              }
            });
          }
        },
      });
    }
  }

  // Access Token
  enableAccessToken() {
    this.apiService.enableAccessToken().subscribe((token) => {
      if (token && this.user) {
        this.user.api_token = !!token;
        this.dialogService.open(SettingsViewTokenComponent, {
          header: 'Access Token',
          modal: true,
          closable: true,
          dismissableMask: true,
          breakpoints: {
            '640px': '90vw',
          },
          data: token,
        });
      }
    });
  }

  disableAccessToken() {
    let modal = this.dialogService.open(YesNoModalComponent, {
      header: 'Remove Token',
      modal: true,
      closable: true,
      dismissableMask: true,
      breakpoints: {
        '640px': '90vw',
      },
      data: `Remove your API Token ?`,
    });

    modal.onClose.subscribe((bool) => {
      if (bool) {
        this.apiService.disableAccessToken().subscribe({
          next: (_) => (this.user!.api_token = false),
        });
      }
    });
  }

  exportData() {
    this.apiService.exportData().subscribe({
      next: (data) => {
        const blob = new Blob([JSON.stringify(data)], {
          type: 'application/json',
        });
        const url = window.URL.createObjectURL(blob);
        const today = new Date().toISOString().split('T')[0];

        const a = document.createElement('a');
        a.href = url;
        a.download = `wingfit_export_${today}.json`;
        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
    });
  }
}
