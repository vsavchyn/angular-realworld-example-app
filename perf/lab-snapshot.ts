import type { AppKind, DistAsset } from './app-profile.ts';

export type LabVitals = {
  lcp: number;
  cls: number;
  tbt: number;
};

export type PageName = 'home' | 'login' | 'article';

export type LabSnapshot = {
  app: AppKind;
  collectedAt: string;
  samplesPerPage: number;
  budgets: {
    lcpMs: number;
    cls: number;
    tbtMs: number;
    mainJsBytes: number;
  };
  vitals: Record<PageName, { samples: LabVitals[]; median: LabVitals }>;
  bundle: {
    js: DistAsset[];
    css: DistAsset[];
    totalJs: number;
    totalJsGzip: number;
    mainJs: DistAsset | null;
  };
};

export const PAGE_NAMES = ['home', 'login', 'article'] as const satisfies readonly PageName[];

export const LAB_BUDGETS = {
  lcpMs: 2500,
  cls: 0.1,
  tbtMs: 300,
} as const;
