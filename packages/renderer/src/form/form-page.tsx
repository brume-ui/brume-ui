import {
  ActionBar,
  Button,
  FormControls,
  FormSectionLink,
  isSafeHref,
  PageHeader,
  Select,
  useBrume,
  useConfirm,
} from '@brume-ui/brume-react';
import type { AfterSave, FormPage } from '@brume-ui/brume-schema';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { readAfterSave, writeAfterSave } from './after-save';
import { formIdentity } from './form-identity';
import { FormView, type FormViewHandle, sectionErrorKeys } from './form-view';
import { useFormState } from './use-form-state';
import { useFormSubmit } from './use-form-submit';

export function FormPageView({ page }: { page: FormPage }) {
  // New records remount; ordinary envelope refreshes preserve the user's edits.
  return <LoadedFormPage key={formIdentity(page)} page={page} />;
}
function LoadedFormPage({ page }: { page: FormPage }) {
  const { adapter, t } = useBrume();
  const confirm = useConfirm();
  const api = useFormState(page.form, page.values);
  const view = useRef<FormViewHandle>(null);
  const { submit, submitting } = useFormSubmit(page, api, view);
  const [after, setAfter] = useState(() => readAfterSave(page));
  const prefix = useId();
  const root = useRef<HTMLDivElement>(null);
  const sections = useMemo(
    () => page.form.nodes.filter((node) => node.type === 'section'),
    [page.form.nodes],
  );
  const errors = sectionErrorKeys(page.form, api.errors);
  const [active, setActive] = useState(sections[0]?.key);
  const latest = useRef({ api, page });
  latest.current = { api, page };
  const off = useRef<() => void>(() => {});
  const leaving = useRef(false);
  const asking = useRef(false);
  const alive = useRef(true);
  function release() {
    leaving.current = true;
    off.current();
  }
  const ask = () =>
    confirm({
      title: t('dialog.discard.title'),
      confirmLabel: t('dialog.discard.confirm'),
      tone: 'danger',
    });
  const askRef = useRef(ask);
  askRef.current = ask;
  useEffect(() => {
    alive.current = true;
    const remove = adapter.guardNavigation((target) => {
      if (leaving.current || !latest.current.api.dirty) return true;
      if ('unload' in target) return false;
      if (!asking.current) {
        asking.current = true;
        void askRef
          .current()
          .then((ok) => {
            if (ok && alive.current) {
              leaving.current = true;
              remove();
              adapter.visit(target.url);
            }
          })
          .finally(() => {
            asking.current = false;
          });
      }
      return false;
    });
    off.current = remove;
    const unload = (event: BeforeUnloadEvent) => {
      if (!leaving.current && latest.current.api.dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      alive.current = false;
      remove();
      window.removeEventListener('beforeunload', unload);
    };
  }, [adapter]);
  const save = async () => {
    const owner = formIdentity(latest.current.page);
    const result = await submit(after);
    if (!result || !alive.current || formIdentity(latest.current.page) !== owner) return;
    const url =
      result.feedback?.redirect ??
      (after === 'list' ? (result.urls.list ?? page.listUrl) : result.urls[after]);
    if (url && isSafeHref(url)) {
      release();
      adapter.visit(url);
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.key !== 'Enter' ||
        !event.metaKey
      )
        return;
      if (document.querySelector('[role="alertdialog"]')) return;
      event.preventDefault();
      void saveRef.current();
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.getAttribute('data-toc-key') ?? undefined);
      },
      { rootMargin: '0px 0px -65% 0px' },
    );
    for (const section of sections) {
      const heading = root.current?.querySelector<HTMLElement>(
        `[data-form-section="${CSS.escape(section.key)}"]`,
      );
      if (heading) {
        heading.dataset.tocKey = section.key;
        observer.observe(heading);
      }
    }
    return () => observer.disconnect();
  }, [sections]);
  async function discard() {
    if (asking.current || api.submitting) return;
    asking.current = true;
    const version = api.resetVersion;
    try {
      if ((await ask()) && alive.current && latest.current.api.resetVersion === version)
        latest.current.api.reset();
    } finally {
      asking.current = false;
    }
  }
  return (
    <div ref={root} className="br:grid br:gap-6">
      <PageHeader
        title={page.title}
        description={page.description}
        actions={
          page.listUrl && isSafeHref(page.listUrl) ? (
            <a
              href={page.listUrl}
              onClick={(event) => {
                event.preventDefault();
                adapter.visit(page.listUrl as string);
              }}
            >
              {t('form.list')}
            </a>
          ) : undefined
        }
      />
      <div className="br:flex br:items-start br:gap-6">
        {sections.length >= 2 ? (
          <nav
            aria-label={t('form.sections')}
            className="br:max-lg:hidden br:w-48 br:shrink-0 br:sticky br:top-4 br:lg:block"
          >
            {sections.map((section) => (
              <FormSectionLink
                key={section.key}
                href={`#${prefix}-${encodeURIComponent(section.key)}`}
                current={active === section.key}
                invalid={errors.has(section.key)}
                errorLabel={t('form.sectionError')}
                onClick={(event) => {
                  event.preventDefault();
                  const heading = root.current?.querySelector<HTMLElement>(
                    `[data-form-section="${CSS.escape(section.key)}"]`,
                  );
                  heading?.scrollIntoView?.({ block: 'start' });
                  heading?.focus();
                  setActive(section.key);
                }}
              >
                {section.title}
              </FormSectionLink>
            ))}
          </nav>
        ) : null}
        <div className="br:min-w-0 br:flex-1">
          <FormControls disabled={submitting}>
            <FormView
              ref={view}
              form={page.form}
              api={api}
              uploadUrl={page.uploadUrl}
              sectionsAs="stack"
              sectionIdPrefix={prefix}
            />
          </FormControls>
        </div>
      </div>
      <ActionBar sticky="bottom" label={api.dirty ? `● ${t('form.dirty')}` : undefined}>
        <div className="br:ml-auto br:flex br:items-center br:gap-2">
          <label htmlFor={`${prefix}-after`}>{t('form.after')}</label>
          <Select
            id={`${prefix}-after`}
            aria-label={t('form.after')}
            disabled={submitting}
            value={after}
            options={page.after.options.map((value) => ({ value, label: t(`form.${value}`) }))}
            onValueChange={(value) => {
              setAfter(value as AfterSave);
              writeAfterSave(page.formId, value as AfterSave);
            }}
          />
          {api.dirty ? (
            <Button variant="secondary" disabled={submitting} onClick={() => void discard()}>
              {t('form.discard')}
            </Button>
          ) : null}
          <Button loading={submitting} onClick={() => void save()}>
            {submitting ? t('form.saving') : page.submit.label}
          </Button>
        </div>
      </ActionBar>
    </div>
  );
}
