export type BarrelEntry = {
  sourceText: string;
  meta: {
    file: string;
    line?: number;
    context: string;
    notes?: string;
  };
  placeholders: string[];
  translations: Record<string, string>;
};

export type BarrelRoot = {
  barrel: Record<string, BarrelEntry>;
  files: Record<string, Record<string, string>>;
};
