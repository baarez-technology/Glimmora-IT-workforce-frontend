'use client';

import { AlertTriangle, Download, FileSpreadsheet, Upload } from 'lucide-react';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import {
  EmptyState,
  ErrorState,
  InlineWarning,
  PermissionDeniedState,
  TableLoadingState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  downloads,
  useCommitImport,
  useDiscardImport,
  useImportBatches,
  useImportEntities,
  useUploadImport,
} from '@/hooks/use-platform';
import { useAuthStore } from '@/lib/auth-store';
import { formatRelative } from '@/lib/format';
import {
  ROW_STATE_PRESENTATION,
  commitSummary,
  isBlocked,
  rankRows,
  willImport,
} from '@/lib/platform';
import { cn } from '@/lib/utils';
import type { ImportEntity, ImportPreview } from '@/types/platform';

/**
 * Excel import and export.
 *
 * Three explicit steps — upload, review, commit — because the point of the
 * middle one is that a human sees exactly what will be written before anything
 * is. A single "import this file" button would be easier to build and
 * impossible to trust.
 */

const EXPORTABLE: ImportEntity[] = [
  'customers',
  'contacts',
  'projects',
  'requirements',
  'resources',
  'deployments',
  'billing',
];

const ENTITY_LABELS: Record<ImportEntity, string> = {
  customers: 'Customers & partners',
  contacts: 'Contacts',
  projects: 'Projects',
  requirements: 'Requirements',
  resources: 'Consultants',
  deployments: 'Deployments',
  billing: 'Billing records',
};

