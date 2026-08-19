'use client';

import { Download, FileWarning, Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { CardLoadingState, EmptyState, ErrorState, PermissionDeniedState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { documentDownloadUrl, useExpiringDocuments } from '@/hooks/use-talent';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate } from '@/lib/format';
import { EXPIRY_VARIANT, formatFileSize } from '@/lib/talent';
import type { ResourceDocument } from '@/types/talent';

export default function DocumentsPage() {
  const can = useAuthStore((state) => state.can);
  const [daysAhead, setDaysAhead] = React.useState(60);
  const board = useExpiringDocuments(daysAhead);

  if (!can('document:read')) return <PermissionDeniedState />;

  if (board.isLoading) {
    return (
      <>
        <PageHeader title="Documents" />
        <CardLoadingState count={2} />
      </>
    );
  }

  if (board.isError) {
    return (
      <>
        <PageHeader title="Documents" />
        <ErrorState error={board.error} onRetry={() => void board.refetch()} />
      </>
    );
  }

  const data = board.data;
  const expired = data?.expired ?? [];
  const soon = data?.expiring_soon ?? [];

  return (
    <>
      <PageHeader
        title="Documents & work authorisation"
        description="An expired visa, QID or work permit stops a consultant working — and therefore stops billing on a live deployment. This board is revenue protection, not administration."
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={String(daysAhead)}
              onChange={(event) => setDaysAhead(Number(event.target.value))}
              className="w-[11rem]"
              aria-label="Look ahead window"
            >
              <option value="30">Next 30 days</option>
              <option value="60">Next 60 days</option>
              <option value="90">Next 90 days</option>
              <option value="180">Next 6 months</option>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void board.refetch()}
              loading={board.isFetching}
            >
              <RefreshCw aria-hidden />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <SummaryTile
          label="Expired — billing blocked"
          count={expired.length}
          tone="destructive"
          icon={ShieldAlert}
          hint="These consultants cannot legally work until renewed."
        />
        <SummaryTile
          label="Expiring soon"
          count={soon.length}
          tone="warning"
          icon={FileWarning}
          hint="Gulf renewals typically need 30–60 days of lead time."
        />
      </div>

      <div className="space-y-6">
        <DocumentTable
          title="Expired"
          description="Renewal is overdue. Any deployment involving these consultants is at risk today."
          documents={expired}
          emptyMessage="Nothing expired. Every tracked document is still valid."
        />
        <DocumentTable
          title="Expiring soon"
          description="Start the renewal now rather than when it lapses."
          documents={soon}
          emptyMessage="Nothing expiring in this window."
        />
      </div>
    </>
  );
}

function SummaryTile({
  label,
  count,
  tone,
  icon: Icon,
  hint,
}: {
  label: string;
  count: number;
  tone: 'destructive' | 'warning';
  icon: typeof ShieldAlert;
  hint: string;
}) {
  const empty = count === 0;
  return (
    <Card
      className={
        empty
          ? ''
          : tone === 'destructive'
            ? 'border-destructive/40 bg-destructive/5'
            : 'border-warning/40 bg-warning/5'
      }
    >
      <CardContent className="flex items-start gap-3 pt-5">
        <Icon
          className={`mt-0.5 h-5 w-5 shrink-0 ${
            empty ? 'text-muted-foreground' : tone === 'destructive' ? 'text-destructive' : 'text-warning'
          }`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-semibold tabular">{count}</div>
          <div className="text-sm font-medium">{label}</div>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentTable({
  title,
  description,
  documents,
  emptyMessage,
}: {
  title: string;
  description: string;
  documents: ResourceDocument[];
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <EmptyState title={emptyMessage} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultant</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>
                    <Link
                      href={`/talent/resources/${document.resource_id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {document.resource_name ?? 'Unknown'}
                    </Link>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm">{document.doc_type_label}</span>
                      {document.is_work_authorisation && (
                        <Badge variant="outline">Right to work</Badge>
                      )}
                    </div>
                    {document.issuing_country && (
                      <div className="text-2xs text-muted-foreground">
                        issued in {document.issuing_country}
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="whitespace-nowrap">
                    <Badge variant={EXPIRY_VARIANT[document.expiry.state]}>
                      {document.expiry.label}
                    </Badge>
                    <div className="mt-0.5 text-2xs text-muted-foreground tabular">
                      {formatDate(document.expiry.expiry_date)}
                    </div>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    <div className="max-w-[14rem] truncate">{document.original_filename}</div>
                    <div className="tabular">{formatFileSize(document.size_bytes)}</div>
                  </TableCell>

                  <TableCell className="text-right">
                    {document.can_download ? (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={documentDownloadUrl(document.id)}>
                          <Download aria-hidden />
                          Download
                        </a>
                      </Button>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                        title="Your role can see that this document exists, but not download it"
                      >
                        <Lock className="h-3 w-3" aria-hidden />
                        Restricted
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
