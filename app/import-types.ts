import type { Song } from "./catalog";

export type ManagedSong = Song & {
  editorial?: {
    genre?: string;
    level?: string;
    notes?: string;
    source?: string;
    tags?: string[];
  };
  path: string;
};

export type ManagedDossier = {
  assetCount: number;
  creators: {
    name: string;
    role: string;
  }[];
  currentDecision: {
    decidedAt: string;
    decidedBy: string;
    id: string;
    justification: string;
    status: string;
  } | null;
  editionCount: number;
  editions: {
    id: string;
    status: string;
    title: string;
  }[];
  publicCatalogId: string | null;
  publicable: boolean;
  blockedPromotionRights: string[];
  projectionIssues: string[];
  rightsStatus: string;
  sources: {
    id: string;
    reference: string | null;
    title: string;
    type: string;
  }[];
  status: string;
  title: string;
  workId: string;
};

export type PromotionReviewResponse = {
  code?: string;
  editions?: {
    id: string;
    notationProfile: {
      instrument?: "piano" | "violao";
      justification?: string;
      kind: "lead_sheet" | "partitura_instrumental_original";
    };
    status: string;
    title: string;
  }[];
  error?: string;
  fingerprint?: string;
  gates?: {
    blockedRights: string[];
    curationAccepted: boolean;
    editionValid: boolean;
    ready: boolean;
    researchComplete: boolean;
    researchPending: string[];
  };
  preferredEditionId?: string | null;
  rights?: {
    basis: string;
    confirmedAt: string | null;
    confirmedBy: string;
    status: string;
  };
  updated?: boolean;
  work?: {
    creators: { name: string; role: string }[];
    id: string;
    title: string;
  };
};

export type ImportLibraryResponse = {
  dossiers?: ManagedDossier[];
  error?: string;
  songs?: ManagedSong[];
};

export type ReviewCapture = {
  canonicalSha256: string;
  captureId: string;
  capturedAt: string;
  confirmedAt: string;
  editionId: string;
  metadata: {
    composer: string;
    key: string;
    partCount: number;
    title: string;
  };
  promoted: boolean;
  state: string;
  technicalOrigin: string;
  workId: string;
};

export type ImportReviewResponse = {
  captureIssues?: { captureId: string; code: string }[];
  captures?: ReviewCapture[];
  coverage?: {
    method: {
      counting: string;
      percentages: false;
      workCount: string;
      zeroRows: string;
    };
    rows: {
      contextualiza: number;
      contradiz: number;
      criterion: string;
      evidenceCount: number;
      sustenta: number;
      workCount: number;
      workIds: string[];
    }[];
  };
  dossiers?: ManagedDossier[];
  error?: string;
  reviewReport?: {
    filePath: string;
    label: string;
    pending: string[];
  }[];
};

export type EditableEdition = {
  genre: string;
  id: string;
  level: string;
  notes: string;
  source: string;
  status: string;
  tags: string[];
  title: string;
};

export type EditionEditorResponse = {
  code?: string;
  editions?: EditableEdition[];
  error?: string;
  fingerprint?: string;
  preferredEditionId?: string | null;
  updated?: boolean;
  work?: {
    creators: { name: string; role: string }[];
    id: string;
    title: string;
  };
};
