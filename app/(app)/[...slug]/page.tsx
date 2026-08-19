import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { NotBuiltYetState } from '@/components/states';
import { NAVIGATION, type NavItem } from '@/lib/navigation';

/**
 * Honest placeholder for planned screens.
 *
 * The navigation shows the full information architecture from Phase 2, so users
 * can see where the platform is going. A route that is planned but not yet
 * implemented says so plainly; anything not in the navigation is a genuine 404.
 */

function findPlannedItem(slug: string[]): NavItem | undefined {
  const href = `/${slug.join('/')}`;
  return NAVIGATION.flatMap((section) => section.items).find((item) => item.href === href);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = findPlannedItem(slug);
  return { title: item?.label ?? 'Not found' };
}

export default async function PlannedScreenPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const item = findPlannedItem(slug);

  if (!item) notFound();

  return (
    <>
      <PageHeader title={item.label} description={item.description} />
      <NotBuiltYetState title={item.label} phase={item.phase} description={item.description} />
    </>
  );
}
