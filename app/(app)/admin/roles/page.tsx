'use client';

import { Check, Coins, Minus } from 'lucide-react';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { CardLoadingState, ErrorState, PermissionDeniedState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRoleCatalogue } from '@/hooks/use-identity';
import { useAuthStore } from '@/lib/auth-store';
import { ROLE_BADGE_VARIANT, ROLE_LABELS, ROLE_ORDER } from '@/lib/roles';

export default function AdminRolesPage() {
  const can = useAuthStore((state) => state.can);
  const currentRole = useAuthStore((state) => state.user?.role);
  const catalogue = useRoleCatalogue();
  const [filter, setFilter] = React.useState('');
  const [fieldOnly, setFieldOnly] = React.useState(false);

  if (!can('role:read')) return <PermissionDeniedState />;

  if (catalogue.isLoading) {
    return (
      <>
        <PageHeader title="Roles" />
        <CardLoadingState count={4} />
      </>
    );
  }

  if (catalogue.isError) {
    return (
      <>
        <PageHeader title="Roles" />
        <ErrorState error={catalogue.error} onRetry={() => void catalogue.refetch()} />
      </>
    );
  }

  const matrix = (catalogue.data?.matrix ?? []).filter((row) => {
    if (fieldOnly && !row.is_field_permission) return false;
    return row.permission.toLowerCase().includes(filter.trim().toLowerCase());
  });

  return (
    <>
      <PageHeader
        title="Roles and permissions"
        description="The access-control policy in full. Roles are fixed in V1; what each role can do is defined here and enforced by the API, not by hiding things in the interface."
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {catalogue.data?.roles.map((role) => (
          <Card key={role.role} className={role.role === currentRole ? 'border-primary/50' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">
                  <Badge variant={ROLE_BADGE_VARIANT[role.role]}>{role.label}</Badge>
                </CardTitle>
                {role.role === currentRole && (
                  <span className="text-2xs text-muted-foreground">your role</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{role.description}</p>
              <p className="mt-3 text-sm font-medium tabular">
                {role.permission_count} permissions
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Permission matrix</CardTitle>
          <CardDescription>
            Rows marked with a coin icon are <strong>field</strong> permissions: without one, the
            key is removed from the API response entirely rather than blanked in the interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Input
              placeholder="Filter permissions…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="max-w-xs"
              aria-label="Filter permissions"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fieldOnly}
                onChange={(event) => setFieldOnly(event.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Sensitive fields only
            </label>
            <span className="text-xs text-muted-foreground">{matrix.length} shown</span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[16rem]">Permission</TableHead>
                {ROLE_ORDER.map((role) => (
                  <TableHead key={role} className="text-center">
                    {ROLE_LABELS[role]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.map((row) => (
                <TableRow key={row.permission}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {row.is_field_permission && (
                        <Coins
                          className="h-3.5 w-3.5 shrink-0 text-warning"
                          aria-label="Field permission"
                        />
                      )}
                      <code className="font-mono text-xs">{row.permission}</code>
                    </div>
                  </TableCell>
                  {ROLE_ORDER.map((role) => (
                    <TableCell key={role} className="text-center">
                      {row.roles[role] ? (
                        <Check className="mx-auto h-4 w-4 text-success" aria-label="Granted" />
                      ) : (
                        <Minus
                          className="mx-auto h-4 w-4 text-muted-foreground/40"
                          aria-label="Not granted"
                        />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
