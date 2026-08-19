'use client';

import * as React from 'react';

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
import { useAuditActions, useAuditLog, type AuditQuery } from '@/hooks/use-identity';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime, humanizeEnum } from '@/lib/format';

const EMPTY_QUERY: AuditQuery = { page: 1, page_size: 25, q: '', action: '' };

/** Failed sign-ins and permission changes are the entries worth spotting. */
function actionVariant(action: string): 'destructive' | 'warning' | 'muted' {
  if (action.includes('FAILED') || action.includes('DELETED')) return 'destructive';
  if (action.includes('PERMISSION') || action.includes('DEACTIVATED')) return 'warning';
  return 'muted';
}

export default function AdminAuditPage() {
  const can = useAuthStore((state) => state.can);
  const [query, setQuery] = React.useState<AuditQuery>(EMPTY_QUERY);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => setQuery((q) => ({ ...q, q: search, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const logs = useAuditLog(query);
  const actions = useAuditActions();

  if (!can('audit:view')) return <PermissionDeniedState />;

  const isFiltered = Boolean(query.q || query.action);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only record of who changed what. The API exposes no way to edit or delete an entry."
      />

      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              placeholder="Search summaries and actors…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-sm"
              aria-label="Search the audit log"
            />
            <Select
              value={query.action ?? ''}
              onChange={(event) =>
                setQuery((q) => ({ ...q, action: event.target.value, page: 1 }))
              }
              className="max-w-[18rem]"
              aria-label="Filter by action"
            >
              <option value="">All actions</option>
              {actions.data?.map((action) => (
                <option key={action} value={action}>
                  {humanizeEnum(action)}
                </option>
              ))}
            </Select>
          </div>

          {logs.isLoading ? (
            <TableLoadingState rows={8} columns={4} />
          ) : logs.isError ? (
            <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />
          ) : logs.data && logs.data.items.length === 0 ? (
            isFiltered ? (
              <NoResultsState
                onClear={() => {
                  setSearch('');
                  setQuery(EMPTY_QUERY);
                }}
              />
            ) : (
              <EmptyState
                title="Nothing recorded yet"
                description="Audited actions will appear here as the platform is used."
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[11rem]">When</TableHead>
                  <TableHead className="w-[14rem]">Action</TableHead>
                  <TableHead>What happened</TableHead>
                  <TableHead className="w-[14rem]">Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data?.items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular">
                      {formatDateTime(entry.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(entry.action)}>
                        {humanizeEnum(entry.action)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{entry.summary}</div>
                      {entry.changes && (
                        <ul className="mt-1 space-y-0.5">
                          {Object.entries(entry.changes).map(([field, change]) => (
                            <li key={field} className="text-2xs text-muted-foreground">
                              <span className="font-medium">{field}</span>:{' '}
                              <span className="line-through">{String(change.from ?? '—')}</span> →{' '}
                              <span className="text-foreground">{String(change.to ?? '—')}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {entry.request_id && (
                        <div className="mt-1 font-mono text-2xs text-muted-foreground/70">
                          {entry.request_id}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{entry.actor_email ?? 'System'}</div>
                      {entry.ip_address && (
                        <div className="text-muted-foreground">{entry.ip_address}</div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {logs.data && logs.data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {logs.data.page} of {logs.data.pages} · {logs.data.total} entries
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logs.data.page <= 1}
                  onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logs.data.page >= logs.data.pages}
                  onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
