import { Component, ViewChild } from '@angular/core';
import { PR, PRvalue } from '../../types/personal-record';
import {
  DialogService,
  DynamicDialogConfig,
  DynamicDialogRef,
} from 'primeng/dynamicdialog';
import { TabsModule } from 'primeng/tabs';
import { CardModule } from 'primeng/card';
import { DecimalPipe } from '@angular/common';
import { UtilsService } from '../../services/utils.service';
import { ButtonModule } from 'primeng/button';
import { ApiService } from '../../services/api.service';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { PersonalRecordCreateValueModalComponent } from '../personal-record-create-value-modal/personal-record-create-value-modal.component';

@Component({
  selector: 'app-personal-record-view-modal',
  imports: [TabsModule, CardModule, DecimalPipe, ButtonModule, MenuModule],
  standalone: true,
  templateUrl: './personal-record-view-modal.component.html',
  styleUrl: './personal-record-view-modal.component.scss',
})
export class PersonalRecordViewModalComponent {
  @ViewChild('recordValueMenu') recordValueMenu?: Menu;

  addMode = false;
  pr: PR;
  score_best: string = '';
  score_recent: string = '';

  recordValueMenuItems: MenuItem[];
  selectedRecordValue: PRvalue | undefined;

  constructor(
    private ref: DynamicDialogRef,
    private dialogService: DialogService,
    private apiService: ApiService,
    private utilsService: UtilsService,
    private config: DynamicDialogConfig,
  ) {
    if (!this.config.data) {
      this.utilsService.toast(
        'danger',
        'Error opening PR',
        'Could not retrieve PR data',
      );
      this.ref.close();
    }

    this.pr = this.config.data; // Shallow copy, mutable object
    this.calculatePercentages();

    this.recordValueMenuItems = [
      {
        label: 'Edit',
        icon: 'pi pi-pencil',
        command: () => {
          this.editValue();
        },
      },
      {
        label: 'Delete',
        icon: 'pi pi-trash',
        command: () => {
          this.deleteRecordValue();
        },
      },
    ];
  }

  get sortedDescendingValues(): PRvalue[] {
    return [...this.pr.values].sort((a, b) => (b.cdate > a.cdate ? 1 : -1));
  }

  calculatePercentages() {
    if (this.pr.values.length) {
      if (this.pr.key != 'time') {
        this.score_best = this.pr.values.reduce(
          (prev: PRvalue, current: PRvalue) =>
            +prev.value > +current.value ? prev : current,
        ).value;
      }
      this.score_recent = this.pr.latest_value?.value || '';
    }
  }

  toggleRecordValueMenu(value: PRvalue, ev: Event) {
    this.selectedRecordValue = value;
    this.recordValueMenu?.toggle(ev);
  }

  deleteRecord() {
    this.apiService.deletePR(this.pr.id).subscribe({
      next: (_) => {
        this.ref.close(true);
      },
      error: (_) => {
        this.utilsService.toast('error', 'Error', 'Error removing the record');
      },
    });
  }

  addValue() {
    const modal: DynamicDialogRef = this.dialogService.open(
      PersonalRecordCreateValueModalComponent,
      {
        header: 'Add values',
        modal: true,
        appendTo: 'body',
        closable: true,
        dismissableMask: true,
        width: '30vw',
        breakpoints: {
          '960px': '60vw',
          '640px': '90vw',
        },
        data: { key: this.pr.key },
      },
    );

    modal.onClose.subscribe((values: PRvalue[] | null) => {
      if (values) {
        this.apiService.postPRvalues(this.pr.id, values).subscribe({
          next: (values) => {
            this.pr.values.push(...values);
            this.calculatePercentages();
          },
          error: (_) =>
            this.utilsService.toast(
              'error',
              'Error',
              'Error updating the value',
            ),
        });
      }
    });
  }

  editValue() {
    if (this.selectedRecordValue) {
      const modal: DynamicDialogRef = this.dialogService.open(
        PersonalRecordCreateValueModalComponent,
        {
          header: 'Update value',
          modal: true,
          appendTo: 'body',
          closable: true,
          dismissableMask: true,
          width: '30vw',
          breakpoints: {
            '960px': '60vw',
            '640px': '90vw',
          },
          data: { key: this.pr.key, value: this.selectedRecordValue },
        },
      );

      modal.onClose.subscribe((values: PRvalue[] | null) => {
        // Returns a list, though always with one element as it's an edit
        if (values) {
          let value = values[0];
          value.id = this.selectedRecordValue!.id;

          // Send the full objet as it's easier and small, not the "difference only"
          this.apiService.putPRValue(this.pr.id, value).subscribe({
            next: (PRValue) => {
              let valueIndex = this.pr.values.findIndex(
                (value) => value.id == this.selectedRecordValue!.id,
              );
              if (valueIndex > -1) this.pr.values![valueIndex] = PRValue;
              this.calculatePercentages();
            },
            error: (_) =>
              this.utilsService.toast(
                'error',
                'Error',
                'Error updating the value',
              ),
          });
        }
      });
    }
  }

  deleteRecordValue() {
    if (this.selectedRecordValue) {
      this.apiService
        .deletePRValue(this.pr.id, this.selectedRecordValue.id)
        .subscribe({
          next: (_) => {
            this.pr.values.splice(
              this.pr.values.findIndex(
                (v) => v.id == this.selectedRecordValue!.id,
              ),
              1,
            );
            this.calculatePercentages();
          },
          error: (_) => {
            this.utilsService.toast(
              'error',
              'Error',
              'Error removing the value',
            );
          },
        });
    }
  }
}
