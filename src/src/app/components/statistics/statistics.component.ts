import { Component } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ToolbarModule } from 'primeng/toolbar';
import { ChartModule } from 'primeng/chart';
import { MinutesToHoursPipe } from '../../shared/minutesToHour.pipe';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { HealthwatchUploadModalComponent } from '../../modals/healthwatch-upload-modal/healthwatch-upload-modal.component';
import { UtilsService } from '../../services/utils.service';

export interface StatGauge {
  first: number;
  last: number;
  average_pct: number;
  q_start_pct: number;
  q_end_pct: number;
}

@Component({
  selector: 'app-statistics',
  imports: [
    CardModule,
    ButtonModule,
    MinutesToHoursPipe,
    SkeletonModule,
    ChartModule,
    ToolbarModule,
  ],
  standalone: true,
  templateUrl: './statistics.component.html',
  styleUrl: './statistics.component.scss',
})
export class StatisticsComponent {
  year: number = new Date().getFullYear();
  isMobile =
    window.screen.width < 768 || navigator.userAgent.indexOf('Mobi') > -1;

  categoryDurationPerWeek: any;
  durationsByCategory: any;
  strainRecoveryComboGraph: any;

  averageSleepDuration = 0;
  averageStrain = 0;
  averageRecovery = 0;
  averageHRV = 0;
  averageRestingHR = 0;
  totalWorkoutsHours = 0;

  strainGauge: StatGauge | undefined;
  recoveryGauge: StatGauge | undefined;
  hrvGauge: StatGauge | undefined;

