import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { InputOtpModule } from 'primeng/inputotp';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings-mfa-verify',
  imports: [ButtonModule, ClipboardModule, InputOtpModule, FormsModule],
  standalone: true,
  templateUrl: './settings-mfa-verify.component.html',
  styleUrl: './settings-mfa-verify.component.scss',
})
export class SettingsMFAVerifyComponent {
  token: string = '';
  message: string = '';
  otp: string = '';

  constructor(
    private ref: DynamicDialogRef,
    private config: DynamicDialogConfig,
  ) {
    if (this.config.data) {
      this.token = this.config.data.token;
      this.message = this.config.data.message;
    }
  }

  close() {
    this.ref.close(this.otp);
  }
}
