/**
 * The individual job feed.
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
  ONSITE: number;
  REMOTE: number;
  HYBRID: number;
  UNKNOWN: number;
}

export interface JobFeedQuery {
  workplace_type?: WorkplaceType | '';
  unread_only?: boolean;
  saved_only?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface AddJobInput {
  title: string;
  company_name?: string | null;
  location?: string | null;
  country?: string | null;
  workplace_type?: WorkplaceType | null;
  description?: string | null;
  url?: string | null;
  posted_at?: string | null;
}

export interface RegisterInput {
  email: string;
  full_name: string;
  password: string;
}

export interface RegisteredUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
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

/* ---------------------------------------------------------- job alerts */

export interface AlertConnection {
  enabled: boolean;
  forwarding_address: string;
  /** Derived from mail actually received, never from a flag somebody set. */
  verified: boolean;
  count: number;
  last_received_at: string | null;
}

export interface AlertIngestResult {
  recognised: boolean;
  added: number;
  unparsed: number;
  message: string | null;
}
