'use client';

import { ArrowLeft, ClipboardPaste, FileUp, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/page-header';
import { InlineWarning, PermissionDeniedState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useParseDocument, useParseText } from '@/hooks/use-requirements';
import { useAccounts } from '@/hooks/use-accounts';
import { ApiError } from '@/lib/api';
import { PRIORITY_SOURCE_LABELS, PRIORITY_SOURCE_ORDER } from '@/lib/demand';
import { useAuthStore } from '@/lib/auth-store';
import type { PrioritySource } from '@/types/demand';

const MIN_CHARACTERS = 20;

export default function NewRequirementPage() {
  const router = useRouter();
  const can = useAuthStore((state) => state.can);

  const parseText = useParseText();
  const parseDocument = useParseDocument();
  const accounts = useAccounts({ page_size: 100 });

  const [text, setText] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [prioritySource, setPrioritySource] = React.useState<PrioritySource | ''>('');
  const [accountId, setAccountId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  if (!can('jd:parse')) return <PermissionDeniedState />;

  const goToReview = (id: string) => {
    toast.success('Job description parsed. Review the extracted fields.');
    router.push(`/demand/requirements/${id}?tab=review`);
  };

  const onParseText = async () => {
    setError(null);
    try {
      const requirement = await parseText.mutateAsync({
        text,
        priority_source: prioritySource || undefined,
        account_id: accountId || undefined,
      });
      goToReview(requirement.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The job description could not be parsed.');
    }
  };

  const onParseDocument = async () => {
    if (!file) return;
    setError(null);
    try {
      const requirement = await parseDocument.mutateAsync({
        file,
        priority_source: prioritySource || undefined,
        account_id: accountId || undefined,
      });
      goToReview(requirement.id);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'The document could not be read. You can paste the text instead.',
      );
    }
  };

  const context = (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="priority_source">Where did this come from?</Label>
        <Select
          id="priority_source"
          value={prioritySource}
          onChange={(event) => setPrioritySource(event.target.value as PrioritySource | '')}
        >
          <option value="">Not sure yet</option>
          {PRIORITY_SOURCE_ORDER.map((source) => (
            <option key={source} value={source}>
              {PRIORITY_SOURCE_LABELS[source]}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          A VMS or MSP requirement gets a 48-hour submission window by default.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="account_id">Account (optional)</Label>
        <Select
          id="account_id"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          <option value="">Link later</option>
          {accounts.data?.items.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );

  return (
    <>
      <Link
        href="/demand/requirements"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All requirements
      </Link>

      <PageHeader
        title="Add a requirement"
        description="Paste or upload a job description and the platform extracts the structured fields. You review them before anything becomes usable."
      />

      <div className="max-w-4xl">
        <Tabs defaultValue="paste">
          <TabsList>
            <TabsTrigger value="paste">
              <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
              Paste a JD
            </TabsTrigger>
            <TabsTrigger value="upload">
              <FileUp className="h-3.5 w-3.5" aria-hidden />
              Upload a document
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste">
            <Card>
              <CardHeader>
                <CardTitle>Paste the job description</CardTitle>
                <CardDescription>
                  Include the rate, duration and any submission deadline — those are the fields that
                  decide whether the seat is worth pursuing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="jd-text">Job description</Label>
                  <textarea
                    id="jd-text"
                    rows={14}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={
                      'Job Title: Senior SAP FICO Consultant\nLocation: Doha, Qatar\nDuration: 18 months contract\n\nMinimum 8 years of experience…'
                    }
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">
                    {text.trim().length} characters
                    {text.trim().length > 0 && text.trim().length < MIN_CHARACTERS
                      ? ` — at least ${MIN_CHARACTERS} needed`
                      : ''}
                  </p>
                </div>

                {context}

                {error && (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    {error}
                  </div>
                )}

                <Button
                  onClick={() => void onParseText()}
                  loading={parseText.isPending}
                  disabled={text.trim().length < MIN_CHARACTERS}
                >
                  <Sparkles aria-hidden />
                  Parse job description
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload a job description</CardTitle>
                <CardDescription>PDF, Word (.docx) or plain text, up to 10 MB.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="jd-file">Document</Label>
                  <input
                    id="jd-file"
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
                  />
                </div>

                <InlineWarning>
                  A scanned image will not extract. If the upload fails, paste the text instead —
                  the requirement can always be created by hand.
                </InlineWarning>

                {context}

                {error && (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    {error}
                  </div>
                )}

                <Button
                  onClick={() => void onParseDocument()}
                  loading={parseDocument.isPending}
                  disabled={!file}
                >
                  <Sparkles aria-hidden />
                  Parse document
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
