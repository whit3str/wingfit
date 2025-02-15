import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Bloc } from '../../types/bloc';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-bloc',
  templateUrl: './bloc.component.html',
  styleUrls: ['./bloc.component.scss'],
  standalone: true,
  imports: [CardModule, ButtonModule, CommonModule],
})
export class BlocComponent {
  @Input() bloc!: Bloc;
  @Input() selected?: boolean = false;
  @Input() wrapEllipsis: boolean = false;
  @Output() clickEmitter = new EventEmitter();

  emit(ev: any) {
    this.clickEmitter.emit(ev);
  }
}
