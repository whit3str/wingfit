import { Component, OnDestroy } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ButtonModule } from 'primeng/button';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ApiService } from '../../services/api.service';
import { PersonalRecordCreateModalComponent } from '../../modals/personal-record-create-modal/personal-record-create-modal.component';
import { PersonalRecordViewModalComponent } from '../../modals/personal-record-view-modal/personal-record-view-modal.component';
import { PR, PRvalue } from '../../types/personal-record';
import { debounceTime, startWith, Subscription } from 'rxjs';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-personal-records',
  imports: [
    ChartModule,
    CardModule,
    SkeletonModule,
    ToolbarModule,
    InputTextModule,
    DatePipe,
    ButtonModule,
    IconFieldModule,
    ReactiveFormsModule,
    InputIconModule,
  ],
  standalone: true,
  templateUrl: './personal-records.component.html',
  styleUrl: './personal-records.component.scss',
})
export class PersonalRecordsComponent implements OnDestroy {
  subscriptions: Subscription[] = [];
  searchInput = new FormControl('');

  records: PR[] = [];
  displayedRecords: PR[] = [];

  graphOptions = {
    responsive: true,
    animation: false,
    hover: { mode: null },
    scales: {
      x: {
        display: false,
      },
      y: {
        display: false,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
  };

  parseRecord(record: PR): PR {
    if (!record.values || record.values.length === 0) {
      return { ...record, latest_value: null };
    }

    let graphData = null;
    if (record.values.length > 1) {
      graphData = this.renderRecordGraph(record.values);
    }

    const latestValue = this.latestRecordValue(record.values);
    return { ...record, latest_value: latestValue, graph: graphData };
  }

  latestRecordValue(values: PRvalue[]): PRvalue | null {
    return values.reduce((latest, current) =>
      new Date(current.cdate) > new Date(latest.cdate) ? current : latest,
    );
  }

  constructor(
    private apiService: ApiService,
    public dialogService: DialogService,
  ) {
    this.apiService.getPR().subscribe({
      next: (records) => {
        this.records = records.map((record) => this.parseRecord(record));
      },
    });

    this.subscriptions.push(
      this.searchInput.valueChanges
        .pipe(startWith(''), debounceTime(200))
        .subscribe({
          next: (value) => {
            if (value)
              this.displayedRecords = this.records.filter((r) =>
                r.name.toLowerCase().includes(value.toLowerCase()),
              );
            else this.displayedRecords = this.records;
          },
        }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  createPR() {
    const modal: DynamicDialogRef = this.dialogService.open(
      PersonalRecordCreateModalComponent,
      {
        header: 'Create PR',
        modal: true,
        appendTo: 'body',
        closable: true,
        dismissableMask: true,
        data: {},
        width: '30vw',
        breakpoints: {
          '960px': '60vw',
          '640px': '90vw',
        },
      },
    );

    modal.onClose.subscribe((pr: PR | null) => {
      if (pr) {
        this.apiService.postPR(pr).subscribe((PR) => {
          this.records.push(this.parseRecord(PR));
          this.searchInput.setValue(this.searchInput.value); // Trigger displayedRecords filtering
        });
      }
    });
  }

  viewPR(pr: PR) {
    const modal: DynamicDialogRef = this.dialogService.open(
      PersonalRecordViewModalComponent,
      {
        header: pr.name,
        modal: true,
        appendTo: 'body',
        closable: true,
        dismissableMask: true,
        focusOnShow: false,
        data: pr,
        width: '50vw',
        breakpoints: {
          '960px': '75vw',
          '640px': '90vw',
        },
      },
    );

    modal.onClose.subscribe((remove: boolean | null) => {
      if (remove === true) {
        // True is returned if the delete is done
        this.records.splice(
          this.records.findIndex((record) => record.id == pr.id),
          1,
        );
        this.searchInput.setValue(this.searchInput.value);
        return;
      }

      // Modify the Records with the shallow object in place
      this.records[this.records.findIndex((record) => record.id == pr.id)] =
        this.parseRecord(pr);
      this.searchInput.setValue(this.searchInput.value);
    });
  }

  renderRecordGraph(values: PRvalue[]) {
    let sortedValues: PRvalue[] = values.sort(
      (a, b) => new Date(a.cdate).getTime() - new Date(b.cdate).getTime(),
    );

    return {
      labels: sortedValues.map((v) => v.cdate),
      datasets: [
        {
          label: 'PR Values',
          data: sortedValues.map((v) => parseFloat(v.value)),
          borderColor: '#ff6384',
          fill: false,
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    };
  }
}
