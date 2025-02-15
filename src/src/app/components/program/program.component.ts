import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { BadgeModule } from 'primeng/badge';
import { AccordionModule } from 'primeng/accordion';
import { Program, ProgramBloc, ProgramStep } from '../../types/program';
import { ApiService } from '../../services/api.service';
import { UtilsService } from '../../services/utils.service';
import { ActivatedRoute, Router } from '@angular/router';
import { BlocComponent } from '../../shared/bloc/bloc.component';
import { ToDateModalComponent } from '../../modals/to-date-modal.component/to-date-modal.component';
import { DialogService } from 'primeng/dynamicdialog';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { YesNoModalComponent } from '../../modals/yes-no-modal/yes-no-modal.component';
import { ProgramCreateModalComponent } from '../../modals/program-create-modal/program-create-modal.component';
import { ProgramCreateBlocModalComponent } from '../../modals/program-create-bloc-modal/program-create-bloc-modal.component';
import { ProgramCreateStepModalComponent } from '../../modals/program-create-step-modal/program-create-step-modal.component';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-program',
  imports: [
    ToolbarModule,
    ButtonModule,
    BadgeModule,
    AccordionModule,
    MenuModule,
    BlocComponent,
    SkeletonModule,
  ],
  standalone: true,
  templateUrl: './program.component.html',
  styleUrl: './program.component.scss',
})
export class ProgramComponent {
  program: Program | null = null;
  toolbarMenuItems: MenuItem[] | undefined;
  editMode: boolean = false;

  constructor(
    private apiService: ApiService,
    private utilsService: UtilsService,
    private dialogService: DialogService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) {
    if (!this.activatedRoute.snapshot.params['id']) {
      this.utilsService.toast(
        'warn',
        'Invalid Program',
        'Could not retrieve Program ID',
      );
      this.router.navigateByUrl('/programs');
    }

    this.apiService
      .getProgram(this.activatedRoute.snapshot.params['id'])
      .subscribe({
        next: (program) => {
          this.program = program;
        },
      });

    this.toolbarMenuItems = [
      {
        label: 'To planning',
        icon: 'pi pi-calendar',
        command: () => {
          if (
            this.program?.steps.length &&
            this.program.steps.some((s) => !!s.blocs.length)
          ) {
            let modal = this.dialogService.open(ToDateModalComponent, {
              header: 'Beginning on',
              modal: true,
              closable: true,
              focusOnShow: false,
              dismissableMask: true,
            });

            modal.onClose.subscribe((date: Date | null) => {
              if (date) {
                this.programToCalendar(date);
              }
            });
          } else {
            this.utilsService.toast(
              'info',
              'Empty Program',
              'Add Steps and Blocs to your Program to add them to your planning',
              5000,
            );
          }
        },
      },
      {
        label: 'Edit Program',
        icon: 'pi pi-pencil',
        command: () => {
          let modal = this.dialogService.open(ProgramCreateModalComponent, {
            header: `Update ${this.program?.name}`,
            modal: true,
            closable: true,
            dismissableMask: true,
            width: '25vw',
            breakpoints: {
              '960px': '50vw',
              '640px': '90vw',
            },
            data: this.program,
          });

          modal.onClose.subscribe((editedProgram: Program | null) => {
            if (editedProgram && this.program) {
              // If the editedProgram image starts with '/api', it means it was not modified
              // We delete it because /api/assets/image will be different than image, so it would be returned by getModifiedFields
              if (editedProgram.image?.startsWith('/api'))
                delete editedProgram.image;

              let programModifiedKeysOnly: Partial<Program> =
                this.utilsService.getModifiedFields(
                  this.program,
                  editedProgram,
                );
              if (Object.keys(programModifiedKeysOnly).length) {
                this.apiService
                  .putProgram(this.program.id, programModifiedKeysOnly)
                  .subscribe((program) => {
                    this.program = program;
                  });
              }
            }
          });
        },
      },
      {
        label: 'Delete',
        icon: 'pi pi-trash',
        command: () => {
          if (this.program) {
            let modal = this.dialogService.open(YesNoModalComponent, {
              header: 'Confirm deletion',
              modal: true,
              closable: true,
              dismissableMask: true,
              breakpoints: {
                '640px': '90vw',
              },
              data: `Delete ${this.program.name} ?`,
            });

            modal.onClose.subscribe((bool) => {
              if (bool) {
                this.apiService
                  .deleteProgram(this.program!.id)
                  .subscribe((_) => {
                    this.router.navigateByUrl('/programs');
                  });
              }
            });
          }
        },
      },
    ];
  }

