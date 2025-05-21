import { Component } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ToolbarModule } from 'primeng/toolbar';
import { ChartModule } from 'primeng/chart';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { MinutesToHoursPipe } from '../../shared/minutesToHour.pipe';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { HealthwatchUploadModalComponent } from '../../modals/healthwatch-upload-modal/healthwatch-upload-modal.component';
import { UtilsService } from '../../services/utils.service';
import { FormsModule } from '@angular/forms';
import { forkJoin, map, tap } from 'rxjs';
import { processHealthData } from './health-processing';
import { processDurationsData } from './duration-processing';
import { StatGauge, Trend } from '../../types/stats';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-statistics',
  imports: [
    FormsModule,
    CardModule,
    ButtonModule,
    MinutesToHoursPipe,
    SkeletonModule,
    ChartModule,
    ToolbarModule,
    ToggleButtonModule,
    CommonModule,
  ],
  standalone: true,
  templateUrl: './statistics.component.html',
  styleUrl: './statistics.component.scss',
})
export class StatisticsComponent {
  year: number = new Date().getFullYear();
  today: Date = new Date();
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

  latestOnly = true;

  sleepTrend: Trend | undefined;
  restingHRTrend: Trend | undefined;
  hrvTrend: Trend | undefined;
  strainTrend: Trend | undefined;
  recoveryTrend: Trend | undefined;

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
    plugins: {
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
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

  loadHealthData() {
    this.apiService.getHealthWatchData(this.year).subscribe((data) => {
      const result = processHealthData(data, this.latestOnly);

      this.averageSleepDuration = result.averages.sleep;
      this.averageStrain = result.averages.strain;
      this.averageRecovery = result.averages.recovery;
      this.averageHRV = result.averages.hrv;
      this.averageRestingHR = result.averages.restingHR;

      this.strainRecoveryComboGraph = result.strainRecoveryComboGraph;

      this.strainGauge = result.gauges.strain;
      this.recoveryGauge = result.gauges.recovery;
      this.hrvGauge = result.gauges.hrv;

      if (result.trends) {
        this.strainTrend = result.trends.strain;
        this.recoveryTrend = result.trends.recovery;
        this.hrvTrend = result.trends.hrv;
        this.restingHRTrend = result.trends.restingHR;
      }
    });
  }

  getData() {
    forkJoin({
      total: this.apiService.getWeeklyDurationTotal(this.year),
      health: this.apiService.getHealthWatchData(this.year),
      durations: this.apiService.getWeeklyDuration(this.year),
    })
      .pipe(
        tap(({ total }) => {
          this.totalWorkoutsHours = total.reduce(
            (sum, e) => sum + e.duration,
            0,
          );
        }),
        map(({ health, durations }) => {
          return {
            healthResult: processHealthData(health, this.latestOnly),
            durationsResult: processDurationsData(durations),
          };
        }),
        tap(({ healthResult, durationsResult }) => {
          Object.assign(this, durationsResult);

          this.averageSleepDuration = healthResult.averages.sleep;
          this.averageStrain = healthResult.averages.strain;
          this.averageRecovery = healthResult.averages.recovery;
          this.averageHRV = healthResult.averages.hrv;
          this.averageRestingHR = healthResult.averages.restingHR;

          this.strainRecoveryComboGraph = healthResult.strainRecoveryComboGraph;

          this.strainGauge = healthResult.gauges.strain;
          this.recoveryGauge = healthResult.gauges.recovery;
          this.hrvGauge = healthResult.gauges.hrv;

          if (healthResult.trends) {
            this.sleepTrend = healthResult.trends.sleep;
            this.strainTrend = healthResult.trends.strain;
            this.recoveryTrend = healthResult.trends.recovery;
            this.hrvTrend = healthResult.trends.hrv;
            this.restingHRTrend = healthResult.trends.restingHR;
          }
        }),
      )
      .subscribe();
  }

  toggleDataRange() {
    this.latestOnly = !this.latestOnly;
    this.loadHealthData();
  }

  nextYear() {
    this.year = this.year + 1;
    this.latestOnly = this.year == this.today.getFullYear();
    this.getData();
  }

  previousYear() {
    this.year = this.year - 1;
    this.latestOnly = this.year == this.today.getFullYear();
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
