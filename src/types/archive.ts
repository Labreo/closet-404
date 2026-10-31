export type SiteCategory =
  | 'geocities'
  | 'dotcom'
  | 'oss'
  | 'webring'
  | 'blog'
  | 'netart'
  | 'other';

export interface LiveStatus {
  status: number | null;
  note: string;
}

export interface SiteImage {
  src: string;
  alt: string;
}

export interface SiteForensics {
  title: string;
  metaDescription: string;
  generator: string;
  comments: string[];
  images: SiteImage[];
  links: string[];
  bodyText: string;
}

export type Site = {
  id: string;
  spine: number;
  url: string;
  title: string;
  category: SiteCategory;
  firstCaptured: number;
  lastCaptured: number;
  snapshotTimestamp: string;
  rawUrl: string;
  viewUrl: string;
  liveStatus: LiveStatus;
  forensics: SiteForensics;
  eulogy: string;
  ghostPersona: string;
  vibeTags: string[];
  accentColor: string;
  generatedBy: string;
};


export interface CoronerSource {
  title: string;
  link: string;
  source: string;
  date: string;
  snippet: string;
}

/** Cause-of-death notes: live web search results (SerpApi) summarised by the open-weight model. */
export interface CoronerReport {
  siteId: string;
  query: string;
  searchedAt: string;
  sources: CoronerSource[];
  summary: string;
  generatedBy: string;
}
