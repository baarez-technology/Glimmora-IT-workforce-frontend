'use client';

import { Bookmark, ExternalLink, Search, Sparkles } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import {
  EmptyState,
  ErrorState,
  InlineWarning,
  PermissionDeniedState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/page-header';
import { useAddJob, useSearchAvailability, useSearchRun, useStartSearch } from '@/hooks/use-jobfeed';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { WORKPLACE_LABELS, WORKPLACE_VARIANT, jobSubtitle } from '@/lib/jobfeed';
import type { SearchResult, WorkplaceType } from '@/types/jobfeed';

/**
 * Search the open job market.
 *
 * Distinct from the feed, and the distinction matters: the feed is what
 * reached *you*, search is what exists. Nothing found here enters the feed
 * until it is saved, because one broad query would otherwise bury a person's
 * feed under fifty jobs they never asked for.
 *
 * A provider run takes roughly thirty to ninety seconds, so this starts a search and polls
 * for it rather than holding a request open.
 */

const POSTED_OPTIONS: Array<[string, string]> = [
  ['', 'Any time'],
  ['r86400', 'Past 24 hours'],
  ['r604800', 'Past week'],
  ['r2592000', 'Past month'],
];

function ResultCard({ result }: { result: SearchResult }) {
  const add = useAddJob();
  const [saved, setSaved] = React.useState(false);

  const save = async () => {
    try {
      await add.mutateAsync({
        title: result.title,
        company_name: result.company_name,
        location: result.location,
        country: result.country,
        workplace_type: result.workplace_type,
        description: result.description,
        url: result.url,
        posted_at: result.posted_at,
      });
      setSaved(true);
      toast.success('Saved to your feed.');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'That could not be saved.');
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-wrap items-start gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={WORKPLACE_VARIANT[result.workplace_type]}>
              {WORKPLACE_LABELS[result.workplace_type]}
            </Badge>
            {result.country ? <Badge variant="outline">{result.country}</Badge> : null}
          </div>
          <p className="mt-1.5 text-sm font-medium">{result.title}</p>
          {jobSubtitle(result.company_name, result.location) ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {jobSubtitle(result.company_name, result.location)}
            </p>
          ) : null}
          {result.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{result.description}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {result.url ? (
            <Button variant="outline" size="sm" asChild>
              <a href={result.url} target="_blank" rel="noreferrer noopener">
                <ExternalLink aria-hidden />
                Open
              </a>
            </Button>
          ) : null}
          <Button
            variant={saved ? 'outline' : 'default'}
            size="sm"
            disabled={saved || add.isPending}
            onClick={() => void save()}
          >
            <Bookmark aria-hidden />
            {saved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function JobSearch() {
  const can = useAuthStore((state) => state.can);
  const availability = useSearchAvailability();
  const start = useStartSearch();

  const [titles, setTitles] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [workplace, setWorkplace] = React.useState<WorkplaceType | ''>('');
  const [postedWithin, setPostedWithin] = React.useState('');
  const [searchId, setSearchId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = useSearchRun(searchId);

  if (!can('job_feed:read')) return <PermissionDeniedState />;

  const submit = async () => {
    setError(null);
    setSearchId(null);
    try {
      const started = await start.mutateAsync({
        titles: titles
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        locations: location.trim() ? [location.trim()] : [],
        workplace_type: workplace || null,
        posted_within: postedWithin || null,
      });
      setSearchId(started.search_id);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The search could not be started.');
    }
  };

  const running = run.data?.status === 'RUNNING' || start.isPending;
  const results = run.data?.results ?? [];
  const notConfigured = availability.data && !availability.data.available;

  return (
    <>
      <PageHeader
        title="Search jobs"
        description="The open market, not your feed. Save anything worth keeping and it joins your feed."
      />

      {notConfigured ? (
        <InlineWarning>
          Job search is not configured on this deployment, so there is nothing to search yet. Your
          feed still works.
        </InlineWarning>
      ) : null}

      <Card className="mb-4">
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="search_titles">Job titles</Label>
              <Input
                id="search_titles"
                placeholder="Python Developer, DevOps Engineer"
                value={titles}
                onChange={(event) => setTitles(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && titles.trim()) void submit();
                }}
              />
              <p className="text-2xs text-muted-foreground">
                Separate several with commas. Searching three costs the same as one.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="search_location">Location</Label>
              <Input
                id="search_location"
                placeholder="Qatar"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="search_workplace">Arrangement</Label>
              <Select
                id="search_workplace"
                value={workplace}
                onChange={(event) => setWorkplace(event.target.value as WorkplaceType | '')}
              >
                <option value="">Any</option>
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
                <option value="ONSITE">Onsite</option>
              </Select>
              <p className="text-2xs text-muted-foreground">
                Choosing one asks the source for it. Leaving it on Any means most results arrive
                without a stated arrangement.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="search_posted">Posted</Label>
              <Select
                id="search_posted"
                value={postedWithin}
                onChange={(event) => setPostedWithin(event.target.value)}
              >
                {POSTED_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <Button
            onClick={() => void submit()}
            loading={start.isPending}
            disabled={!titles.trim() || running || Boolean(notConfigured)}
          >
            <Search aria-hidden />
            Search
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {running ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            <Sparkles className="h-4 w-4 animate-pulse text-accent" aria-hidden />
            <div>
              <p className="text-sm font-medium">Searching…</p>
              <p className="text-xs text-muted-foreground">
                This usually takes thirty to ninety seconds. The results are kept for a while, so the same
                search again is instant.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : run.isError ? (
        <ErrorState error={run.error} onRetry={() => void run.refetch()} />
      ) : run.data?.status === 'FAILED' ? (
        <ErrorState
          error={new Error(run.data.error ?? 'The search did not complete.')}
          title="The search did not complete"
        />
      ) : searchId && results.length === 0 ? (
        <EmptyState
          title="Nothing found"
          description="Try a broader title, a wider location, or set the arrangement back to Any."
        />
      ) : results.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{results.length} results</p>
          {results.map((result) => (
            <ResultCard key={result.external_id ?? result.url ?? result.title} result={result} />
          ))}
        </div>
      ) : null}
    </>
  );
}
