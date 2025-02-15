import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { MessageModule } from 'primeng/message';
import { StepperModule } from 'primeng/stepper';

@Component({
  selector: 'app-stash-help-modal',
  imports: [StepperModule, ButtonModule, MessageModule],
  standalone: true,
  templateUrl: './stash-help-modal.component.html',
  styleUrl: './stash-help-modal.component.scss',
})
export class StashHelpModalComponent {
  constructor(
    private ref: DynamicDialogRef,
    private router: Router,
  ) {}

  toSettings() {
    this.router.navigateByUrl('/settings');
    this.close();
  }

  close() {
    this.ref.close();
  }
}
