'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { CreateContactDialog } from '@/components/accounts/create-contact-dialog';
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
import { useContacts, type ContactQuery } from '@/hooks/use-accounts';
import { useAuthStore } from '@/lib/auth-store';

const EMPTY_QUERY: ContactQuery = { page: 1, page_size: 25, q: '', is_decision_maker: '' };

export default function ContactsPage() {
  const can = useAuthStore((state) => state.can);
  const [query, setQuery] = React.useState<ContactQuery>(EMPTY_QUERY);
  const [search, setSearch] = React.useState('');
  const [addOpen, setAddOpen] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setQuery((q) => ({ ...q, q: search, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const contacts = useContacts(query);

  if (!can('contact:read')) return <PermissionDeniedState />;

  const isFiltered = Boolean(query.q || query.is_decision_maker !== '');

  return (
    <>
      <PageHeader
        title="Contacts"
        description="The people behind each account. Marking a decision maker is worth 10 points of Addressability — it is the difference between knowing an organisation and knowing who signs."
        actions={
          can('contact:write') ? (
            <Button onClick={() => setAddOpen(true)}>
              <Plus aria-hidden />
              Add contact
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              placeholder="Search name, title or email…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-xs"
              aria-label="Search contacts"
            />
            <Select
              value={query.is_decision_maker === '' ? '' : String(query.is_decision_maker)}
              onChange={(event) =>
                setQuery((q) => ({
                  ...q,
                  is_decision_maker:
                    event.target.value === '' ? '' : event.target.value === 'true',
                  page: 1,
                }))
              }
              className="max-w-[16rem]"
              aria-label="Filter by decision maker"
            >
              <option value="">Everyone</option>
              <option value="true">Decision makers only</option>
              <option value="false">Non decision makers</option>
            </Select>
          </div>

          {contacts.isLoading ? (
            <TableLoadingState rows={6} columns={4} />
          ) : contacts.isError ? (
            <ErrorState error={contacts.error} onRetry={() => void contacts.refetch()} />
          ) : contacts.data && contacts.data.items.length === 0 ? (
            isFiltered ? (
              <NoResultsState
                onClear={() => {
                  setSearch('');
                  setQuery(EMPTY_QUERY);
                }}
              />
            ) : (
              <EmptyState
                title="No contacts yet"
                description="Add a contact with the button above, or from an account's detail page — either way it stays attached to the organisation it belongs to."
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Contact details</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.data?.items.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <div className="font-medium">{contact.full_name}</div>
                      <div className="text-xs text-muted-foreground">{contact.title ?? '—'}</div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/accounts/customers/${contact.account_id}`}
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        {contact.account_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{contact.email ?? '—'}</div>
                      <div>{contact.phone ?? ''}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {contact.is_decision_maker && (
                          <Badge variant="success">Decision maker</Badge>
                        )}
                        {contact.is_primary && <Badge variant="info">Primary</Badge>}
                        {!contact.is_active && <Badge variant="muted">Inactive</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {contacts.data && contacts.data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {contacts.data.page} of {contacts.data.pages} · {contacts.data.total} contacts
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={contacts.data.page <= 1}
                  onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={contacts.data.page >= contacts.data.pages}
                  onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateContactDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
