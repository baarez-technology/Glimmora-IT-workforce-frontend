/** Account, routing, contact, project and activity types (Phase 4). */

export type AccountType =
  | 'CUSTOMER'
  | 'PARTNER'
  | 'PRIME_CONTRACTOR'
  | 'VENDOR_MSP'
  | 'PROSPECT';

export type RelationshipStatus = 'ACTIVE' | 'DORMANT' | 'TARGET' | 'BLOCKED';

export type RelationType = 'SUBCONTRACTS_THROUGH' | 'PRIME_FOR' | 'PARTNER_OF' | 'VENDOR_TO';

export type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

export type ActivityType =
  | 'CALL'
  | 'EMAIL'
  | 'NOTE'
  | 'MEETING'
  | 'TASK'
  | 'STATUS_CHANGE'
  | 'SYSTEM';

/**
 * Which Addressability inputs this account currently satisfies.
 * Phase 9 turns these into a score; Phase 4 only reports what is still missing.
 */
export interface AddressabilitySignals {
  contract_outsourcing_friendly: boolean;
  existing_customer: boolean;
  partner_or_prime_route: boolean;
  approved_vendor: boolean;
  decision_maker_known: boolean;
  signals_met: number;
  signals_total: number;
  missing: string[];
}

export interface Account {
  id: string;
  name: string;
  legal_name: string | null;
  account_type: AccountType;
  relationship_status: RelationshipStatus;
  country: string | null;
  city: string | null;
  industry: string | null;
  website: string | null;
  is_existing_customer: boolean;
  is_existing_partner: boolean;
  is_approved_vendor: boolean;
  has_msa: boolean;
  contract_outsourcing_friendly: boolean;
  payment_terms_days: number | null;
  owner_id: string | null;
  owner_name: string | null;
  notes: string | null;
  tags: string[] | null;
  contact_count: number;
  project_count: number;
  decision_maker_count: number;
  route_count: number;
  addressability: AddressabilitySignals | null;
  created_at: string;
  updated_at: string;
}

export interface AccountRoute {
  id: string;
  from_account_id: string;
  to_account_id: string;
  to_account_name: string | null;
  to_account_type: AccountType | null;
  relation_type: RelationType;
  is_preferred_route: boolean;
  notes: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  account_id: string;
  account_name: string | null;
  full_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  is_decision_maker: boolean;
  is_primary: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Technology {
  id: string;
  name: string;
  category: string | null;
}

export interface Project {
  id: string;
  account_id: string;
  account_name: string | null;
  name: string;
  code: string | null;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  prime_contractor_id: string | null;
  prime_contractor_name: string | null;
  owner_id: string | null;
  technologies: Technology[];
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  activity_type: ActivityType;
  subject: string;
  body: string | null;
  outcome: string | null;
  occurred_at: string;
  follow_up_at: string | null;
  completed_at: string | null;
  is_follow_up_open: boolean;
  is_follow_up_overdue: boolean;
  user_id: string | null;
  user_name: string | null;
  account_id: string | null;
  account_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  project_id: string | null;
  project_name: string | null;
  created_at: string;
}
