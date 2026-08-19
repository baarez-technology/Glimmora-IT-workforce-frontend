'use client';

import Link from 'next/link';
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
import { useProjects, useTechnologies, type ProjectQuery } from '@/hooks/use-accounts';
import { PROJECT_STATUS_ORDER, PROJECT_STATUS_VARIANT } from '@/lib/accounts';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate, humanizeEnum } from '@/lib/format';
import type { ProjectStatus } from '@/types/accounts';

const EMPTY_QUERY: ProjectQuery = { page: 1, page_size: 25, q: '', status: '', technology_id: '' };

export default function ProjectsPage() {
  const can = useAuthStore((state) => state.can);
  const [query, setQuery] = React.useState<ProjectQuery>(EMPTY_QUERY);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => setQuery((q) => ({ ...q, q: search, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const projects = useProjects(query);
  const technologies = useTechnologies();

  if (!can('project:read')) return <PermissionDeniedState />;

  const isFiltered = Boolean(query.q || query.status || query.technology_id);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Client projects and their technology stacks. Projects are where requirements come from — and where account expansion is spotted before a vacancy is ever advertised."
      />

      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              placeholder="Search project name or code…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-xs"
              aria-label="Search projects"
            />
            <Select
              value={query.status ?? ''}
              onChange={(event) =>
                setQuery((q) => ({ ...q, status: event.target.value as ProjectStatus | '', page: 1 }))
              }
              className="max-w-[12rem]"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {PROJECT_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {humanizeEnum(status)}
                </option>
              ))}
            </Select>
            <Select
              value={query.technology_id ?? ''}
              onChange={(event) =>
                setQuery((q) => ({ ...q, technology_id: event.target.value, page: 1 }))
              }
              className="max-w-[16rem]"
              aria-label="Filter by technology"
            >
              <option value="">All technologies</option>
              {technologies.data?.map((technology) => (
                <option key={technology.id} value={technology.id}>
                  {technology.name}
                </option>
              ))}
            </Select>
          </div>

          {projects.isLoading ? (
            <TableLoadingState rows={6} columns={5} />
          ) : projects.isError ? (
            <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
          ) : projects.data && projects.data.items.length === 0 ? (
            isFiltered ? (
              <NoResultsState
                onClear={() => {
                  setSearch('');
                  setQuery(EMPTY_QUERY);
                }}
              />
            ) : (
              <EmptyState
                title="No projects yet"
                description="Projects are created from an account's detail page so they stay attached to the client they belong to."
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Technologies</TableHead>
                  <TableHead>Dates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.data?.items.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[project.code, project.location].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/accounts/customers/${project.account_id}`}
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        {project.account_name}
                      </Link>
                      {project.prime_contractor_name && (
                        <div className="text-xs text-muted-foreground">
                          via {project.prime_contractor_name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={PROJECT_STATUS_VARIANT[project.status]}>
                        {humanizeEnum(project.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {project.technologies.length > 0 ? (
                          project.technologies.map((technology) => (
                            <Badge key={technology.id} variant="muted">
                              {technology.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">Not recorded</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(project.start_date)}
                      <br />
                      {formatDate(project.end_date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {projects.data && projects.data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {projects.data.page} of {projects.data.pages} · {projects.data.total} projects
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={projects.data.page <= 1}
                  onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={projects.data.page >= projects.data.pages}
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
