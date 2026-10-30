import { FieldLayoutContext } from '@brume-ui/brume-react';
import type { FormDef } from '@brume-ui/brume-schema';
import { forwardRef, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ErrorSummary } from './error-summary';
import { type FieldErrors, isPathWithin } from './errors';
import { FieldRevealContext } from './field-navigation';
import { fieldId, Nodes } from './layout/nodes';
import { FormTabs } from './layout/tabs';
import { findValueFieldOwner } from './traversal';
import type { FormApi } from './use-form-state';
import { collectFields } from './validate';

export { isLongField } from './layout/nodes';
export interface FormViewHandle {
  focusFirstError(): boolean;
}
export function sectionErrorKeys(form: FormDef, errors: FieldErrors): Set<string> {
  return new Set(
    form.nodes.flatMap((node) =>
      node.type === 'section' &&
      collectFields(node.children).some(({ path }) =>
        Object.entries(errors).some(
          ([key, messages]) => messages.length && isPathWithin(key, path),
        ),
      )
        ? [node.key]
        : [],
    ),
  );
}
export const FormView = forwardRef<
  FormViewHandle,
  {
    form: FormDef;
    api: FormApi;
    uploadUrl?: string;
    idPrefix?: string;
    sectionIdPrefix?: string;
    sectionsAs?: 'stack' | 'tabs';
  }
>(function FormView({ form, api, uploadUrl, idPrefix, sectionsAs, sectionIdPrefix }, ref) {
  const instance = useId();
  const prefix = `${idPrefix ?? 'form'}-${instance}`;
  const root = useRef<HTMLDivElement>(null);
  const revealers = useRef(new Map<string, () => void>());
  const navigation = useMemo(
    () => ({
      register(path: string, reveal: () => void) {
        revealers.current.set(path, reveal);
        return () => {
          if (revealers.current.get(path) === reveal) revealers.current.delete(path);
        };
      },
    }),
    [],
  );
  const sections = form.nodes.filter((node) => node.type === 'section');
  const firstSection = form.nodes.findIndex((node) => node.type === 'section');
  const [active, setActive] = useState(sections[0]?.key ?? '');
  const tabs = (sectionsAs ?? form.sections) === 'tabs';
  const fields = api.fields;
  const entries = Object.entries(api.errors)
    .filter(([, messages]) => messages.length > 0)
    .map(([path, messages]) => {
      const field = findValueFieldOwner(fields, api.values, path);
      const owner = collectFields(form.nodes).find(
        (item) =>
          item.def.type === 'upload' &&
          field &&
          item.path !== field.path &&
          isPathWithin(field.path, item.path),
      );
      const base = field
        ? owner
          ? `${fieldId(prefix, owner.path)}-extra-${encodeURIComponent(field.path.slice(owner.path.length + 1))}`
          : fieldId(prefix, field.path)
        : undefined;
      let target = base;
      if (field && (field.def.type === 'dateRange' || field.def.type === 'datetimeRange')) {
        const bound = path.slice(field.path.length + 1);
        if (bound === 'start' || bound === 'end') target = `${base}-${bound}`;
      }
      return { path, messages, label: field?.def.label, target, field };
    });
  const focus = (path: string): boolean => {
    const error = entries.find((entry) => entry.path === path);
    if (!error) return false;
    if (tabs && error.field) {
      const section = sections.find((section) =>
        collectFields(section.children).some(
          ({ path }) => error.field && isPathWithin(error.field.path, path),
        ),
      );
      if (section && section.key !== active) flushSync(() => setActive(section.key));
    }
    // Open outer composites first; their layout effects register any nested revealers.
    for (const field of fields) {
      if (
        error.field &&
        field.path !== error.field.path &&
        isPathWithin(error.field.path, field.path)
      ) {
        const reveal = revealers.current.get(field.path);
        if (reveal) flushSync(reveal);
      }
    }
    const element = error.target ? document.getElementById(error.target) : null;
    const focusable = element?.matches(
      'input:not([type=hidden]),textarea,select,button,a[href],[tabindex]',
    )
      ? element
      : element?.querySelector<HTMLElement>(
          'input:not([type=hidden]):not(:disabled),textarea:not(:disabled),select:not(:disabled),button:not(:disabled),[tabindex="0"]',
        );
    if (
      focusable instanceof HTMLElement &&
      !focusable.closest('[hidden]') &&
      !focusable.matches(':disabled')
    ) {
      focusable.focus({ preventScroll: true });
      if (document.activeElement === focusable) {
        // Native focus reveals only the control. Include its label, help and validation message
        // in the same reveal request, so a dialog's scrolling body keeps the explanation visible.
        const field = focusable.closest('[data-field-layout]') ?? focusable;
        field.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        return true;
      }
    }
    const summary = root.current?.querySelector<HTMLElement>('[role="alert"]');
    summary?.focus();
    return Boolean(summary && document.activeElement === summary);
  };
  useImperativeHandle(ref, () => ({
    focusFirstError: () =>
      entries.length
        ? focus(
            fields.flatMap((field) =>
              entries.filter((entry) => entry.field?.path === field.path),
            )[0]?.path ??
              entries[0]?.path ??
              '',
          )
        : false,
  }));
  const render = (nodes: FormDef['nodes']) => (
    <Nodes
      nodes={nodes}
      api={api}
      idPrefix={prefix}
      layout={form.layout}
      uploadUrl={uploadUrl}
      sectionIdPrefix={sectionIdPrefix}
    />
  );
  return (
    <FieldRevealContext.Provider value={navigation}>
      <FieldLayoutContext.Provider value={form.layout}>
        <div ref={root} className="br:@container br:grid br:gap-6">
          <ErrorSummary id={`${prefix}-summary`} errors={entries} onFocus={focus} />
          {tabs && sections.length ? (
            <>
              {render(form.nodes.slice(0, firstSection))}
              <FormTabs
                sections={sections}
                errors={sectionErrorKeys(form, api.errors)}
                value={
                  sections.some((section) => section.key === active)
                    ? active
                    : (sections[0]?.key ?? '')
                }
                onChange={setActive}
              >
                {(section) => render([section])}
              </FormTabs>
              {render(form.nodes.slice(firstSection + 1).filter((node) => node.type !== 'section'))}
            </>
          ) : (
            render(form.nodes)
          )}
        </div>
      </FieldLayoutContext.Provider>
    </FieldRevealContext.Provider>
  );
});
