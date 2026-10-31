import type { OptionItem, PickerSearchResponse, RelationItem } from '@brume-ui/brume-schema';
import { type ReactNode, useId, useLayoutEffect, useRef, useState } from 'react';
import { useBrume } from '../provider';
import { Button } from './button';
import { TextInput } from './text-input';

export interface RelationPickerProps {
  value: RelationItem[];
  onChange(next: RelationItem[]): void;
  multiple: boolean;
  items: PickerSearchResponse['data'];
  pagination: PickerSearchResponse['pagination'];
  columns?: PickerSearchResponse['columns'];
  sections?: PickerSearchResponse['sections'];
  query: string;
  section?: string;
  loading: boolean;
  error?: string;
  disabled?: boolean;
  label: string;
  onQueryChange(query: string): void;
  onPageChange(page: number): void;
  onSectionChange(section: string): void;
  onRetry(): void;
  /** Hydrated metadata is separate from the visible search page; it is never writable data. */
  selectedOptions?: readonly OptionItem[];
  onOpenChange?(open: boolean): void;
  /** For example, pending uploads owned by the current draft. Cancel always remains available. */
  commitDisabled?: boolean;
  /** getDraft is a live read view for this selection generation; obsolete readers return []. */
  renderSelection?(
    item: RelationItem,
    index: number,
    onChange: (next: RelationItem) => void,
    draft: readonly RelationItem[],
    getDraft: () => readonly RelationItem[],
    getDraftIdentity?: (id: string) => number | undefined,
  ): ReactNode;
}

