import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ApiService } from '../../services/api.service';
import { UtilsService } from '../../services/utils.service';
import { User } from '../../types/user';
import { DialogService } from 'primeng/dynamicdialog';
import { YesNoModalComponent } from '../../modals/yes-no-modal/yes-no-modal.component';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';
import { SettingsViewTokenComponent } from '../../modals/settings-view-token/settings-view-token.component';
import { PopoverModule } from 'primeng/popover';
import { AuthService } from '../../services/auth.service';
import { DatePipe } from '@angular/common';
import { SettingsMFAVerifyComponent } from '../../modals/settings-mfa-verify/settings-mfa-verify.component';

@Component({
  selector: 'app-admin-panel',
  imports: [
    CardModule,
    DatePipe,
    ButtonModule,
    InputTextModule,
    ReactiveFormsModule,
    FormsModule,
    SkeletonModule,
    FloatLabelModule,
    PopoverModule,
    TooltipModule,
    TableModule,
  ],
  standalone: true,
  templateUrl: './admin-panel.component.html',
  styleUrl: './admin-panel.component.scss',
})
export class AdminPanelComponent {
  users: User[] = [];
  selectedUser?: User;
  addUserForm: FormGroup;
  hasMFA: boolean = false;

  constructor(
    private apiService: ApiService,
    private utilsService: UtilsService,
    private fb: FormBuilder,
    private dialogService: DialogService,
  ) {
    // Check if current admin has MFA enabled
    // Could be optimized with a local store
    this.apiService.getSettings().subscribe({
      next: (settings) => (this.hasMFA = settings.mfa_enabled),
    });

    this.addUserForm = this.fb.group({
      username: [
        '',
        {
          validators: Validators.compose([
            Validators.pattern(/^[a-zA-Z0-9_-]{1,19}$/),
            Validators.required,
          ]),
        },
      ],
    });

    this.apiService.getUsers().subscribe({
      next: (users) => (this.users = users),
    });
  }

