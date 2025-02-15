import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { ToolbarModule } from 'primeng/toolbar';
import { ApiService } from '../../services/api.service';
import { Program } from '../../types/program';
import { TooltipModule } from 'primeng/tooltip';
import { UtilsService } from '../../services/utils.service';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { YesNoModalComponent } from '../../modals/yes-no-modal/yes-no-modal.component';
import { RouterLink } from '@angular/router';
import { ProgramCreateModalComponent } from '../../modals/program-create-modal/program-create-modal.component';

@Component({
  selector: 'app-programs',
  imports: [
    CardModule,
    SkeletonModule,
    ToolbarModule,
    InputTextModule,
    RouterLink,
    TooltipModule,
    ButtonModule,
    IconFieldModule,
    ReactiveFormsModule,
    InputIconModule,
  ],
  standalone: true,
  templateUrl: './programs.component.html',
  styleUrl: './programs.component.scss',
})
export class ProgramsComponent {
  searchInput = new FormControl('');
  programs: Program[] = [];
  displayedPrograms: Program[] = [];

  programIdToTotalBlocs: { [program_id: number]: number } = {};

  constructor(
    private apiService: ApiService,
    private utilsService: UtilsService,
    private dialogService: DialogService,
  ) {
    this.apiService.getPrograms().subscribe({
      next: (programs) => (this.programs = programs),
    });
  }

  createProgram(): void {
    const modal: DynamicDialogRef = this.dialogService.open(
      ProgramCreateModalComponent,
      {
        header: 'Create Program',
        modal: true,
        appendTo: 'body',
        closable: true,
        dismissableMask: true,
        width: '25vw',
        breakpoints: {
          '960px': '50vw',
          '640px': '90vw',
        },
      },
    );

    modal.onClose.subscribe((program: Program | null) => {
      if (program) {
        this.apiService.postProgram(program).subscribe({
          next: (program) => this.programs.push(program),
        });
      }
    });
  }

  onUploadFileSelected(e: Event): void {
    const target = e.target as HTMLInputElement;
    const files = target.files as FileList;

    if (files[0]) {
      const reader = new FileReader();

      reader.onloadend = () => {
        try {
          JSON.parse(reader.result?.toString() || 'invalid');
        } catch (e: any) {
          this.utilsService.toast(
            'error',
            'Import error',
            `Could not import program: ${e}`,
          );
          return;
        }

        const modal = this.dialogService.open(YesNoModalComponent, {
          header: 'Confirm',
          modal: true,
          closable: true,
          dismissableMask: true,
          breakpoints: {
            '640px': '90vw',
          },
          data: `Confirm ${files[0].name} upload ?`,
        });

        modal.onClose.subscribe((bool) => {
          if (bool) {
            const formData: FormData = new FormData();
            formData.append('file', files[0]);

            this.apiService.uploadProgram(formData).subscribe((program) => {
              this.programs.push(program);
            });
          }
        });
      };
      reader.readAsText(files[0]);
    }
  }
}
