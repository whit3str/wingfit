export interface PR {
  id: number;
  name: string;
  key: string;
  values: PRvalue[];

  latest_value?: PRvalue | null; //Injected in the PR component
  graph?: any; //Injected in the PR component
}

export interface PRvalue {
  id: number;
  value: string;
  cdate: string;
}
