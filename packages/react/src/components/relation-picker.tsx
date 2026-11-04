import type { OptionItem, PickerSearchResponse, RelationItem } from '@brume-ui/brume-schema';
import { ChevronDown, Search, X } from 'lucide-react';
import { Fragment, type ReactNode, useId, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { Button } from './button';
import { Chip } from './chip';
import { CONTROL_BASE, CONTROL_BORDER, FOCUS_RING } from './focus';
import { IconButton } from './icon-button';
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
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
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
  /** Committed selections' settings, listed under the trigger so they stay visible after Apply. */
  describeSelection?(item: RelationItem): readonly { label: string; value: string }[];
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
  const preview = props.value.length
    ? [
        ...props.value.slice(0, 3).map(labelOf),
        ...(props.value.length > 3 ? [`+${props.value.length - 3}`] : []),
      ].join(' ')
    : (props.placeholder ?? t('relation.choose'));
  const session = generation.current;
  return (
    <div className="br:min-w-0 br:grid br:gap-3">
      <button
        type="button"
        ref={trigger}
        aria-label={`${props.label} · ${preview} ${props.value.length}`}
        className={cn(
          'br:flex br:min-h-9 br:w-full br:items-center br:gap-2 br:rounded-input br:border br:border-border-strong br:bg-surface br:px-3 br:py-1 br:text-left br:text-sm br:text-text br:enabled:hover:border-text-muted br:disabled:opacity-50',
          props.invalid && 'br:border-danger',
          FOCUS_RING,
        )}
        disabled={props.disabled}
        aria-invalid={props.invalid || undefined}
        aria-describedby={
          [props.value.length ? `${id}-selected` : undefined, props.describedBy]
            .filter(Boolean)
            .join(' ') || undefined
        }
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
        <span
          aria-hidden="true"
          className="br:min-w-0 br:flex br:flex-1 br:flex-wrap br:items-center br:gap-1"
        >
          {props.value.length ? (
            <>
              {props.value.slice(0, 3).map((item) => (
                <Fragment key={item.id}>
                  <Chip value={labelOf(item)} />{' '}
                </Fragment>
              ))}
              {props.value.length > 3 ? (
                <span className="br:text-text-muted">+{props.value.length - 3}</span>
              ) : null}
            </>
          ) : (
            <span className="br:text-text-muted">{props.placeholder ?? t('relation.choose')}</span>
          )}
        </span>{' '}
        <span aria-hidden="true" className="br:shrink-0 br:text-xs br:text-text-muted">
          {props.value.length}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'br:size-4 br:shrink-0 br:text-text-muted br:transition-[rotate] br:duration-base br:ease-out',
            draft && 'br:rotate-180',
          )}
        />
      </button>
      {props.value.length ? (
        <span
          id={`${id}-selected`}
          className="br:sr-only"
        >{`${props.label}: ${props.value.slice(0, 3).map(labelOf).join('、')}`}</span>
      ) : null}
      {!draft && props.value.length > 3 && !props.describeSelection ? (
        <ul className="br:sr-only" aria-label={props.label}>
          {props.value.slice(3).map((item) => (
            <li key={item.id}>{labelOf(item)}</li>
          ))}
        </ul>
      ) : null}
      {!draft && props.describeSelection && props.value.length ? (
        // Selected items keep their own settings visible after the panel closes.
        <ul
          aria-label={props.label}
          className="br:min-w-0 br:divide-y br:divide-border br:rounded-card br:border br:border-border"
        >
          {props.value.map((item) => {
            const details = props.describeSelection?.(item) ?? [];
            return (
              <li key={item.id} className="br:min-w-0 br:grid br:gap-0.5 br:px-4 br:py-2.5">
                <span className="br:text-sm br:font-medium br:text-text">{labelOf(item)}</span>
                {details.length ? (
                  <span className="br:flex br:flex-wrap br:gap-x-4 br:gap-y-0.5 br:text-[13px] br:text-text-muted">
                    {details.map((detail) => (
                      <span key={detail.label}>
                        {detail.label}
                        {t('form.errorSeparator')}
                        <span className="br:text-text">{detail.value}</span>
                      </span>
                    ))}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {draft ? (
        <section
          data-brume-inline-escape=""
          id={id}
          aria-label={props.label}
          className="br:min-w-0 br:overflow-hidden br:rounded-card br:border br:border-border br:bg-surface br:shadow-overlay"
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
          {/* Flex wrapping, not a container query: Chrome drops nested container-query layouts on
              re-render. The 1px gap over the border colour draws the divider in either arrangement. */}
          <div className="br:flex br:min-w-0 br:flex-wrap br:gap-px br:bg-border">
            <div className="br:grid br:min-w-0 br:flex-[2_1_22rem] br:content-start br:gap-3 br:bg-surface br:p-4">
              <div className="br:flex br:min-w-0 br:flex-wrap br:gap-2">
                <div className="br:relative br:min-w-0 br:flex-[3_1_12rem]">
                  <Search
                    aria-hidden="true"
                    className="br:pointer-events-none br:absolute br:top-1/2 br:left-3 br:size-4 br:-translate-y-1/2 br:text-text-muted"
                  />
                  <TextInput
                    ref={search}
                    aria-label={t('grid.search')}
                    placeholder={t('grid.search')}
                    className="br:pl-9"
                    value={props.query}
                    onChange={(event) => props.onQueryChange(event.target.value)}
                  />
                </div>
                {props.sections?.length ? (
                  <select
                    aria-label={t('relation.section')}
                    className={cn(
                      CONTROL_BASE,
                      CONTROL_BORDER,
                      FOCUS_RING,
                      'br:min-w-0 br:flex-[1_1_10rem]',
                    )}
                    value={props.section ?? ''}
                    onChange={(event) => props.onSectionChange(event.target.value)}
                  >
                    {props.sections.map((section) => (
                      <option key={section.key} value={section.key}>
                        {section.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              {props.error ? (
                <div
                  role="alert"
                  className="br:flex br:flex-wrap br:items-center br:justify-between br:gap-2 br:rounded-input br:border br:border-danger br:bg-danger-tint br:px-3 br:py-2 br:text-sm"
                >
                  {props.error}
                  <Button variant="secondary" size="sm" onClick={props.onRetry}>
                    {t('combobox.retry')}
                  </Button>
                </div>
              ) : null}
              <section
                className="br:max-h-72 br:max-w-full br:overflow-auto br:rounded-input br:border br:border-border"
                aria-label={t('dataTable.scrollRegion')}
                aria-busy={props.loading || undefined}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard access to horizontal scrolling.
                tabIndex={0}
              >
                <table className="br:w-full br:border-collapse br:text-left br:text-sm">
                  <caption className="br:sr-only">{props.label}</caption>
                  <thead className="br:sticky br:top-0 br:z-[1] br:bg-surface">
                    <tr className="br:border-b br:border-border">
                      <th
                        scope="col"
                        className="br:px-3 br:py-2 br:text-[13px] br:font-medium br:text-text-label"
                      >
                        {props.label}
                      </th>
                      {props.columns?.map((column) => (
                        <th
                          key={column.key}
                          scope="col"
                          className="br:px-3 br:py-2 br:text-[13px] br:font-medium br:text-text-label"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="br:divide-y br:divide-border">
                    {props.items.map((option) => {
                      const checked = draft.some((item) => item.id === option.value);
                      return (
                        <tr key={option.value} className={cn(checked && 'br:bg-accent-tint')}>
                          <td className="br:px-3 br:py-2">
                            <label className="br:flex br:cursor-pointer br:items-center br:gap-2.5">
                              <input
                                type={props.multiple ? 'checkbox' : 'radio'}
                                name={id}
                                className={cn('br:size-4 br:shrink-0 br:accent-accent', FOCUS_RING)}
                                aria-label={t('dataTable.selectRow', { label: option.label })}
                                checked={checked}
                                disabled={
                                  props.disabled ||
                                  props.loading ||
                                  !!props.error ||
                                  option.disabled
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
                              <span className="br:min-w-0">
                                {option.label}
                                {option.description ? (
                                  <small className="br:block br:text-[13px] br:text-text-muted">
                                    {option.description}
                                  </small>
                                ) : null}
                              </span>
                            </label>
                          </td>
                          {props.columns?.map((column) => (
                            <td key={column.key} className="br:px-3 br:py-2 br:text-text-muted">
                              {String(option.columns?.[column.key] ?? '')}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {props.loading ? (
                  <p role="status" className="br:px-3 br:py-6 br:text-center br:text-text-muted">
                    {t('common.loading')}
                  </p>
                ) : !props.error && !props.items.length ? (
                  <p role="status" className="br:px-3 br:py-6 br:text-center br:text-text-muted">
                    {t('combobox.empty')}
                  </p>
                ) : null}
              </section>
              <nav
                aria-label={t('pagination.label')}
                className="br:flex br:items-center br:justify-end br:gap-2 br:text-[13px] br:text-text-muted"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={props.loading || props.pagination.page <= 1}
                  onClick={() => props.onPageChange(props.pagination.page - 1)}
                >
                  {t('pagination.previous')}
                </Button>
                <span>{t('pagination.page', { page: props.pagination.page })}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={props.loading || !props.pagination.hasMore}
                  onClick={() => props.onPageChange(props.pagination.page + 1)}
                >
                  {t('pagination.next')}
                </Button>
              </nav>
            </div>
            <div className="br:grid br:min-w-0 br:flex-[1_1_16rem] br:content-start br:gap-3 br:bg-surface br:p-4">
              <p role="status" className="br:text-sm br:font-medium br:text-text">
                {t('grid.selectedCount', { count: draft.length })}
              </p>
              {draft.length ? (
                <div className="br:grid br:max-h-96 br:min-w-0 br:divide-y br:divide-border br:overflow-y-auto">
                  {draft.map((item, index) => {
                    const owner = owners.current.get(item.id);
                    return (
                      <div
                        key={item.id}
                        className="br:min-w-0 br:grid br:gap-3 br:py-3 br:first:pt-0 br:last:pb-0"
                      >
                        <div className="br:flex br:min-w-0 br:items-center br:justify-between br:gap-2">
                          <span className="br:min-w-0 br:text-sm br:font-medium br:text-text">
                            {labelOf(item)}
                          </span>
                          <IconButton
                            icon={X}
                            size="sm"
                            label={t('combobox.remove', { label: labelOf(item) })}
                            onClick={() => {
                              owners.current.delete(item.id);
                              setDraft(
                                (current) =>
                                  current?.filter((entry) => entry.id !== item.id) ?? null,
                              );
                            }}
                          />
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
                                current?.map((entry) => (entry.id === item.id ? next : entry)) ??
                                null,
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
              ) : (
                <p className="br:text-[13px] br:text-text-muted">{t('relation.none')}</p>
              )}
            </div>
          </div>
          <div className="br:flex br:flex-wrap br:items-center br:justify-end br:gap-3 br:border-t br:border-border br:bg-surface-canvas br:px-4 br:py-3">
            <p className="br:mr-auto br:flex-[1_1_14rem] br:text-[13px] br:text-text-muted">
              {t('relation.applyHint')}
            </p>
            <Button variant="secondary" size="sm" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
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
