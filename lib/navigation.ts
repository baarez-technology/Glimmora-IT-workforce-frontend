import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  Brain,
  Briefcase,
  Building2,
  CalendarClock,
  ClipboardList,
  Coins,
  Contact,
  FileSearch,
  FileStack,
  FolderKanban,
  Gauge,
  GitCompareArrows,
  Handshake,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  Repeat,
  ScrollText,
  Send,
  ShieldCheck,
  Sliders,
  Target,
  Timer,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import type { Role } from '@/types/api';

/**
 * The application's information architecture.
 *
 * `phase` records which build phase delivers the screen. Anything above
 * CURRENT_PHASE renders an honest "not built yet" page rather than a dead link —
 * navigation is never a fake button.
 */
export const CURRENT_PHASE = 12;

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  phase: number;
  /** Roles allowed to see the item. Cosmetic only — the API enforces access. */
  roles?: Role[];
  /** Permission that makes the item useful. Also cosmetic. */
  permission?: string;
  description?: string;
}

export interface NavSection {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    label: 'Overview',
    icon: LayoutDashboard,
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: Gauge,
        phase: 11,
        description: 'Role-aware view of the demand-to-billing funnel',
      },
    ],
  },
  {
    label: 'Demand',
    icon: Target,
    items: [
      {
        label: 'Requirements',
        href: '/demand/requirements',
        icon: ClipboardList,
        phase: 5,
        permission: 'requirement:read',
        description: 'Every IT resource requirement Glimmora is tracking',
      },
      {
        label: 'Opportunities',
        href: '/demand/opportunities',
        icon: Target,
        phase: 10,
        permission: 'opportunity:read',
        description: 'The pursuit board — scored, staged and owned',
      },
      {
        label: 'Deadlines',
        href: '/demand/deadlines',
        icon: Timer,
        phase: 5,
        permission: 'requirement:read',
        description: 'Submission SLA board — VMS windows are 24–48 hours',
      },
    ],
  },
  {
    label: 'Accounts',
    icon: Building2,
    items: [
      {
        label: 'Customers & Partners',
        href: '/accounts/customers',
        icon: Building2,
        phase: 4,
        permission: 'account:read',
        description: 'Customers, partners, prime contractors and vendors',
      },
      {
        label: 'Contacts',
        href: '/accounts/contacts',
        icon: Contact,
        phase: 4,
        permission: 'contact:read',
        description: 'People, and who the decision makers are',
      },
      {
        label: 'Projects',
        href: '/accounts/projects',
        icon: FolderKanban,
        phase: 4,
        permission: 'project:read',
        description: 'Client projects and their technology stacks',
      },
    ],
  },
  {
    label: 'Talent',
    icon: Users,
    items: [
      {
        label: 'All Resources',
        href: '/talent/resources',
        icon: Users,
        phase: 6,
        permission: 'resource:read',
        description: 'The Glimmora IT Talent Cloud',
      },
      {
        label: 'Available',
        href: '/talent/available',
        icon: UserCheck,
        phase: 6,
        permission: 'resource:read',
        description: 'Ready now or ready soon',
      },
      {
        label: 'Bench',
        href: '/talent/bench',
        icon: Briefcase,
        phase: 6,
        permission: 'resource:read',
        description: 'Unbilled capacity — the number to drive to zero',
      },
      {
        label: 'Documents',
        href: '/talent/documents',
        icon: FileStack,
        phase: 6,
        permission: 'document:read',
        description: 'CVs, visas, work permits and their expiry status',
      },
    ],
  },
  {
    label: 'AI Intelligence',
    icon: Brain,
    items: [
      {
        label: 'Requirement Matching',
        href: '/intelligence/matching',
        icon: GitCompareArrows,
        phase: 7,
        permission: 'matching:read',
        description: 'Demand → Resource, with a full explanation per match',
      },
      {
        label: 'Reverse Matching',
        href: '/intelligence/reverse-matching',
        icon: Repeat,
        phase: 8,
        permission: 'reverse_matching:read',
        description: 'Resource → Demand: where does this person go next?',
      },
      {
        label: 'Opportunity Scoring',
        href: '/intelligence/scoring',
        icon: BadgeCheck,
        phase: 9,
        permission: 'scoring:read',
        description: 'Talent + Addressability + Commercial = Opportunity Score',
      },
      {
        label: 'Commercial Calculator',
        href: '/intelligence/commercial',
        icon: Coins,
        phase: 9,
        permission: 'commercial:run',
        description: 'What-if margin, contract value and profit. Saves nothing',
      },
    ],
  },
  {
    label: 'Sales',
    icon: Handshake,
    items: [
      {
        label: 'Pipeline',
        href: '/sales/pipeline',
        icon: ListChecks,
        phase: 10,
        permission: 'opportunity:read',
        description: 'Requirement identified through to redeployment',
      },
      {
        label: 'Submissions',
        href: '/sales/submissions',
        icon: Send,
        phase: 10,
        permission: 'submission:read',
        description: 'CVs put forward, with duplicate protection',
      },
      {
        label: 'Interviews',
        href: '/sales/interviews',
        icon: CalendarClock,
        phase: 10,
        permission: 'interview:read',
        description: 'Scheduled interviews and outcomes',
      },
      {
        label: 'Activities',
        href: '/sales/activities',
        icon: Activity,
        phase: 4,
        permission: 'activity:read',
        description: 'Calls, emails, notes, meetings and follow-ups',
      },
    ],
  },
  {
    label: 'Deployments',
    icon: FileSearch,
    items: [
      {
        label: 'Active',
        href: '/deployments/active',
        icon: FileSearch,
        phase: 11,
        description: 'Consultants currently deployed and billing',
      },
      {
        label: 'Ending Soon',
        href: '/deployments/ending-soon',
        icon: Timer,
        phase: 11,
        description: '90 / 60 / 30 / 15 / 7-day horizons',
      },
      {
        label: 'Redeployment',
        href: '/deployments/redeployment',
        icon: Repeat,
        phase: 8,
        permission: 'reverse_matching:read',
        description: 'Next billable assignment before the current one ends',
      },
    ],
  },
  {
    label: 'Billing',
    icon: Wallet,
    items: [
      {
        label: 'Active Billing',
        href: '/billing/active',
        icon: Wallet,
        phase: 11,
        roles: ['ADMIN', 'MANAGEMENT', 'SALES'],
        description: 'Monthly billing records per deployment',
      },
      {
        label: 'Revenue',
        href: '/billing/revenue',
        icon: Coins,
        phase: 11,
        roles: ['ADMIN', 'MANAGEMENT', 'SALES'],
        description: 'Monthly billable revenue generated through the engine',
      },
      {
        label: 'Margin',
        href: '/billing/margin',
        icon: BarChart3,
        phase: 11,
        roles: ['ADMIN', 'MANAGEMENT', 'SALES'],
        description: 'Gross profit and margin by account and period',
      },
    ],
  },
  {
    label: 'Notifications',
    icon: Bell,
    items: [
      {
        label: 'Notifications',
        href: '/notifications',
        icon: Bell,
        phase: 12,
        permission: 'notification:read',
        description: 'SLA, document expiry, bench and interview alerts',
      },
    ],
  },
  {
    label: 'Administration',
    icon: ShieldCheck,
    items: [
      {
        label: 'Users',
        href: '/admin/users',
        icon: Users,
        phase: 3,
        roles: ['ADMIN'],
        permission: 'user:read',
        description: 'Accounts and role assignment',
      },
      {
        label: 'Roles',
        href: '/admin/roles',
        icon: ShieldCheck,
        phase: 3,
        permission: 'role:read',
        description: 'The permission matrix',
      },
      {
        label: 'Scoring Rules',
        href: '/admin/scoring',
        icon: Sliders,
        phase: 7,
        permission: 'scoring_config:read',
        description: 'All four rule sets, versioned, with a simulation preview',
      },
      {
        label: 'Audit Logs',
        href: '/admin/audit',
        icon: ScrollText,
        phase: 3,
        roles: ['ADMIN', 'MANAGEMENT'],
        permission: 'audit:view',
        description: 'Who changed what, and when',
      },
      {
        label: 'Import & Export',
        href: '/admin/data',
        icon: FileStack,
        phase: 12,
        permission: 'export:run',
        description: 'Excel import with a preview step, and filtered exports',
      },
      {
        label: 'System Status',
        href: '/system',
        icon: HeartPulse,
        phase: 2,
        description: 'Dependency health, active fallbacks and build progress',
      },
    ],
  },
];

export function isBuilt(item: NavItem): boolean {
  return item.phase <= CURRENT_PHASE;
}

/**
 * Whether to show an item to a user. Purely to reduce noise — every one of
 * these screens is also enforced server-side.
 */
export function isVisibleTo(
  item: NavItem,
  context: { role?: Role; permissions?: string[] },
): boolean {
  if (item.roles && context.role && !item.roles.includes(context.role)) return false;
  if (item.permission && context.permissions && !context.permissions.includes(item.permission)) {
    return false;
  }
  return true;
}

export function findNavItem(pathname: string): NavItem | undefined {
  return NAVIGATION.flatMap((section) => section.items).find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

export function findNavSection(pathname: string): NavSection | undefined {
  return NAVIGATION.find((section) =>
    section.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
}
