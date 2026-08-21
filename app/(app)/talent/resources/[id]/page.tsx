'use client';

import { ArrowLeft, Download, FilePlus, Lock, Pencil, ShieldAlert, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/page-header';
import { CVReviewDialog } from '@/components/talent/cv-upload-dialog';
import { DocumentUploadDialog } from '@/components/talent/document-upload-dialog';
import { ResourceFormDialog } from '@/components/talent/resource-form-dialog';
import {
  CardLoadingState,
  EmptyState,
  ErrorState,
  InlineWarning,
  PermissionDeniedState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  documentDownloadUrl,
  useDeleteDocument,
  useResource,
  useResourceDocuments,
} from '@/hooks/use-talent';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate, humanizeEnum } from '@/lib/format';
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_VARIANT,
  EXPIRY_VARIANT,
  RESOURCE_TYPE_LABELS,
  VISA_STATUS_VARIANT,
  formatExperience,
  formatFileSize,
  formatRate,
} from '@/lib/talent';

export default function ResourceDetailPage() {
  const params = useParams<{ id: string }>();
  const resourceId = params?.id;
  const can = useAuthStore((state) => state.can);

  const resource = useResource(resourceId);
  const documents = useResourceDocuments(can('document:read') ? resourceId : undefined);

  const [editOpen, setEditOpen] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);

  if (!can('resource:read')) return <PermissionDeniedState />;

  const canEdit = can('resource:update');
  const canWriteDocuments = can('document:write');

  if (resource.isLoading) {
    return (
      <>
        <PageHeader title="Consultant" />
        <CardLoadingState count={3} />
      </>
    );
  }

  if (resource.isError) {
    return (
      <>
        <PageHeader title="Consultant" />
        <ErrorState error={resource.error} onRetry={() => void resource.refetch()} />
      </>
    );
  }

  const data = resource.data;
  if (!data) return null;

  return (
    <>
      <Link
        href="/talent/resources"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All resources
      </Link>

      <PageHeader
        title={data.full_name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{RESOURCE_TYPE_LABELS[data.resource_type]}</Badge>
            <Badge variant={AVAILABILITY_VARIANT[data.availability_status]}>
              {AVAILABILITY_LABELS[data.availability_status]}
            </Badge>
            <Badge variant={VISA_STATUS_VARIANT[data.visa_status]}>
              Visa: {humanizeEnum(data.visa_status)}
            </Badge>
            {[data.headline, data.current_location_city, data.code].filter(Boolean).join(' · ')}
          </span>
        }
        actions={
          canEdit ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden />
              Edit profile
            </Button>
          ) : null
        }
      />

      {data.blocks_deployment && (
        <div className="mb-4">
          <InlineWarning>
            <strong>This consultant cannot be deployed or billed.</strong> A work-authorisation
            document has expired — {data.work_authorisation?.label}. Renew it before submitting
            them for any requirement.
          </InlineWarning>
        </div>
      )}

      {data.needs_review && (
        <div className="mb-4">
          <InlineWarning>
            <p>
              This profile came from a parsed CV and has not been reviewed. It is excluded from
              matching until the extracted fields are accepted.
            </p>
            {canEdit ? (
              <Button size="sm" className="mt-2" onClick={() => setReviewOpen(true)}>
                Review extracted fields
              </Button>
            ) : null}
          </InlineWarning>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="experience">Experience</TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            <Badge variant="muted">{data.document_count}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Detail label="Headline" value={data.headline} />
                <Detail label="Experience" value={formatExperience(data.total_experience_years)} />
                <Detail
                  label="Location"
                  value={[data.current_location_city, data.current_location_country]
                    .filter(Boolean)
                    .join(', ')}
                />
                <Detail label="Relocate" value={data.willing_to_relocate ? 'Willing' : 'No'} />
                <Detail label="Notice period" value={`${data.notice_period_days} days`} />
                <Detail label="Ready from" value={formatDate(data.ready_from)} />
                <Detail label="Email" value={data.email} />
                <Detail label="Phone" value={data.phone} />
                <Detail label="Owner" value={data.owner_name} />
                <Detail label="Partner" value={data.partner_account_name} />
                {data.expected_cost_amount && (
                  <Detail
                    label="Expected cost"
                    value={formatRate(
                      data.expected_cost_amount,
                      data.expected_cost_currency,
                      data.expected_cost_unit,
                    )}
                  />
                )}
                {data.target_billing_amount && (
                  <Detail
                    label="Target billing"
                    value={formatRate(
                      data.target_billing_amount,
                      data.target_billing_currency,
                      data.target_billing_unit,
                    )}
                  />
                )}

                {data.summary && (
                  <div className="sm:col-span-2">
                    <div className="text-xs text-muted-foreground">Summary</div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{data.summary}</p>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Skills</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {data.skills.length > 0 ? (
                      data.skills.map((skill) => (
                        <Badge key={skill.id} variant={skill.is_primary ? 'default' : 'muted'}>
                          {skill.name}
                          {skill.years ? ` · ${skill.years}y` : ''}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        None recorded — matching will have nothing to work with.
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card
                className={data.blocks_deployment ? 'border-destructive/40 bg-destructive/5' : ''}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ShieldAlert className="h-4 w-4" aria-hidden />
                    Right to work
                  </CardTitle>
                  <CardDescription>
                    Derived from the documents on file, so it cannot drift out of date.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.work_authorisation ? (
                    <>
                      <Badge variant={EXPIRY_VARIANT[data.work_authorisation.state]}>
                        {data.work_authorisation.label}
                      </Badge>
                      {data.work_authorisation.expiry_date && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Earliest expiry {formatDate(data.work_authorisation.expiry_date)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No documents recorded.</p>
                  )}
                </CardContent>
              </Card>

              {data.certifications.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Certifications</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {data.certifications.map((certification) => (
                      <div
                        key={certification.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-sm">{certification.name}</span>
                        {certification.expires_at && (
                          <Badge variant={EXPIRY_VARIANT[certification.expiry_state]}>
                            {formatDate(certification.expires_at)}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="experience">
          <Card>
            <CardContent className="pt-5">
              {data.experience.length > 0 ? (
                <ul className="divide-y">
                  {data.experience.map((entry) => (
                    <li key={entry.id} className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{entry.role ?? 'Role'}</span>
                        {entry.is_current && <Badge variant="success">Current</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {[entry.company, entry.location].filter(Boolean).join(' · ')}
                      </div>
                      <div className="text-2xs text-muted-foreground">
                        {formatDate(entry.start_date)} →{' '}
                        {entry.is_current ? 'present' : formatDate(entry.end_date)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No experience history recorded" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            {canWriteDocuments && can('document:read') ? (
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>Documents</CardTitle>
                  <CardDescription>
                    Passports, visas, QIDs and work permits, with the expiry dates the alerts are
                    built on.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <FilePlus aria-hidden />
                  Upload
                </Button>
              </CardHeader>
            ) : null}
            <CardContent className="pt-5">
              {!can('document:read') ? (
                <PermissionDeniedState description="Documents hold personal data restricted to Resourcing, Management and Admin." />
              ) : documents.data && documents.data.length > 0 ? (
                <ul className="divide-y">
                  {documents.data.map((document) => (
                    <li key={document.id} className="flex items-start gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{document.doc_type_label}</span>
                          {document.is_work_authorisation && (
                            <Badge variant="outline">Right to work</Badge>
                          )}
                          <Badge variant={EXPIRY_VARIANT[document.expiry.state]}>
                            {document.expiry.label}
                          </Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {document.original_filename} · {formatFileSize(document.size_bytes)}
                          {document.reference_number ? ` · ${document.reference_number}` : ''}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {document.can_download ? (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={documentDownloadUrl(document.id)}>
                              <Download aria-hidden />
                              Download
                            </a>
                          </Button>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 text-xs text-muted-foreground"
                            title="Your role can see that this document exists, but not download it"
                          >
                            <Lock className="h-3 w-3" aria-hidden />
                            Restricted
                          </span>
                        )}
                        {canWriteDocuments ? (
                          <DeleteDocumentButton
                            documentId={document.id}
                            label={document.doc_type_label}
                          />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No documents on file"
                  description={
                    canWriteDocuments
                      ? 'Upload a visa, QID or work permit with its expiry date so the platform can warn before it lapses.'
                      : 'Nothing has been uploaded for this consultant. Resourcing maintains the document vault.'
                  }
                  action={
                    canWriteDocuments ? (
                      <Button onClick={() => setUploadOpen(true)}>
                        <FilePlus aria-hidden />
                        Upload a document
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ResourceFormDialog open={editOpen} onOpenChange={setEditOpen} resource={data} />
      {resourceId ? (
        <>
          <CVReviewDialog
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            resourceId={resourceId}
          />
          <DocumentUploadDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            resourceId={resourceId}
            resourceName={data.full_name}
          />
        </>
      ) : null}
    </>
  );
}

/**
 * Deleting a document is a two-press action.
 *
 * A passport removed by a misclick is a real loss — the file is gone from the
 * store, and the expiry it carried stops being tracked.
 */
function DeleteDocumentButton({ documentId, label }: { documentId: string; label: string }) {
  const remove = useDeleteDocument();
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${label}`}
      >
        <Trash2 aria-hidden />
      </Button>
    );
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      loading={remove.isPending}
      onClick={() =>
        remove.mutate(documentId, {
          onSuccess: () => toast.success(`${label} deleted.`),
          onError: (error) =>
            toast.error(
              error instanceof ApiError ? error.message : 'The document could not be deleted.',
            ),
        })
      }
    >
      Confirm delete
    </Button>
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
