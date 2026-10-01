'use client';

import { FilterX } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WORKPLACE_LABELS, WORKPLACE_ORDER } from '@/lib/jobfeed';
import { cn } from '@/lib/utils';
import type { SearchResult, WorkplaceType } from '@/types/jobfeed';

/**
 * Filtering a result set that is already in hand.
 *
 * Everything here runs over results the search already returned — no second
 * provider run, no network. That is the whole point: a search costs money and
 * takes about a minute, so narrowing one you already paid for must be instant.
 *
 * Which facets exist is dictated by what the provider actually fills in.
 * Location, company and posted date come back on every row; arrangement does
 * not, unless the search asked for it, which is why that group carries the
 * "not stated" bucket and the inferred marker rather than pretending.
 */

export interface Filters {
  arrangements: WorkplaceType[];
  locations: string[];
  companies: string[];
  /** Days since posting: 1, 7, 30, or null for any age. */
  postedWithinDays: number | null;
  keyword: string;
}

export const EMPTY_FILTERS: Filters = {
  arrangements: [],
  locations: [],
  companies: [],
  postedWithinDays: null,
  keyword: '',
};

export function isFiltered(filters: Filters): boolean {
  return (
    filters.arrangements.length > 0 ||
    filters.locations.length > 0 ||
    filters.companies.length > 0 ||
    filters.postedWithinDays !== null ||
    filters.keyword.trim() !== ''
  );
}

function daysSince(posted: string | null): number | null {
  if (!posted) return null;
  const then = Date.parse(posted);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/** One predicate per group, so a group's own facet counts can exclude itself. */
function predicates(filters: Filters) {
  const needle = filters.keyword.trim().toLowerCase();
  return {
    arrangements: (row: SearchResult) =>
      filters.arrangements.length === 0 || filters.arrangements.includes(row.workplace_type),
    locations: (row: SearchResult) =>
      filters.locations.length === 0 || filters.locations.includes(row.location ?? '—'),
    companies: (row: SearchResult) =>
      filters.companies.length === 0 || filters.companies.includes(row.company_name ?? '—'),
    posted: (row: SearchResult) => {
      if (filters.postedWithinDays === null) return true;
      const age = daysSince(row.posted_at);
      return age !== null && age <= filters.postedWithinDays;
    },
    keyword: (row: SearchResult) => {
      if (!needle) return true;
      return [row.title, row.company_name, row.location, row.description]
        .filter(Boolean)
        .some((field) => (field as string).toLowerCase().includes(needle));
    },
  };
}

export function applyFilters(results: SearchResult[], filters: Filters): SearchResult[] {
  const p = predicates(filters);
  return results.filter(
    (row) => p.arrangements(row) && p.locations(row) && p.companies(row) && p.posted(row) && p.keyword(row),
  );
}

/**
 * Counts for one group, computed with every *other* group applied.
 *
 * A count that ignored the other filters would promise results that clicking
 * it cannot deliver; one that included its own group would read zero for every
 * option you had not already picked.
 */
function countsFor(
  results: SearchResult[],
  filters: Filters,
  group: 'arrangements' | 'locations' | 'companies',
  keyOf: (row: SearchResult) => string,
): Map<string, number> {
  const p = predicates(filters);
  const others = (row: SearchResult) =>
    (group === 'arrangements' || p.arrangements(row)) &&
    (group === 'locations' || p.locations(row)) &&
    (group === 'companies' || p.companies(row)) &&
    p.posted(row) &&
    p.keyword(row);

  const counts = new Map<string, number>();
  for (const row of results) {
    if (!others(row)) continue;
    const key = keyOf(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const POSTED_BUCKETS: Array<[number, string]> = [
  [1, 'Last 24 hours'],
  [7, 'Last 7 days'],
  [30, 'Last 30 days'],
];

function Chip({
  active,
  count,
  children,
  onClick,
}: {
  active: boolean;
  count?: number;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const disabled = count === 0 && !active;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors',
        active
          ? 'border-primary bg-primary/10 font-medium text-foreground'
          : 'border-transparent hover:border-border hover:bg-muted',
        disabled && 'cursor-not-allowed opacity-40 hover:border-transparent hover:bg-transparent',
      )}
    >
      <span className="truncate">{children}</span>
      {count !== undefined ? (
        <span className="shrink-0 tabular-nums text-muted-foreground">{count}</span>
      ) : null}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function SearchFilters({
  results,
  filters,
  onChange,
}: {
  results: SearchResult[];
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  const arrangementCounts = countsFor(results, filters, 'arrangements', (row) => row.workplace_type);
  const locationCounts = countsFor(results, filters, 'locations', (row) => row.location ?? '—');
  const companyCounts = countsFor(results, filters, 'companies', (row) => row.company_name ?? '—');

  // Any inferred row at all means the group needs its caveat shown.
  const anyInferred = results.some((row) => row.workplace_inferred);

  const topLocations = [...locationCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topCompanies = [...companyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const postedCounts = new Map<number, number>();
  for (const [days] of POSTED_BUCKETS) {
    postedCounts.set(
      days,
      applyFilters(results, { ...filters, postedWithinDays: days }).length,
    );
  }

  return (
    <aside className="space-y-4" aria-label="Filter results">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Filter</h2>
        {isFiltered(filters) ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
            <FilterX aria-hidden />
            Clear
          </Button>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter_keyword" className="text-2xs uppercase tracking-wide">
          Keyword
        </Label>
        <Input
          id="filter_keyword"
          placeholder="React, senior, bank…"
          value={filters.keyword}
          onChange={(event) => onChange({ ...filters, keyword: event.target.value })}
        />
      </div>

      <Group title="Arrangement">
        {WORKPLACE_ORDER.map((arrangement) => (
          <Chip
            key={arrangement}
            active={filters.arrangements.includes(arrangement)}
            count={arrangementCounts.get(arrangement) ?? 0}
            onClick={() =>
              onChange({ ...filters, arrangements: toggle(filters.arrangements, arrangement) })
            }
          >
            {WORKPLACE_LABELS[arrangement]}
          </Chip>
        ))}
        {anyInferred ? (
          <p className="pt-1 text-2xs leading-relaxed text-muted-foreground">
            Some arrangements were read from the job text and are marked{' '}
            <span className="font-medium">inferred</span>. Run a thorough search to have the source
            state them.
          </p>
        ) : null}
      </Group>

      {topLocations.length > 1 ? (
        <Group title="Location">
          {topLocations.map(([place, count]) => (
            <Chip
              key={place}
              active={filters.locations.includes(place)}
              count={count}
              onClick={() => onChange({ ...filters, locations: toggle(filters.locations, place) })}
            >
              {place}
            </Chip>
          ))}
        </Group>
      ) : null}

      <Group title="Posted">
        {POSTED_BUCKETS.map(([days, label]) => (
          <Chip
            key={days}
            active={filters.postedWithinDays === days}
            count={postedCounts.get(days) ?? 0}
            onClick={() =>
              onChange({ ...filters, postedWithinDays: filters.postedWithinDays === days ? null : days })
            }
          >
            {label}
          </Chip>
        ))}
      </Group>

      {topCompanies.length > 1 ? (
        <Group title="Company">
          {topCompanies.map(([company, count]) => (
            <Chip
              key={company}
              active={filters.companies.includes(company)}
              count={count}
              onClick={() =>
                onChange({ ...filters, companies: toggle(filters.companies, company) })
              }
            >
              {company}
            </Chip>
          ))}
        </Group>
      ) : null}
    </aside>
  );
}