  blocClicked(bloc: ProgramBloc) {
    const modal = this.dialogService.open(ToDateModalComponent, {
      header: 'Copy to',
      modal: true,
      closable: true,
      focusOnShow: false,
      dismissableMask: true,
      data: { ...bloc },
    });

    modal.onClose.subscribe((date: Date | null) => {
      if (date) {
        this.apiService
          .postBloc({ ...bloc, cdate: this.utilsService.Iso8601ToStr(date) })
          .subscribe((bloc) => {
            this.utilsService.toast(
              'success',
              'Success',
              `Bloc created on ${this.utilsService.Iso8601ToStr(date)}`,
            );
          });
      }
    });
  }

  enableEditMode() {
    this.editMode = true;
  }

  disableEditMode() {
    this.editMode = false;
  }

  stepAdd() {
    const modal = this.dialogService.open(ProgramCreateStepModalComponent, {
      header: 'Create Step',
      modal: true,
      closable: true,
      focusOnShow: false,
      dismissableMask: true,
    });

    modal.onClose.subscribe((step: ProgramStep | null) => {
      if (step && this.program) {
        this.apiService.postProgramStep(this.program.id, step).subscribe({
          next: (step) => {
            this.program?.steps.push(step);
          },
        });
      }
    });
  }

  stepEdit(step: ProgramStep) {
    const modal = this.dialogService.open(ProgramCreateStepModalComponent, {
      header: 'Update Step',
      modal: true,
      closable: true,
      focusOnShow: false,
      dismissableMask: true,
      data: { ...step },
    });

    modal.onClose.subscribe((editedStep: ProgramStep | null) => {
      if (editedStep) {
        let programStepModifiedKeysOnly: Partial<ProgramStep> =
          this.utilsService.getModifiedFields(step, editedStep);

        if (Object.keys(programStepModifiedKeysOnly).length) {
          this.apiService
            .putProgramStep(
              this.program!.id,
              step.id,
              programStepModifiedKeysOnly,
            )
            .subscribe({
              next: (step) => {
                let stepIndex = this.program!.steps.findIndex(
                  (s) => s.id == step.id,
                );
                if (stepIndex > -1) this.program!.steps[stepIndex] = step;
              },
            });
        }
      }
    });
  }

  stepDelete(stepToRemove: ProgramStep): void {
    let modal = this.dialogService.open(YesNoModalComponent, {
      header: 'Confirm Step deletion',
      modal: true,
      closable: true,
      dismissableMask: true,
      breakpoints: {
        '640px': '90vw',
      },
      data: `Delete ${stepToRemove.name} ?`,
    });

    modal.onClose.subscribe((bool) => {
      if (bool) {
        this.apiService
          .deleteProgramStep(this.program!.id, stepToRemove.id)
          .subscribe({
            next: (_) => {
              let stepIndex = this.program!.steps.findIndex(
                (step) => step.id == stepToRemove.id,
              );
              if (stepIndex > -1) {
                this.program?.steps?.splice(stepIndex, 1);
              }
            },
          });
      }
    });
  }

  stepAddBloc(step_id: number) {
    const modal = this.dialogService.open(ProgramCreateBlocModalComponent, {
      header: 'Create Bloc',
      modal: true,
      closable: true,
      focusOnShow: false,
      dismissableMask: true,
      width: '40vw',
      breakpoints: {
        '960px': '60vw',
        '640px': '90vw',
      },
    });

    modal.onClose.subscribe((bloc: ProgramBloc | null) => {
      if (bloc) {
        this.apiService
          .postProgramStepBloc(this.program!.id, step_id, bloc)
          .subscribe({
            next: (bloc) => {
              this.program?.steps
                .find((step) => step.id == step_id)
                ?.blocs.push(bloc);
            },
          });
      }
    });
  }

