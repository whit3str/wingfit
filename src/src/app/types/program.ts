import { BlocCategory } from './bloc';

export interface Program {
  id: number;
  name: string;
  description: string;
  cdate: string;
  image_id?: number;
  image?: string;
  steps: ProgramStep[];
}

export interface ProgramStep {
  id: number;
  name: string;
  repeat: number;
  next_in: number;
  cdate: string;
  program: string;
  blocs: ProgramBloc[];
}

export interface ProgramBloc {
  id: number;
  content: string;
  duration: number;
  category: BlocCategory;
  next_in: string;
  cdate: string;
}
