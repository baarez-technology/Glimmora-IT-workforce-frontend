'use client';

import * as React from 'react';

import { ActivityTimeline } from '@/components/accounts/activity-timeline';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActivities, useFollowUps, type ActivityQuery } from '@/hooks/use-accounts';
import { ACTIVITY_TYPE_LABELS, LOGGABLE_ACTIVITY_TYPES } from '@/lib/accounts';
import { useAuthStore } from '@/lib/auth-store';
import type { ActivityType } from '@/types/accounts';

export default function ActivitiesPage() {
  const can = useAuthStore((state) => state.can);
  const [query, setQuery] = React.useState<ActivityQuery>({
    page: 1,
    page_size: 50,
    activity_type: '',
  });

  const activities = useActivities(query);
  const followUps = useFollowUps({ mine_only: true, page_size: 50 });
  const overdue = useFollowUps({ mine_only: true, overdue_only: true, page_size: 50 });

  if (!can('activity:read')) return <PermissionDeniedState />;

  const overdueCount = overdue.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Activities"
        description="Calls, emails, notes, meetings and follow-ups across every account. A lightweight timeline, deliberately not a full CRM."
      />

      <Tabs defaultValue="follow-ups">
        <TabsList>
          <TabsTrigger value="follow-ups">
            My follow-ups
            {overdueCount > 0 && <Badge variant="destructive">{overdueCount} overdue</Badge>}
          </TabsTrigger>
          <TabsTrigger value="all">All activity</TabsTrigger>
        </TabsList>

        <TabsContent value="follow-ups">
          <Card>
            <CardHeader>
              <CardTitle>What you owe someone</CardTitle>
              <CardDescription>
                Open follow-ups, soonest first. Overdue items are flagged — an unanswered
                follow-up is how an addressable account goes cold.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {followUps.isError ? (
                <ErrorState error={followUps.error} onRetry={() => void followUps.refetch()} />
              ) : followUps.data && followUps.data.items.length === 0 ? (
                <EmptyState
                  title="Nothing outstanding"
                  description="You have no open follow-ups. Set one when you log an activity and it will appear here."
                />
              ) : (
                <ActivityTimeline
                  activities={followUps.data?.items ?? []}
                  isLoading={followUps.isLoading}
                  showAccount
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardContent className="pt-5">
              <div className="mb-4">
                <Select
                  value={query.activity_type ?? ''}
                  onChange={(event) =>
                    setQuery((q) => ({
                      ...q,
                      activity_type: event.target.value as ActivityType | '',
                      page: 1,
                    }))
                  }
                  className="max-w-[14rem]"
                  aria-label="Filter by activity type"
                >
                  <option value="">All activity types</option>
                  {LOGGABLE_ACTIVITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ACTIVITY_TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </div>

              <ActivityTimeline
                activities={activities.data?.items ?? []}
                isLoading={activities.isLoading}
                error={activities.isError ? activities.error : undefined}
                onRetry={() => void activities.refetch()}
                showAccount
                emptyDescription="Activity is logged from an account, contact or project page."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