function PreviewTable({ preview }: { preview: ImportPreview }) {
  const rows = rankRows(preview.rows);
  const columns = React.useMemo(() => {
    const keys = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row.raw ?? {})) keys.add(key);
    }
    return [...keys].slice(0, 6);
  }, [rows]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Row</TableHead>
          <TableHead className="w-32">State</TableHead>
          {columns.map((key) => (
            <TableHead key={key}>{key.replace(/_/g, ' ')}</TableHead>
          ))}
          <TableHead>Problem</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const presentation = ROW_STATE_PRESENTATION[row.validation_state];
          return (
            <TableRow
              key={row.row_number}
              className={cn(row.validation_state === 'INVALID' && 'bg-destructive/5')}
            >
              <TableCell className="tabular">{row.row_number}</TableCell>
              <TableCell>
                <Badge variant={presentation.variant}>{presentation.label}</Badge>
              </TableCell>
              {columns.map((key) => (
                <TableCell key={key} className="max-w-40 truncate text-sm">
                  {String((row.raw ?? {})[key] ?? '')}
                </TableCell>
              ))}
              <TableCell className="text-xs">
                {row.errors.length > 0 ? (
                  <span className="text-destructive">{row.errors.join('; ')}</span>
                ) : row.warnings.length > 0 ? (
                  <span className="text-warning">{row.warnings.join('; ')}</span>
                ) : (
                  <span className="text-muted-foreground">{presentation.meaning}</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ImportWizard() {
  const [entity, setEntity] = React.useState<ImportEntity>('customers');
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const entities = useImportEntities();
  const upload = useUploadImport(entity);
  const commit = useCommitImport();
  const discard = useDiscardImport();

  const importable = (entities.data ?? []).map((item) => item.entity);
  const batch = preview?.batch;

  const reset = () => {
    setPreview(null);
    commit.reset();
    upload.reset();
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-muted-foreground" aria-hidden />
          Import from a spreadsheet
        </CardTitle>
        <CardDescription>
          Upload, review, then commit. Nothing is written until you commit, and an invalid row is
          never written at all.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="import-entity">What are you importing?</Label>
            <Select
              id="import-entity"
              value={entity}
              onChange={(event) => {
                setEntity(event.target.value as ImportEntity);
                reset();
              }}
            >
              {importable.map((value) => (
                <option key={value} value={value}>
                  {ENTITY_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>

          <Button variant="outline" asChild>
            <a href={downloads.template(entity)} download>
              <FileSpreadsheet aria-hidden />
              Download template
            </a>
          </Button>

          <div className="space-y-1.5">
            <Label htmlFor="import-file">File (.xlsx or .csv)</Label>
            <input
              ref={inputRef}
              id="import-file"
              type="file"
              accept=".xlsx,.xlsm,.csv"
              className="block text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  upload.mutate(file, { onSuccess: (result) => setPreview(result) });
                }
              }}
            />
          </div>
        </div>

        {upload.isPending ? <TableLoadingState rows={3} columns={4} /> : null}
        {upload.isError ? <ErrorState error={upload.error} /> : null}

        {batch ? (
          <div className="space-y-4">
            {isBlocked(batch) ? (
              <div
                className="rounded-md border border-destructive/40 bg-destructive/5 p-3"
                role="alert"
              >
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
                  The file cannot be imported as it is
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                  {batch.file_errors.map((error) => (
                    <li key={error}>• {error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ['Will import', willImport(batch), 'success'],
                ['Invalid — skipped', batch.invalid_rows, 'destructive'],
                ['Already exist', batch.duplicate_rows, 'muted'],
                ['Total rows', batch.total_rows, 'muted'],
              ].map(([label, value, tone]) => (
                <div key={String(label)} className="rounded-md border p-3">
                  <div className="text-2xs text-muted-foreground">{label}</div>
                  <div
                    className={cn(
                      'mt-0.5 text-xl font-semibold tabular',
                      tone === 'success' && Number(value) > 0 && 'text-success',
                      tone === 'destructive' && Number(value) > 0 && 'text-destructive',
                    )}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <InlineWarning>{commitSummary(batch)}</InlineWarning>

            {commit.isError ? <ErrorState error={commit.error} /> : null}
            {commit.isSuccess ? (
              <div className="rounded-md border border-success/40 bg-success/5 p-3 text-sm">
                Imported {commit.data.created} record
                {commit.data.created === 1 ? '' : 's'}.{' '}
                {commit.data.never_written > 0
                  ? `${commit.data.never_written} invalid row${
                      commit.data.never_written === 1 ? '' : 's'
                    } were never written.`
                  : ''}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {batch.status === 'STAGED' ? (
                <>
                  <Button
                    disabled={!batch.is_committable || commit.isPending}
                    loading={commit.isPending}
                    onClick={() =>
                      commit.mutate(batch.id, {
                        onSuccess: () =>
                          setPreview((current) =>
                            current
                              ? { ...current, batch: { ...current.batch, status: 'COMMITTED' } }
                              : current,
                          ),
                      })
                    }
                  >
                    Commit {willImport(batch)} row{willImport(batch) === 1 ? '' : 's'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => discard.mutate(batch.id, { onSuccess: reset })}
                  >
                    Discard
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={reset}>
                  Import another file
                </Button>
              )}

              {batch.invalid_rows > 0 ? (
                <Button variant="outline" asChild>
                  <a href={downloads.errors(batch.id)} download>
                    <Download aria-hidden />
                    Download failed rows
                  </a>
                </Button>
              ) : null}
            </div>

            {preview.rows.length > 0 ? (
              <div className="overflow-x-auto rounded-md border">
                <PreviewTable preview={preview} />
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DataTransfer() {
  const can = useAuthStore((state) => state.can);
  const batches = useImportBatches();

  const canImport = can('import:run');
  const canExport = can('export:run');

  if (!canImport && !canExport) return <PermissionDeniedState />;

  return (
    <>
      <PageHeader
        title="Import & Export"
        description="Move data in from a spreadsheet, or take it out. Exports respect the same field permissions as the screens — a role that cannot see consultant cost does not get a column for it."
      />

      <div className="space-y-4">
        {canImport ? <ImportWizard /> : null}

        {canExport ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Download className="h-4 w-4 text-muted-foreground" aria-hidden />
                Export
              </CardTitle>
              <CardDescription>
                Restricted columns are omitted entirely rather than blanked, so an empty cell
                always means &ldquo;no value&rdquo;.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {EXPORTABLE.map((entity) => (
                  <Button key={entity} variant="outline" size="sm" asChild>
                    <a href={downloads.export(entity)} download>
                      <FileSpreadsheet aria-hidden />
                      {ENTITY_LABELS[entity]}
                    </a>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {canImport ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Recent imports</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {batches.isError ? (
                <div className="p-5">
                  <ErrorState error={batches.error} onRetry={() => void batches.refetch()} />
                </div>
              ) : batches.isLoading ? (
                <div className="p-5">
                  <TableLoadingState rows={3} columns={5} />
                </div>
              ) : (batches.data ?? []).length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="Nothing imported yet"
                    description="Download a template, fill it in, and upload it above."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Imported</TableHead>
                      <TableHead className="text-right">Skipped</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(batches.data ?? []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{item.filename}</TableCell>
                        <TableCell className="text-sm">
                          {ENTITY_LABELS[item.entity_type]}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === 'COMMITTED'
                                ? 'success'
                                : item.status === 'STAGED'
                                  ? 'warning'
                                  : 'muted'
                            }
                          >
                            {item.status.toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {item.committed_rows}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {item.invalid_rows + item.duplicate_rows}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelative(item.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