/** Inline search/selection region: the containing page or dialog remains the only surface. */
export function RelationPicker(props: RelationPickerProps) {
  const { t } = useBrume();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [draft, renderDraft] = useState<RelationItem[] | null>(null);
  const currentDraft = useRef<RelationItem[] | null>(null);
  const setDraft = (
    next: RelationItem[] | null | ((current: RelationItem[] | null) => RelationItem[] | null),
  ) => {
    currentDraft.current = typeof next === 'function' ? next(currentDraft.current) : next;
    renderDraft(currentDraft.current);
  };
  const live = useRef(false);
  const generation = useRef(0);
  const itemGeneration = useRef(0);
  type Owner = {
    generation: number;
    read(): readonly RelationItem[];
    identity(id: string): number | undefined;
  };
  const owners = useRef(new Map<string, Owner>());
  const createOwner = (id: string): Owner => {
    const session = generation.current;
    const owner: Owner = {
      generation: ++itemGeneration.current,
      identity: (target) =>
        live.current && session === generation.current && owners.current.get(id) === owner
          ? owners.current.get(target)?.generation
          : undefined,
      read: () =>
        live.current && session === generation.current && owners.current.get(id) === owner
          ? (currentDraft.current ?? [])
          : [],
    };
    return owner;
  };
  const metadata = useRef(new Map<string, OptionItem>());
  for (const option of [...(props.selectedOptions ?? []), ...props.items])
    metadata.current.set(option.value, option);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      generation.current++;
    };
  }, []);
  const open = draft !== null;
  useLayoutEffect(() => {
    if (open) search.current?.focus();
  }, [open]);
  const close = () => {
    generation.current++;
    setDraft(null);
    props.onOpenChange?.(false);
    trigger.current?.focus();
  };
  const labelOf = (item: RelationItem) =>
    metadata.current.get(item.id)?.label ?? t('combobox.unavailable', { value: item.id });
  const session = generation.current;
  return (
    <div className="br:min-w-0 br:grid br:gap-3">
      <Button
        ref={trigger}
        variant="secondary"
        disabled={props.disabled}
        aria-expanded={draft !== null}
        aria-controls={id}
        onClick={() => {
          if (currentDraft.current) return;
          generation.current++;
          owners.current = new Map(props.value.map((item) => [item.id, createOwner(item.id)]));
          setDraft(structuredClone(props.multiple ? props.value : props.value.slice(0, 1)));
          props.onOpenChange?.(true);
        }}
      >
        {props.label} · {props.value.length}
      </Button>
      {!draft && props.value.length ? (
        <ul className="br:grid br:gap-1 br:text-sm">
          {props.value.map((item) => (
            <li key={item.id}>{labelOf(item)}</li>
          ))}
        </ul>
      ) : null}
      {draft ? (
        <section
          data-brume-inline-escape=""
          id={id}
          aria-label={props.label}
          className="br:min-w-0 br:grid br:gap-4 br:rounded-lg br:border br:border-border br:bg-surface br:p-4"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.stopPropagation();
              if (event.target instanceof HTMLInputElement) event.preventDefault();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
        >
          <TextInput
            ref={search}
            aria-label={t('grid.search')}
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
          />
          {props.sections?.length ? (
            <label className="br:grid br:gap-1">
              {t('relation.section')}
              <select
                className="br:w-full br:rounded-md br:border br:border-border br:bg-surface br:p-2"
                value={props.section ?? ''}
                onChange={(event) => props.onSectionChange(event.target.value)}
              >
                {props.sections.map((section) => (
                  <option key={section.key} value={section.key}>
                    {section.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {props.loading ? <p role="status">{t('common.loading')}</p> : null}
          {props.error ? (
            <div role="alert">
              {props.error}
              <Button variant="secondary" onClick={props.onRetry}>
                {t('combobox.retry')}
              </Button>
            </div>
          ) : null}
          {!props.loading && !props.error && !props.items.length ? (
            <p role="status">{t('combobox.empty')}</p>
          ) : null}
          <section
            className="br:max-w-full br:overflow-x-auto"
            aria-label={t('dataTable.scrollRegion')}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard access to horizontal scrolling.
            tabIndex={0}
          >
            <table className="br:w-full br:text-left br:text-sm">
              <caption className="br:sr-only">{props.label}</caption>
              <thead>
                <tr>
                  <th scope="col">{props.label}</th>
                  {props.columns?.map((column) => (
                    <th key={column.key} scope="col" className="br:px-3">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {props.items.map((option) => (
                  <tr key={option.value}>
                    <td className="br:py-2">
                      <label className="br:flex br:items-center br:gap-2">
                        <input
                          type={props.multiple ? 'checkbox' : 'radio'}
                          name={id}
                          aria-label={t('dataTable.selectRow', { label: option.label })}
                          checked={draft.some((item) => item.id === option.value)}
                          disabled={
                            props.disabled || props.loading || !!props.error || option.disabled
                          }
                          onChange={() =>
                            setDraft((current) => {
                              if (!current || option.disabled) return current;
                              if (current.some((item) => item.id === option.value)) {
                                if (props.multiple) owners.current.delete(option.value);
                                return props.multiple
                                  ? current.filter((item) => item.id !== option.value)
                                  : current;
                              }
                              if (!props.multiple) owners.current.clear();
                              owners.current.set(option.value, createOwner(option.value));
                              return props.multiple
                                ? [...current, { id: option.value }]
                                : [{ id: option.value }];
                            })
                          }
                        />
                        <span>
                          {option.label}
                          {option.description ? (
                            <small className="br:block">{option.description}</small>
                          ) : null}
                        </span>
                      </label>
                    </td>
                    {props.columns?.map((column) => (
                      <td key={column.key} className="br:px-3">
                        {String(option.columns?.[column.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <nav
            aria-label={t('pagination.label')}
            className="br:flex br:flex-wrap br:items-center br:gap-2"
          >
            <Button
              variant="secondary"
              disabled={props.loading || props.pagination.page <= 1}
              onClick={() => props.onPageChange(props.pagination.page - 1)}
            >
              {t('pagination.previous')}
            </Button>
            <span>{t('pagination.page', { page: props.pagination.page })}</span>
            <Button
              variant="secondary"
              disabled={props.loading || !props.pagination.hasMore}
              onClick={() => props.onPageChange(props.pagination.page + 1)}
            >
              {t('pagination.next')}
            </Button>
          </nav>
          <p role="status">{t('grid.selectedCount', { count: draft.length })}</p>
          <div className="br:grid br:gap-4">
            {draft.map((item, index) => {
              const owner = owners.current.get(item.id);
              return (
                <div key={item.id} className="br:min-w-0 br:grid br:gap-2">
                  <div className="br:flex br:items-center br:justify-between br:gap-2">
                    <span>{labelOf(item)}</span>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        owners.current.delete(item.id);
                        setDraft(
                          (current) => current?.filter((entry) => entry.id !== item.id) ?? null,
                        );
                      }}
                    >
                      {t('combobox.remove', { label: labelOf(item) })}
                    </Button>
                  </div>
                  {props.renderSelection?.(
                    item,
                    index,
                    (next) => {
                      if (
                        !live.current ||
                        session !== generation.current ||
                        owners.current.get(item.id) !== owner ||
                        next.id !== item.id
                      )
                        return;
                      setDraft(
                        (current) =>
                          current?.map((entry) => (entry.id === item.id ? next : entry)) ?? null,
                      );
                    },
                    draft,
                    owner?.read ?? (() => []),
                    owner?.identity ?? (() => undefined),
                  )}
                </div>
              );
            })}
          </div>
          <div className="br:flex br:flex-wrap br:justify-end br:gap-2">
            <Button variant="ghost" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={props.disabled || props.commitDisabled}
              onClick={() => {
                if (props.commitDisabled) return;
                if (!currentDraft.current) return;
                props.onChange(structuredClone(currentDraft.current));
                close();
              }}
            >
              {t('grid.apply')}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
