'use client';

import { ArrowLeft, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { ActivityTimeline } from '@/components/accounts/activity-timeline';
import { AddRouteDialog } from '@/components/accounts/add-route-dialog';
import { AddressabilityCard } from '@/components/accounts/addressability-card';
import { CreateContactDialog } from '@/components/accounts/create-contact-dialog';
import { CreateProjectDialog } from '@/components/accounts/create-project-dialog';
import { LogActivityDialog } from '@/components/accounts/log-activity-dialog';
import { EditAccountDialog } from '@/components/accounts/edit-account-dialog';
import { EditContactDialog } from '@/components/accounts/edit-contact-dialog';
import { PageHeader } from '@/components/layout/page-header';
import {
  CardLoadingState,
  EmptyState,
  ErrorState,
  PermissionDeniedState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAccount,
  useAccountRoutes,
  useAccountTimeline,
  useContacts,
  useProjects,
  useRemoveRoute,
} from '@/hooks/use-accounts';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_VARIANT,
  PROJECT_STATUS_VARIANT,
  RELATION_TYPE_LABELS,
} from '@/lib/accounts';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate, humanizeEnum } from '@/lib/format';
import type { Contact } from '@/types/accounts';

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const accountId = params?.id;
  const can = useAuthStore((state) => state.can);

  const [logOpen, setLogOpen] = React.useState(false);
  const [contactOpen, setContactOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingContact, setEditingContact] = React.useState<Contact | null>(null);
  const [projectOpen, setProjectOpen] = React.useState(false);
  const [routeOpen, setRouteOpen] = React.useState(false);

  const account = useAccount(accountId);
  const routes = useAccountRoutes(accountId);
  const contacts = useContacts({ account_id: accountId, page_size: 100 });
  const projects = useProjects({ account_id: accountId, page_size: 100 });
  const timeline = useAccountTimeline(accountId);
  const removeRoute = useRemoveRoute(accountId ?? '');

  if (!can('account:read')) return <PermissionDeniedState />;

  if (account.isLoading) {
    return (
      <>
        <PageHeader title="Account" />
        <CardLoadingState count={3} />
      </>
    );
  }

  if (account.isError) {
    return (
      <>
        <PageHeader title="Account" />
        <ErrorState error={account.error} onRetry={() => void account.refetch()} />
      </>
    );
  }

  const data = account.data;
  if (!data) return null;

  const onRemoveRoute = async (routeId: string) => {
    try {
      await removeRoute.mutateAsync(routeId);
      toast.success('Route removed.');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not remove the route.');
    }
  };

  return (
    <>
      <Link
        href="/accounts/customers"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All accounts
      </Link>

      <PageHeader
        title={data.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={ACCOUNT_TYPE_VARIANT[data.account_type]}>
              {ACCOUNT_TYPE_LABELS[data.account_type]}
            </Badge>
            <Badge variant="outline">{humanizeEnum(data.relationship_status)}</Badge>
            {[data.industry, data.city, data.country].filter(Boolean).join(' · ')}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {can('account:update') ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil aria-hidden />
                Edit account
              </Button>
            ) : null}
            {can('activity:write') ? (
              <Button onClick={() => setLogOpen(true)}>
                <Plus aria-hidden />
                Log activity
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="routes">
                Routes
                <Badge variant="muted">{data.route_count}</Badge>
              </TabsTrigger>
              <TabsTrigger value="contacts">
                Contacts
                <Badge variant="muted">{data.contact_count}</Badge>
              </TabsTrigger>
              <TabsTrigger value="projects">
                Projects
                <Badge variant="muted">{data.project_count}</Badge>
              </TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>Account details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Legal name" value={data.legal_name} />
                  <Detail label="Industry" value={data.industry} />
                  <Detail
                    label="Location"
                    value={[data.city, data.country].filter(Boolean).join(', ') || null}
                  />
                  <Detail label="Relationship owner" value={data.owner_name} />
                  <Detail
                    label="Payment terms"
                    value={data.payment_terms_days ? `${data.payment_terms_days} days` : null}
                  />
                  <Detail label="Website" value={data.website} />
                  {data.notes && (
                    <div className="sm:col-span-2">
                      <div className="text-xs text-muted-foreground">Notes</div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm">{data.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="routes">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>How we reach this account</CardTitle>
                  {can('account:update') && (
                    <Button size="sm" onClick={() => setRouteOpen(true)}>
                      <Plus aria-hidden />
                      Add route
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {routes.isLoading ? (
                    <CardLoadingState count={2} />
                  ) : routes.data && routes.data.length > 0 ? (
                    <ul className="divide-y">
                      {routes.data.map((route) => (
                        <li key={route.id} className="flex items-center gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm">
                                {RELATION_TYPE_LABELS[route.relation_type]}{' '}
                                <span className="font-medium">{route.to_account_name}</span>
                              </span>
                              {route.is_preferred_route && (
                                <Badge variant="success">
                                  <Star className="h-3 w-3" aria-hidden />
                                  Preferred route
                                </Badge>
                              )}
                            </div>
                            {route.notes && (
                              <p className="mt-0.5 text-xs text-muted-foreground">{route.notes}</p>
                            )}
                          </div>
                          {can('account:update') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void onRemoveRoute(route.id)}
                              aria-label="Remove route"
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState
                      title="No indirect route recorded"
                      description="If Glimmora reaches this client directly, that is correct and needs no route. Add one only when a partner or prime is required to bid."
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contacts">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>People at this account</CardTitle>
                  {can('contact:write') && (
                    <Button size="sm" onClick={() => setContactOpen(true)}>
                      <Plus aria-hidden />
                      Add contact
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {contacts.data && contacts.data.items.length > 0 ? (
                    <ul className="divide-y">
                      {contacts.data.items.map((contact) => (
                        <li key={contact.id} className="flex items-start gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{contact.full_name}</span>
                              {contact.is_decision_maker && (
                                <Badge variant="success">Decision maker</Badge>
                              )}
                              {contact.is_primary && <Badge variant="info">Primary</Badge>}
                              {!contact.is_active && <Badge variant="muted">Left</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {[contact.title, contact.email, contact.phone]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </div>
                          </div>
                          {can('contact:write') ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingContact(contact)}
                              aria-label={`Edit ${contact.full_name}`}
                            >
                              <Pencil aria-hidden />
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState
                      title="No contacts yet"
                      description="Adding a decision maker is worth 10 points of Addressability, and is the difference between a warm route and a cold one."
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="projects">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>Projects at this account</CardTitle>
                  {can('project:write') && (
                    <Button size="sm" onClick={() => setProjectOpen(true)}>
                      <Plus aria-hidden />
                      Add project
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {projects.data && projects.data.items.length > 0 ? (
                    <ul className="divide-y">
                      {projects.data.items.map((project) => (
                        <li key={project.id} className="py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{project.name}</span>
                            <Badge variant={PROJECT_STATUS_VARIANT[project.status]}>
                              {humanizeEnum(project.status)}
                            </Badge>
                            {project.prime_contractor_name && (
                              <Badge variant="warning">
                                via {project.prime_contractor_name}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {project.technologies.map((technology) => (
                              <Badge key={technology.id} variant="muted">
                                {technology.name}
                              </Badge>
                            ))}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatDate(project.start_date)} → {formatDate(project.end_date)}
                            {project.location ? ` · ${project.location}` : ''}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState
                      title="No projects recorded"
                      description="Projects are where requirements come from. Recording them early is how account expansion gets spotted."
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline">
              <Card>
                <CardContent className="pt-5">
                  <ActivityTimeline
                    activities={timeline.data?.items ?? []}
                    isLoading={timeline.isLoading}
                    error={timeline.isError ? timeline.error : undefined}
                    onRetry={() => void timeline.refetch()}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <AddressabilityCard signals={data.addressability} routeCount={data.route_count} />
        </div>
      </div>

      {accountId && (
        <>
          <LogActivityDialog open={logOpen} onOpenChange={setLogOpen} accountId={accountId} />
          <CreateContactDialog
            open={contactOpen}
            onOpenChange={setContactOpen}
            accountId={accountId}
          />
          <CreateProjectDialog
            open={projectOpen}
            onOpenChange={setProjectOpen}
            accountId={accountId}
          />
          <AddRouteDialog open={routeOpen} onOpenChange={setRouteOpen} accountId={accountId} />
        </>
      )}

      <EditAccountDialog open={editOpen} onOpenChange={setEditOpen} account={data} />
      {editingContact ? (
        <EditContactDialog
          open
          onOpenChange={(next) => {
            if (!next) setEditingContact(null);
          }}
          contact={editingContact}
        />
      ) : null}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value || '—'}</div>
    </div>
  );
}
