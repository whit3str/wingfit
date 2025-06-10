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

@Component({
  selector: 'app-admin-panel',
  imports: [
    CardModule,
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

  constructor(
    private apiService: ApiService,
    private utilsService: UtilsService,
    private authService: AuthService,
    private fb: FormBuilder,
    private dialogService: DialogService,
  ) {
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

    let data = {
      username: this.addUserForm.get('username')?.value,
      password: this.utilsService.basicRandomString(),
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
      error: (_) => {
        this.utilsService.toast('error', 'Error', _.error.detail);
        console.log(_);
      },
    });
  }

  resetPassword(user: User) {
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

        this.apiService.resetUserPassword(user.username, password).subscribe({
          next: (_) => {
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
          error: (_) => {
            this.utilsService.toast('error', 'Error', _.error.detail);
          },
        });
      },
    });
  }

  toggleActive(user: User) {
    const modal_header = user.is_active ? 'Disable User' : 'Enable User';
    const modal_data = user.is_active
      ? `You are about to deactivate the user ${user.username}. They will not be able to log in until you enable their account. Are you sure ?`
      : `You are about to activate the user ${user.username}. They will now be able to log in. Are you sure ?`;

    let modal = this.dialogService.open(YesNoModalComponent, {
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
        this.apiService.toggleUserActive(user.username).subscribe({
          next: (_) => (user.is_active = !user.is_active),
          error: (_) => {
            this.utilsService.toast('error', 'Error updating', _.error.detail);
          },
        });
      },
    });
  }

  manage2FA(user: User) {}

  deleteUser(user: User) {
    let modal = this.dialogService.open(YesNoModalComponent, {
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

        this.apiService.deleteUser(user.username).subscribe({
          next: (_) => {
            this.users.splice(
              this.users.findIndex((u) => u.username === user.username),
              1,
            );
          },
          error: (_) => {
            this.utilsService.toast('error', 'Error', _.error.detail);
          },
        });
      },
    });
  }

  exportData() {
    this.apiService.adminExportData().subscribe({
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
      error: (_) => {
        this.utilsService.toast(
          'error',
          'Error',
          _.error.detail || 'Error while exporting data',
        );
        console.log(_);
      },
    });
  }
}