  pieGraphOptions = {
    maintainAspectRatio: false,
    responsive: true,
    animation: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (tooltipItem: any) => {
            return (
              ` ${(tooltipItem.raw / 60) ^ 0}`.slice(-2) +
              'h' +
              ('0' + (tooltipItem.raw % 60)).slice(-2)
            );
          },
        },
      },
    },
  };

  stackedGraphOptions = {
    maintainAspectRatio: false,
    aspectRatio: 0.75,
    responsive: true,
    animation: false,
    indexAxis: 'x',
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false,
        },
      },
      y: {
        stacked: true,
        ticks: {
          callback: (value: number) =>
            `${(value / 60) ^ 0}`.slice(-2) +
            'h' +
            ('0' + (value % 60)).slice(-2),
        },
      },
    },
    plugins: {
      tooltip: {
        mode: 'index',
        intersect: false,
        itemSort: function (a: any, b: any) {
          return b.dataset.order - a.dataset.order;
        },
        callbacks: {
          title: (tooltipItems: any) => {
            return tooltipItems.length
              ? this.getWeekRange(tooltipItems[0].label)
              : '';
          },
          label: (tooltipItem: any) => {
            const value = tooltipItem.raw;
            return value !== 0
              ? ` ${tooltipItem.dataset.label}: ${value} min`
              : '';
          },
        },
        filter: (tooltipItem: any) => tooltipItem.raw !== 0,
      },
    },
  };

  comboGraphOptions = {
    maintainAspectRatio: false,
    aspectRatio: 0.75,
    responsive: true,
    animation: false,
    plugins: {},
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      yStrain: {
        type: 'linear',
        display: true,
        position: 'left',
        ticks: {
          color: '#3b82f6',
        },
      },
      yRecovery: {
        type: 'linear',
        display: true,
        position: 'right',
        ticks: {
          color: '#15803d',
        },
      },
    },
  };

  constructor(
    private apiService: ApiService,
    private utilsService: UtilsService,
    private dialogService: DialogService,
  ) {
    if (this.isMobile) {
      let options: any = {};
      options.indexAxis = 'y';
      options.aspectRatio = 0.3;
      options.scales = {
        x: {
          stacked: true,
          grid: {
            display: false,
          },
          ticks: {
            callback: (value: number) =>
              `${(value / 60) ^ 0}`.slice(-2) +
              'h' +
              ('0' + (value % 60)).slice(-2),
          },
        },
        y: {
          stacked: true,
          ticks: {},
        },
      };

      this.stackedGraphOptions = { ...this.stackedGraphOptions, ...options };
    }
    this.getData();
  }

  getData() {
    this.apiService.getWeeklyDurationTotal(this.year).subscribe({
      next: (data) => {
        this.totalWorkoutsHours = data.reduce(
          (sum, entry) => sum + entry.duration,
          0,
        );
      },
    });

    this.apiService.getHealthWatchData(this.year).subscribe({
      next: (data) => {
        if (!data.length) {
          this.averageSleepDuration = 0;
          this.averageHRV = 0;
          this.averageRestingHR = 0;
          this.averageStrain = 0;
          this.averageRecovery = 0;
          this.strainRecoveryComboGraph = { labels: [], datasets: [] };
          this.strainGauge = undefined;
          this.recoveryGauge = undefined;
          this.hrvGauge = undefined;
          return;
        }

        data.sort(
          (a, b) => new Date(a.cdate).getTime() - new Date(b.cdate).getTime(),
        );

        const totals = {
          sleep: 0,
          hrv: 0,
          strain: 0,
          recovery: 0,
          restingHR: 0,
        };
        const labels: string[] = [];
        const strainData: number[] = [];
        const recoveryData: number[] = [];
        const hrvData: number[] = [];
        const count = data.length;

        data.forEach((d) => {
          totals.sleep += d.sleep_duration_total;
          totals.hrv += d.hrv;
          totals.strain += d.strain;
          totals.recovery += d.recovery;
          totals.restingHR += d.resting_hr;

          labels.push(
            new Date(d.cdate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            }),
          );
          strainData.push(d.strain);
          recoveryData.push(d.recovery);
          hrvData.push(d.hrv);
        });

        this.strainRecoveryComboGraph = {
          labels: labels,
          datasets: [
            {
              label: 'Strain',
              data: strainData,
              fill: false,
              yAxisID: 'yStrain',
              borderColor: '#3b82f6',
              tension: '0.4',
            },
            {
              label: 'Recovery',
              data: recoveryData,
              fill: false,
              yAxisID: 'yRecovery',
              borderColor: '#15803d',
              tension: '0.4',
            },
          ],
        };

        this.averageSleepDuration = totals.sleep / count;
        this.averageHRV = Math.round(totals.hrv / count);
        this.averageRestingHR = Math.round(totals.restingHR / count);
        this.averageStrain = +(totals.strain / count).toFixed(1);
        this.averageRecovery = Math.round(
          +(totals.recovery / count).toFixed(1),
        );

        const sortedStrain = new Float64Array(strainData).sort();
        const maxStrain = sortedStrain[sortedStrain.length - 1];
        this.strainGauge = {
          first: sortedStrain[0],
          last: maxStrain,
          average_pct: (100 * this.averageStrain) / maxStrain,
          q_start_pct: (100 * this.getQuartile(0.25, sortedStrain)) / maxStrain,
          q_end_pct: (100 * this.getQuartile(0.75, sortedStrain)) / maxStrain,
        };

        const sortedRecovery = new Float64Array(recoveryData).sort();
        const maxRecovery = sortedRecovery[sortedRecovery.length - 1];
        this.recoveryGauge = {
          first: sortedRecovery[0],
          last: maxRecovery,
          average_pct: this.averageRecovery,
          q_start_pct: this.getQuartile(0.25, sortedRecovery),
          q_end_pct: this.getQuartile(0.75, sortedRecovery),
        };

        const sortedHRV = new Float64Array(hrvData).sort();
        const maxHRV = sortedHRV[sortedHRV.length - 1];
        this.hrvGauge = {
          first: sortedHRV[0],
          last: maxHRV,
          average_pct: (100 * this.averageHRV) / maxHRV,
          q_start_pct: (100 * this.getQuartile(0.25, sortedHRV)) / maxHRV,
          q_end_pct: (100 * this.getQuartile(0.75, sortedHRV)) / maxHRV,
        };
      },
    });

    this.apiService.getWeeklyDuration(this.year).subscribe({
      next: (data) => {
        if (!data.length) {
          this.durationsByCategory = { labels: [], datasets: [] };
          this.categoryDurationPerWeek = { labels: [], datasets: [] };
          return;
        }

        this.durationsByCategory = {
          labels: data.map((c) => c.label),
          datasets: [
            {
              data: data.map((c) =>
                c.data.reduce((sum, value) => sum + value, 0),
              ),
              backgroundColor: data.map((c) => c.backgroundColor),
            },
          ],
        };

        this.categoryDurationPerWeek = {
          labels: [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
            20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
            37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52,
          ],
          datasets: data.map((d) => {
            return { ...d, type: 'bar' };
          }),
        };
      },
    });
  }

  getQuartile = (q: number, arr: Float64Array): number => {
    const pos = q * (arr.length - 1);
    const lower = Math.floor(pos);
    const upper = Math.ceil(pos);

    return lower === upper
      ? arr[lower]
      : arr[lower] + (arr[upper] - arr[lower]) * (pos - lower);
  };

  nextYear() {
    this.year = this.year + 1;
    this.getData();
  }

  previousYear() {
    this.year = this.year - 1;
    this.getData();
  }

  getWeekRange(weekNumber: number): string {
    const firstDayOfYear = new Date(this.year, 0, 1);
    const daysOffset = (weekNumber - 1) * 7;
    const firstWeekStart =
      firstDayOfYear.getDate() - firstDayOfYear.getDay() + 1;

    const fromDate = new Date(this.year, 0, firstWeekStart + daysOffset);
    const toDate = new Date(fromDate);
    toDate.setDate(fromDate.getDate() + 6);

    const formatDate = (date: Date) =>
      date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

    return `${formatDate(fromDate)} - ${formatDate(toDate)}`;
  }

  healthWatchUpload() {
    const modal: DynamicDialogRef = this.dialogService.open(
      HealthwatchUploadModalComponent,
      {
        header: 'Import data',
        modal: true,
        appendTo: 'body',
        closable: true,
        dismissableMask: true,
        width: '30vw',
        breakpoints: {
          '960px': '60vw',
          '640px': '90vw',
        },
      },
    );

    modal.onClose.subscribe({
      next: (formData: FormData | null) => {
        if (formData) {
          this.apiService.postWhoopData(formData).subscribe({
            next: (resp) => {
              const count = resp.count;
              this.utilsService.toast(
                'info',
                'Success',
                `${count} entr${count > 1 ? 'ies' : 'y'} imported`,
              );
              if (count) this.getData();
            },
          });
        }
      },
    });
  }
}
