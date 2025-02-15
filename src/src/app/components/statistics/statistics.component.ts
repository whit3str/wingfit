import { Component } from '@angular/core';
import { ComingSoonComponent } from '../../shared/coming-soon/coming-soon.component';

@Component({
  selector: 'app-statistics',
  imports: [ComingSoonComponent],
  standalone: true,
  templateUrl: './statistics.component.html',
  styleUrl: './statistics.component.scss',
})
export class StatisticsComponent {}
