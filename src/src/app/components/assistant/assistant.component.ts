import { Component } from '@angular/core';
import { ComingSoonComponent } from '../../shared/coming-soon/coming-soon.component';

@Component({
  selector: 'app-assistant',
  imports: [ComingSoonComponent],
  standalone: true,
  templateUrl: './assistant.component.html',
  styleUrl: './assistant.component.scss',
})
export class AssistantComponent {}