  stepEditBloc(step: ProgramStep, bloc: ProgramBloc) {
    const modal = this.dialogService.open(ProgramCreateBlocModalComponent, {
      header: 'Update Bloc',
      modal: true,
      closable: true,
      focusOnShow: false,
      dismissableMask: true,
      width: '40vw',
      breakpoints: {
        '960px': '60vw',
        '640px': '90vw',
      },
      data: { ...bloc },
    });

    modal.onClose.subscribe((editedBloc: ProgramBloc | null) => {
      if (editedBloc) {
        let blocModifiedKeysOnly: Partial<ProgramBloc> =
          this.utilsService.getModifiedFields(bloc, editedBloc);

        if (Object.keys(blocModifiedKeysOnly).length) {
          this.apiService
            .putProgramStepBloc(
              this.program!.id,
              step.id,
              bloc.id,
              blocModifiedKeysOnly,
            )
            .subscribe({
              next: (bloc) => {
                let blocIndex = step.blocs.findIndex((b) => b.id == bloc.id);
                if (blocIndex > -1) step.blocs[blocIndex] = bloc;
              },
            });
        }
      }
    });
  }

  stepDeleteBloc(step: ProgramStep, bloc_id: number): void {
    let modal = this.dialogService.open(YesNoModalComponent, {
      header: 'Confirm Bloc deletion',
      modal: true,
      closable: true,
      dismissableMask: true,
      breakpoints: {
        '640px': '90vw',
      },
      data: 'Delete the Bloc ?',
    });

    modal.onClose.subscribe((bool) => {
      if (bool) {
        this.apiService
          .deleteProgramStepBloc(this.program!.id, step.id, bloc_id)
          .subscribe({
            next: (_) => {
              let blocIndex = step.blocs.findIndex(
                (bloc) => bloc.id == bloc_id,
              );
              if (blocIndex > -1) {
                step.blocs.splice(blocIndex, 1);
              }
            },
          });
      }
    });
  }

  prepareStepBlocs(step: ProgramStep, dateToAddBloc: Date): ProgramBloc[] {
    let blocs: any = [];

    step.blocs.forEach((bloc: ProgramBloc, index: number) => {
      blocs.push({
        ...bloc,
        cdate: this.utilsService.Iso8601ToStr(dateToAddBloc),
      });
      if (index !== step.blocs.length - 1) {
        dateToAddBloc.setDate(dateToAddBloc.getDate() + (+bloc.next_in || 0));
      }
    });

    return blocs;
  }

  stepToCalendar(step: ProgramStep): void {
    let modal = this.dialogService.open(ToDateModalComponent, {
      header: 'Start step on',
      modal: true,
      closable: true,
      focusOnShow: false,
      dismissableMask: true,
    });

    modal.onClose.subscribe((date: Date | null) => {
      if (date) {
        let blocs = this.prepareStepBlocs(step, date);
        this.apiService.postBlocs(blocs).subscribe({
          next: (_) => {
            this.utilsService.toast(
              'success',
              'Success',
              `${blocs.length} bloc${blocs.length > 1 ? 's' : ''} added to planning`,
            );
          },
          error: (_) =>
            this.utilsService.toast(
              'danger',
              'Error creating blocs',
              'An error occured while creating the blocs',
            ),
        });
      }
    });
  }

  programToCalendar(date: Date): void {
    let blocs: any = []; //ProgramBloc has all the same properties as Bloc, with 'next_in' that will be ignored by backend

    this.program!.steps.forEach((step) => {
      for (let repeat = 0; repeat < (step.repeat || 1); repeat++) {
        // Looping over repeat part (if step repeats)
        blocs.push(...this.prepareStepBlocs(step, date)); // Returns an array, we spread (...) to prevent nested array [[{elem}]]
        date.setDate(date.getDate() + +step.next_in); //Next Step will be in 1d
      }
    });

    this.apiService.postBlocs(blocs).subscribe({
      next: (_) => {
        this.utilsService.toast(
          'success',
          'Success',
          `${blocs.length} bloc${blocs.length > 1 ? 's' : ''} added to planning`,
        );
      },
      error: (_) =>
        this.utilsService.toast(
          'danger',
          'Error creating blocs',
          'An error occured while creating the blocs',
        ),
    });
  }
}
