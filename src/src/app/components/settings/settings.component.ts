import { Component, ViewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ApiService } from '../../services/api.service';
import { BlocCategory } from '../../types/bloc';
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
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { SkeletonModule } from 'primeng/skeleton';
import { forkJoin, Observable } from 'rxjs';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToolbarModule } from 'primeng/toolbar';
import { RouterLink } from '@angular/router';
import { SettingsPasswordModalComponent } from '../../modals/settings-password-modal/settings-password-modal.component';
import { AuthService } from '../../services/auth.service';
import { SettingsMFAVerifyComponent } from '../../modals/settings-mfa-verify/settings-mfa-verify.component';

@Component({
  selector: 'app-settings',
  imports: [
    CardModule,
    ButtonModule,
    InputTextModule,
    DragDropModule,
    ReactiveFormsModule,
    FormsModule,
    SkeletonModule,
    FloatLabelModule,
    PopoverModule,
    ToolbarModule,
    RouterLink,
  ],
  standalone: true,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  @ViewChild('op') op?: Popover;
  categories: BlocCategory[] = [];
  temporarySortingCategories: BlocCategory[] = [];
  info: Info | undefined;
  user: User | undefined;
  categoryInteracted: BlocCategory | undefined;
  isSortingCategories = false;

  constructor(
    private apiService: ApiService,
    private utilsService: UtilsService,
    private authService: AuthService,
    private dialogService: DialogService,
  ) {
    this.apiService.getCategories().subscribe({
      next: (categories) => (this.categories = categories),
    });

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

  scrollTo(anchor: string) {
    document.getElementById(anchor)?.scrollIntoView();
  }

  check_update() {
    this.apiService.checkVersion().subscribe({
      next: (remote_version) => {
        if (!remote_version)
          this.utilsService.toast(
            'success',
            'Latest version',
            "You're running the latest version of Wingfit",
          );
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

    modal.onClose.subscribe({
      next: (category: BlocCategory | null) => {
        if (category) this.apiService.postCategory(category).subscribe();
      },
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

      modal.onClose.subscribe({
        next: (editedCategory: BlocCategory | null) => {
          if (editedCategory) {
            let categoryModifiedKeysOnly: Partial<BlocCategory> =
              this.utilsService.getModifiedFields(
                selectedCategory,
                editedCategory,
              );
            if (Object.keys(categoryModifiedKeysOnly).length) {
              this.apiService
                .putCategory(selectedCategory.id!, categoryModifiedKeysOnly)
                .subscribe({
                  next: (category) => {
                    category = category;
                  },
                });
            }
          }
        },
      });
    }
  }

  toggleCategoriesSorting() {
    this.isSortingCategories = !this.isSortingCategories;
    if (this.isSortingCategories)
      this.temporarySortingCategories = [...this.categories];
  }

  categoryDrop(event: CdkDragDrop<BlocCategory[]>) {
    moveItemInArray(
      this.temporarySortingCategories,
      event.previousIndex,
      event.currentIndex,
    );
  }

  categoriesSort() {
    let observables$: Observable<BlocCategory>[] = [];
    this.temporarySortingCategories.forEach((c, index) =>
      observables$.push(
        this.apiService.putCategory(c.id, { ...c, weight: index + 1 }), // Min value should be 1 not 0, so +1
      ),
    );

    forkJoin(observables$).subscribe({
      next: (categories: BlocCategory[]) => {
        this.categories = categories;
        this.toggleCategoriesSorting();
        this.temporarySortingCategories = [];
      },
    });
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

            modal.onClose.subscribe({
              next: (bool) => {
                if (bool && selectedCategory)
                  this.apiService
                    .deleteCategory(selectedCategory.id!)
                    .subscribe();
              },
            });
          }
        },
      });
    }
  }

  // MFA
  enableMFA() {
    this.apiService.enableMFA().subscribe({
      next: (secret) => {
        let modal = this.dialogService.open(SettingsMFAVerifyComponent, {
          header: 'Verify MFA',
          modal: true,
          closable: true,
          breakpoints: {
            '640px': '90vw',
          },
          data: {
            message:
              "Add this secret to your authentication app.\nEnter the generated code below to verify it's correct",
            token: secret.secret,
          },
        });

        modal.onClose.subscribe({
          next: (code: string) => {
            if (code)
              this.apiService.verifyMFA(code).subscribe({
                next: (_) => (this.user!.mfa_enabled = true),
              });
          },
          error: (_) => {
            this.utilsService.toast('error', 'Error', 'Error enabling MFA');
          },
        });
      },
    });
  }

  disableMFA() {
    let modal = this.dialogService.open(SettingsMFAVerifyComponent, {
      header: 'Verify MFA',
      modal: true,
      closable: true,
      breakpoints: {
        '640px': '90vw',
      },
    });

    modal.onClose.subscribe({
      next: (code: string) => {
        if (code)
          this.apiService.disableMFA(code).subscribe({
            next: () => (this.user!.mfa_enabled = false),
          });
      },
      error: (_) => {
        this.utilsService.toast('error', 'Error', 'Error disabling MFA');
      },
    });
  }

  updatePassword() {
    let modal = this.dialogService.open(SettingsPasswordModalComponent, {
      header: 'Update Password',
      modal: true,
      closable: true,
      dismissableMask: false,
      breakpoints: {
        '640px': '90vw',
      },
    });

    modal.onClose.subscribe({
      next: (data) => {
        if (!data) return;

        this.apiService.updatePassword(data.current, data.new).subscribe({
          next: (_) => {
            this.utilsService.toast('success', 'Success', 'Password updated.');
            this.authService.logout();
          },
          error: (_) => {
            this.utilsService.toast(
              'error',
              'Error while updating',
              _.error.detail,
            );
          },
        });
      },
    });
  }

  // Access Token
  enableAccessToken() {
    this.apiService.enableAccessToken().subscribe({
      next: (token) => {
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
            data: {
              token: token,
              message:
                "This is your Access Token, save it now as you won't be able to see it again",
            },
          });
        }
      },
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

    modal.onClose.subscribe({
      next: (bool) => {
        if (bool)
          this.apiService.disableAccessToken().subscribe({
            next: (_) => (this.user!.api_token = false),
          });
      },
    });
  }

  exportData() {
    if (!this.user?.mfa_enabled) return;

    const verifyModal = this.dialogService.open(SettingsMFAVerifyComponent, {
      header: 'Verify MFA',
      modal: true,
      closable: true,
      breakpoints: {
        '640px': '90vw',
      },
    });

    verifyModal.onClose.subscribe({
      next: (code: string) => {
        if (!code) return;

        this.apiService.exportData(code).subscribe({
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
      },
    });
  }
}
