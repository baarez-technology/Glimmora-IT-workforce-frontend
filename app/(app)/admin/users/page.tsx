'use client';

import { Lock, ShieldOff, UserPlus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

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
import { CreateUserDialog } from '@/components/admin/create-user-dialog';
import { useDeactivateUser, useUsers, useUpdateUser, type UserQuery } from '@/hooks/use-identity';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime, formatRelative } from '@/lib/format';
import { ROLE_BADGE_VARIANT, ROLE_LABELS, ROLE_ORDER } from '@/lib/roles';
import type { Role, UserSummary } from '@/types/api';

const EMPTY_QUERY: UserQuery = { page: 1, page_size: 25, q: '', role: '', is_active: '' };

export default function AdminUsersPage() {
  const can = useAuthStore((state) => state.can);
  const currentUser = useAuthStore((state) => state.user);

  const [query, setQuery] = React.useState<UserQuery>(EMPTY_QUERY);
  const [search, setSearch] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);

  // Debounce so a search does not fire a request per keystroke.
  React.useEffect(() => {
    const timer = setTimeout(() => setQuery((q) => ({ ...q, q: search, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const users = useUsers(query);
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();

  const canRead = can('user:read');
  const canWrite = can('user:update');
  const canCreate = can('user:create');

  if (!canRead) return <PermissionDeniedState />;

  const onChangeRole = async (user: UserSummary, role: Role) => {
    try {
      await updateUser.mutateAsync({ id: user.id, role });
      toast.success(`${user.full_name} is now ${ROLE_LABELS[role]}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The role could not be changed.');
    }
  };

  const onDeactivate = async (user: UserSummary) => {
    try {
      await deactivateUser.mutateAsync(user.id);
      toast.success(`${user.full_name} deactivated. All their sessions were revoked.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The user could not be deactivated.');
    }
  };

  const isFiltered = Boolean(query.q || query.role || query.is_active !== '');

  return (
    <>
      <PageHeader
        title="Users"
        description="Accounts and role assignment. Every change here is written to the audit trail."
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus aria-hidden />
              Add user
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-xs"
              aria-label="Search users"
            />
            <Select
              value={query.role ?? ''}
              onChange={(event) =>
                setQuery((q) => ({ ...q, role: event.target.value as Role | '', page: 1 }))
              }
              className="max-w-[12rem]"
              aria-label="Filter by role"
            >
              <option value="">All roles</option>
              {ROLE_ORDER.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
            <Select
              value={query.is_active === '' ? '' : String(query.is_active)}
              onChange={(event) =>
                setQuery((q) => ({
                  ...q,
                  is_active: event.target.value === '' ? '' : event.target.value === 'true',
                  page: 1,
                }))
              }
              className="max-w-[12rem]"
              aria-label="Filter by status"
            >
              <option value="">Active and inactive</option>
              <option value="true">Active only</option>
              <option value="false">Deactivated only</option>
            </Select>
          </div>

          {users.isLoading ? (
            <TableLoadingState rows={5} columns={6} />
          ) : users.isError ? (
            <ErrorState error={users.error} onRetry={() => void users.refetch()} />
          ) : users.data && users.data.items.length === 0 ? (
            isFiltered ? (
              <NoResultsState
                onClear={() => {
                  setSearch('');
                  setQuery(EMPTY_QUERY);
                }}
              />
            ) : (
              <EmptyState
                title="No users yet"
                description="Add the first Glimmora user to get started."
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data?.items.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium">
                          {user.full_name}
                          {isSelf && (
                            <span className="ml-2 text-2xs text-muted-foreground">(you)</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                        {user.job_title && (
                          <div className="text-2xs text-muted-foreground">{user.job_title}</div>
                        )}
                      </TableCell>

                      <TableCell>
                        {canWrite && !isSelf ? (
                          <Select
                            value={user.role}
                            onChange={(event) =>
                              void onChangeRole(user, event.target.value as Role)
                            }
                            className="h-8 max-w-[11rem] text-xs"
                            aria-label={`Role for ${user.full_name}`}
                          >
                            {ROLE_ORDER.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Badge variant={ROLE_BADGE_VARIANT[user.role]}>
                            {ROLE_LABELS[user.role]}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={user.is_active ? 'success' : 'muted'}>
                            {user.is_active ? 'Active' : 'Deactivated'}
                          </Badge>
                          {user.is_locked && (
                            <Badge variant="destructive">
                              <Lock className="h-3 w-3" aria-hidden />
                              Locked
                            </Badge>
                          )}
                          {user.must_change_password && (
                            <Badge variant="warning">Must change password</Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {user.last_login_at ? (
                          <span title={formatDateTime(user.last_login_at)}>
                            {formatRelative(user.last_login_at)}
                          </span>
                        ) : (
                          'Never'
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {canWrite && user.is_active && !isSelf && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void onDeactivate(user)}
                            loading={deactivateUser.isPending}
                          >
                            <ShieldOff aria-hidden />
                            Deactivate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {users.data && users.data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {users.data.page} of {users.data.pages} · {users.data.total} users
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={users.data.page <= 1}
                  onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={users.data.page >= users.data.pages}
                  onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