  addUser() {
    if (!this.addUserForm.get('username')?.value) return;

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

        setTimeout(() => {
          let data = {
            username: this.addUserForm.get('username')?.value,
            password: this.utilsService.basicRandomString(),
            code: code,
          };

          this.addUserForm.reset();
          this.apiService.addUser(data).subscribe({
            next: (user) => {
              this.dialogService.open(SettingsViewTokenComponent, {
                header: 'Password Reset',
                modal: true,
                closable: true,
                dismissableMask: false,
                breakpoints: {
                  '640px': '90vw',
                },
                data: {
                  token: data.password,
                  message: `This is ${user.username} password. Save it now as you won't be able to see it again.\nShare it with him, so he can log in and change his password.`,
                },
              });
              this.users.push(user);
            },
          });
        }, 250);
      },
    });
  }

  resetPassword(user: User) {
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

        setTimeout(() => {
          let modal = this.dialogService.open(YesNoModalComponent, {
            header: 'Reset Password',
            modal: true,
            closable: true,
            dismissableMask: true,
            breakpoints: {
              '640px': '90vw',
            },
            data: `You are about to reset ${user.username} password. Are you sure ?`,
          });

          modal.onClose.subscribe({
            next: (bool) => {
              if (!bool) return;

              let password = this.utilsService.basicRandomString();

              this.apiService
                .resetUserPassword(user.username, password, code)
                .subscribe({
                  next: () => {
                    this.dialogService.open(SettingsViewTokenComponent, {
                      header: 'Password Reset',
                      modal: true,
                      closable: true,
                      dismissableMask: false,
                      breakpoints: {
                        '640px': '90vw',
                      },
                      data: {
                        token: password,
                        message: `This is ${user.username} new password. Save it now as you won't be able to see it again.\nShare it with him, so he can log in and change his password.`,
                      },
                    });
                  },
                });
            },
          });
        }, 250);
      },
    });
  }

  toggleActive(user: User) {
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

        setTimeout(() => {
          const modal_header = user.is_active ? 'Disable User' : 'Enable User';
          const modal_data = user.is_active
            ? `You are about to deactivate the user ${user.username}. They will not be able to log in until you enable their account. Are you sure ?`
            : `You are about to activate the user ${user.username}. They will now be able to log in. Are you sure ?`;

          const modal = this.dialogService.open(YesNoModalComponent, {
            header: modal_header,
            modal: true,
            closable: true,
            dismissableMask: true,
            breakpoints: {
              '640px': '90vw',
            },
            data: modal_data,
          });

          modal.onClose.subscribe({
            next: (bool) => {
              if (!bool) return;
              this.apiService.toggleUserActive(user.username, code).subscribe({
                next: () => (user.is_active = !user.is_active),
              });
            },
          });
        }, 250);
      },
    });
  }

  remove2FA(user: User) {
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

        setTimeout(() => {
          const modal = this.dialogService.open(YesNoModalComponent, {
            header: 'Reset MFA',
            modal: true,
            closable: true,
            dismissableMask: true,
            breakpoints: {
              '640px': '90vw',
            },
            data: `You are about to reset ${user.username} MFA. Are you sure ?`,
          });

          modal.onClose.subscribe({
            next: (bool) => {
              if (!bool) return;

              this.apiService.adminResetMFA(user.username, code).subscribe({
                next: (u) => (user.mfa_enabled = u.mfa_enabled),
              });
            },
          });
        }, 250);
      },
    });
  }

  deleteUser(user: User) {
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

        setTimeout(() => {
          const modal = this.dialogService.open(YesNoModalComponent, {
            header: 'Delete User',
            modal: true,
            closable: true,
            dismissableMask: true,
            breakpoints: {
              '640px': '90vw',
            },
            data: `You are about to delete ${user.username}. Are you sure ?`,
          });

          modal.onClose.subscribe({
            next: (bool) => {
              if (!bool) return;

              setTimeout(() => {
                const confirmmodal = this.dialogService.open(
                  YesNoModalComponent,
                  {
                    header: 'Delete User',
                    modal: true,
                    closable: true,
                    dismissableMask: true,
                    breakpoints: {
                      '640px': '90vw',
                    },
                    data: `Deletion is irreversible. Confirm to delete user ${user.username} and its data.`,
                  },
                );

                confirmmodal.onClose.subscribe({
                  next: (bool) => {
                    if (!bool) return;

                    this.apiService.deleteUser(user.username, code).subscribe({
                      next: () => {
                        this.users.splice(
                          this.users.findIndex(
                            (u) => u.username === user.username,
                          ),
                          1,
                        );
                      },
                    });
                  },
                });
              }, 200);
            },
          });
        }, 200);
      },
    });
  }

  onRestoreFileSelected(e: Event): void {
    const target = e.target as HTMLInputElement;
    const files = target.files as FileList;
    if (files[0]) {
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

          const reader = new FileReader();

          reader.onloadend = () => {
            try {
              JSON.parse(reader.result?.toString() || 'invalid');
            } catch (e: any) {
              this.utilsService.toast(
                'error',
                'Import error',
                `Could not restore data: ${e}`,
              );
              return;
            }

            setTimeout(() => {
              const modal = this.dialogService.open(YesNoModalComponent, {
                header: 'Confirm',
                modal: true,
                closable: true,
                dismissableMask: true,
                breakpoints: {
                  '640px': '90vw',
                },
                data: `Confirm ${files[0].name} data import ? There will be no checks, duplicates could be created`,
              });

              modal.onClose.subscribe({
                next: (bool) => {
                  if (bool) {
                    const formData: FormData = new FormData();
                    formData.append('file', files[0]);
                    formData.append('code', code);

                    this.apiService.adminRestoreData(formData).subscribe({
                      next: () => {
                        this.utilsService.toast(
                          'success',
                          'Success',
                          'Import was successful',
                        );
                      },
                    });
                  }
                },
              });
            }, 500);
          };
          reader.readAsText(files[0]);
        },
      });
    }
  }

  exportData() {
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

        setTimeout(() => {
          this.apiService.adminExportData(code).subscribe({
            next: (data) => {
              const blob = new Blob([JSON.stringify(data)], {
                type: 'application/json',
              });
              const url = window.URL.createObjectURL(blob);
              const today = new Date().toISOString().split('T')[0];

              const a = document.createElement('a');
              a.href = url;
              a.download = `wingfit_full_export_${today}.json`;
              document.body.appendChild(a);
              a.click();

              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            },
          });
        }, 250);
      },
    });
  }
}
