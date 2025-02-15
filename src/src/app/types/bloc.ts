export interface Bloc {
  id: number;
  category: BlocCategory;
  content: string;
  cdate: string;
  duration?: number;
  result?: BlocResult;

  next_in?: string; //Injected for ProgramBloc to use BlocComponent for both
}

export interface BlocCategory {
  id: number;
  color: string;
  name: string;
  weight?: number;
}

export interface StashBloc {
  id: number;
  content: string;
  cdate: string;
}

export interface BlocResult {
  key: string;
  value: string;
  comment?: string;
}
