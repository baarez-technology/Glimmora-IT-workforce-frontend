'use client';

import { Building2, Plus, Route as RouteIcon, Users } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { CreateAccountDialog } from '@/components/accounts/create-account-dialog';
import { PageHeader } from '@/components/layout/page-header';
import {
  EmptyState,
  ErrorState,
  NoResultsState,
  PermissionDeniedState,
  TableLoadingState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAccounts, type AccountQuery } from '@/hooks/use-accounts';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ORDER,
  ACCOUNT_TYPE_VARIANT,
} from '@/lib/accounts';
import { useAuthStore } from '@/lib/auth-store';
import { humanizeEnum } from '@/lib/format';
import type { AccountType } from '@/types/accounts';

const EMPTY_QUERY: AccountQuery = {
  page: 1,
  page_size: 25,
  q: '',
  account_type: '',
  relationship_status: '',
};

export default function AccountsPage() {
  const can = useAuthStore((state) => state.can);
  const [query, setQuery] = React.useState<AccountQuery>(EMPTY_QUERY);
  const [search, setSearch] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setQuery((q) => ({ ...q, q: search, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const accounts = useAccounts(query);

  if (!can('account:read')) return <PermissionDeniedState />;

  const isFiltered = Boolean(query.q || query.account_type || query.relationship_status);

  return (
    <>
      <PageHeader
        title="Customers & Partners"
        description="Every organisation Glimmora sells to or reaches through — customers, partners, prime contractors and vendors, in one place."
        actions={
          can('account:create') ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              Add account
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              placeholder="Search name or industry…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-xs"
              aria-label="Search accounts"
            />
            <Select
              value={query.account_type ?? ''}
              onChange={(event) =>
                setQuery((q) => ({
                  ...q,
                  account_type: event.target.value as AccountType | '',
                  page: 1,
                }))
              }
              className="max-w-[14rem]"
              aria-label="Filter by account type"
            >
              <option value="">All types</option>
              {ACCOUNT_TYPE_ORDER.map((type) => (
                <option key={type} value={type}>
                  {ACCOUNT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
            <Select
              value={query.relationship_status ?? ''}
              onChange={(event) =>
                setQuery((q) => ({
                  ...q,
                  relationship_status: event.target.value as AccountQuery['relationship_status'],
                  page: 1,
                }))
              }
              className="max-w-[12rem]"
              aria-label="Filter by relationship status"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="TARGET">Target</option>
              <option value="DORMANT">Dormant</option>
              <option value="BLOCKED">Blocked</option>
            </Select>
          </div>

          {accounts.isLoading ? (
            <TableLoadingState rows={6} columns={5} />
          ) : accounts.isError ? (
            <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} />
          ) : accounts.data && accounts.data.items.length === 0 ? (
            isFiltered ? (
              <NoResultsState
                onClear={() => {
                  setSearch('');
                  setQuery(EMPTY_QUERY);
                }}
              />
            ) : (
              <EmptyState
                title="No accounts yet"
                description="Add the customers, partners and primes Glimmora works with. These records are what make requirements addressable."
                action={
                  can('account:create') ? (
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus aria-hidden />
                      Add the first account
                    </Button>
                  ) : undefined
                }
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.data?.items.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <Link
                        href={`/accounts/customers/${account.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {account.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {[account.industry, account.city, account.country]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={ACCOUNT_TYPE_VARIANT[account.account_type]}>
                        {ACCOUNT_TYPE_LABELS[account.account_type]}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">
                          {humanizeEnum(account.relationship_status)}
                        </Badge>
                        {account.is_approved_vendor && (
                          <Badge variant="success">Approved vendor</Badge>
                        )}
                        {account.has_msa && <Badge variant="info">MSA</Badge>}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1" title="Contacts">
                          <Users className="h-3.5 w-3.5" aria-hidden />
                          {account.contact_count}
                          {account.decision_maker_count > 0 && (
                            <span className="text-success">
                              ({account.decision_maker_count} DM)
                            </span>
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1" title="Projects">
                          <Building2 className="h-3.5 w-3.5" aria-hidden />
                          {account.project_count}
                        </span>
                        <span className="inline-flex items-center gap-1" title="Routes in">
                          <RouteIcon className="h-3.5 w-3.5" aria-hidden />
                          {account.route_count}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {account.owner_name ?? 'Unassigned'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {accounts.data && accounts.data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {accounts.data.page} of {accounts.data.pages} · {accounts.data.total} accounts
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={accounts.data.page <= 1}
                  onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={accounts.data.page >= accounts.data.pages}
                  onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateAccountDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
