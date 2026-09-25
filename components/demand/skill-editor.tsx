'use client';

import { Plus, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSkillSearch } from '@/hooks/use-requirements';
import { cn } from '@/lib/utils';

/**
 * Add and remove skills during parse review.
 *
 * The parser reads what the job description happened to say. A recruiter
 * usually knows more than the document does — the client mentioned Kubernetes
 * on the call, or the JD lists a framework but not the language under it — and
 * without this the only options were to accept an incomplete list or to fix it
 * afterwards, by which point matching has already run against the wrong skills.
 *
 * Suggestions come from the skill master so spellings converge. A name that is
 * not on the list is still allowed: it is created for an administrator to merge,
 * which is the same path the parser's own unrecognised skills take. Refusing
 * the skill would just push the recruiter to write it in a notes field where
 * nothing can match on it.
 */

const LIST_ID_PREFIX = 'skill-options';

function normalise(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function SkillEditor({
  value,
  onChange,
  label,
  emptyHint = 'None extracted. Add the ones you know about.',
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Used for the accessible name of the input, e.g. "mandatory skill". */
  label: string;
  emptyHint?: string;
}) {
  const [draft, setDraft] = React.useState('');
  const listId = React.useId();
  const suggestions = useSkillSearch(draft.trim());

  const alreadyPresent = (name: string) =>
    value.some((entry) => entry.toLowerCase() === name.toLowerCase());

  const add = (raw: string) => {
    const name = normalise(raw);
    if (!name || alreadyPresent(name)) {
      setDraft('');
      return;
    }
    onChange([...value, name]);
    setDraft('');
  };

  const remove = (name: string) => onChange(value.filter((entry) => entry !== name));

  const duplicate = draft.trim().length > 0 && alreadyPresent(normalise(draft));
  const options = (suggestions.data ?? []).filter((option) => !alreadyPresent(option.name));

  return (
    <div className="mt-1.5">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((name) => (
            <li key={name}>
              <span className="inline-flex items-center gap-1 rounded-md border bg-muted/40 py-0.5 pl-2 pr-0.5 text-xs">
                {name}
                <button
                  type="button"
                  onClick={() => remove(name)}
                  aria-label={`Remove ${name}`}
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      )}

      <div className="mt-2 flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input
            value={draft}
            list={`${LIST_ID_PREFIX}-${listId}`}
            placeholder={`Add a ${label}…`}
            aria-label={`New ${label}`}
            aria-invalid={duplicate}
            className="h-8 text-sm"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                // The editor sits inside the review form; Enter must add a
                // skill, not submit and accept the whole requirement.
                event.preventDefault();
                add(draft);
              }
            }}
          />
          <datalist id={`${LIST_ID_PREFIX}-${listId}`}>
            {options.map((option) => (
              <option key={option.id} value={option.name} />
            ))}
          </datalist>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('h-8')}
          disabled={!draft.trim() || duplicate}
          aria-label={`Add ${label}`}
          onClick={() => add(draft)}
        >
          <Plus aria-hidden />
          Add
        </Button>
      </div>

      {duplicate && (
        <p className="mt-1 text-2xs text-warning">
          {normalise(draft)} is already on this list.
        </p>
      )}
    </div>
  );
}
