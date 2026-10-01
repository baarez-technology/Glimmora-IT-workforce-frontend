/**
 * The job offers workspace.
 *
 * A feed item is one person's private copy of a posting. The API returns the
 * two flattened into one object, because the client never needs to reason
 * about the posting separately — only the server deduplicates.
 */

/**
 * Where the work happens.
 *
 * `UNKNOWN` is a real answer. Sources often omit the arrangement, and folding
 * those into ONSITE would mislabel every untagged remote role.
 */
export type WorkplaceType = 'ONSITE' | 'REMOTE' | 'HYBRID' | 'UNKNOWN';

export type JobSource = 'LINKEDIN_ALERT' | 'SEARCH' | 'MANUAL';

export interface JobFeedItem {
  id: string;
  received_at: string;
  is_read: boolean;
  is_saved: boolean;

  /** Set when a colleague passed this across, rather than it arriving alone. */
  shared_by_name: string | null;
  shared_by_role: string | null;
  share_note: string | null;
  shared_at: string | null;
  share_acknowledged: boolean;

  posting_id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  country: string | null;
  workplace_type: WorkplaceType;
  description: string | null;
  url: string | null;
  source: JobSource;
  source_name: string | null;
  posted_at: string | null;
}

export interface JobFeedPage {
  items: JobFeedItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface JobFeedCounts {
  total: number;
  unread: number;
  saved: number;
  shared: number;
  /** Handovers not yet opened — what the tab badge counts. */
  shared_unack: number;
  ONSITE: number;
  REMOTE: number;
  HYBRID: number;
  UNKNOWN: number;
}

export interface JobFeedQuery {
  workplace_type?: WorkplaceType | '';
  unread_only?: boolean;
  saved_only?: boolean;
  shared_only?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface AddJobInput {
  /** Colleagues to hand it to, delivered in the same call as the add. */
  recipient_ids?: string[];
  share_note?: string | null;
  /** Keep it, not just file it. The Saved tab lists exactly these. */
  is_saved?: boolean;
  /** Where it was found. MANUAL by default. */
  source?: 'MANUAL' | 'SEARCH';
  title: string;
  company_name?: string | null;
  location?: string | null;
  country?: string | null;
  workplace_type?: WorkplaceType | null;
  description?: string | null;
  url?: string | null;
  posted_at?: string | null;
}

export interface Colleague {
  id: string;
  full_name: string;
  role: string;
}

export interface ShareInput {
  recipient_ids: string[];
  note?: string | null;
}

export interface ShareResult {
  delivered: number;
}

/* ------------------------------------------------------------ job search */

export type SearchStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface SearchRequest {
  titles: string[];
  locations?: string[];
  workplace_type?: WorkplaceType | null;
  /** '' | 'r2592000' month | 'r604800' week | 'r86400' 24 hours */
  posted_within?: string | null;
  rows?: number;
  /**
   * Ask the three arrangements separately and merge them.
   *
   * The provider only reports `workType` on a search that filtered by it, so
   * an "Any" search returns every row as UNKNOWN and an arrangement filter
   * over those results would match nothing. Thorough costs three provider
   * runs instead of one, which is why it is a choice and not the default.
   */
  thorough?: boolean;
}

export interface SearchStarted {
  search_id: string;
  status: SearchStatus;
}

export interface SearchResult {
  title: string;
  company_name: string | null;
  location: string | null;
  country: string | null;
  workplace_type: WorkplaceType;
  /** True when the arrangement was read out of the job text, not stated. */
  workplace_inferred: boolean;
  description: string | null;
  url: string | null;
  posted_at: string | null;
  external_id: string | null;
}

export interface SearchRun {
  search_id: string;
  status: SearchStatus;
  results: SearchResult[];
  error: string | null;
}

export interface SearchAvailability {
  available: boolean;
  provider: string | null;
}
