import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { UtilsService } from '../../services/utils.service';

@Component({
  selector: 'app-coming-soon',
  imports: [ButtonModule],
  standalone: true,
  templateUrl: './coming-soon.component.html',
  styleUrl: './coming-soon.component.scss',
})
export class ComingSoonComponent {
  utilsService = inject(UtilsService);

  toGithubWingfit() {
    this.utilsService.toGithubWingfit();
  }
}
