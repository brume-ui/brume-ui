import {
  Button,
  FormControls,
  failureMessage,
  isSafeHref,
  toast,
  useBrume,
} from '@brume-ui/brume-react';
import type { ErrorResponse, FormDef, FormSubmitResponse, ListPage } from '@brume-ui/brume-schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { FormView, type FormViewHandle } from '../../form/form-view';
import { useFormState } from '../../form/use-form-state';
import { applyFeedback, triggerDownload } from '../actions/feedback';

export function QuickCreate({
  def,
  onCreated,
}: {
  def: NonNullable<ListPage['quickCreate']>;
  onCreated(): void;
}) {
  const { adapter, t } = useBrume();
  const [open, setOpen] = useState(false);
  const form: FormDef = {
    layout: 'stacked',
    nodes: def.fields.map((field) => ({ type: 'field', field })),
  };
  const api = useFormState(form, {});
  const root = useRef<HTMLDivElement>(null);
  const view = useRef<FormViewHandle>(null);
  const alive = useRef(true);
  const identity = JSON.stringify(def);
  const current = useRef(identity);
  current.current = identity;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const focus = useCallback(() => {
    root.current
      ?.querySelector<HTMLElement>(
        'input:not(:disabled),textarea:not(:disabled),select:not(:disabled)',
      )
      ?.focus();
  }, []);
  useEffect(() => {
    if (open) focus();
  }, [open, focus]);
  async function save() {
    if (api.submitting || !isSafeHref(def.submitUrl)) return;
    let valid = false;
    flushSync(() => {
      valid = api.validateAll();
    });
    if (!valid) {
      view.current?.focusFirstError();
      return;
    }
    api.setSubmitting(true);
    const values = api.values;
    try {
      const res = await adapter.request<FormSubmitResponse | ErrorResponse>({
        method: 'post',
        url: def.submitUrl,
        body: { values },
      });
      if (!alive.current || current.current !== identity) return;
      if (res.status === 422) {
        flushSync(() => {
          api.setServerErrors((res.data as ErrorResponse).errors ?? {});
          api.setSubmitting(false);
        });
        view.current?.focusFirstError();
        return;
      }
      if (res.status < 200 || res.status >= 300) {
        toast.error(failureMessage(res, t));
        return;
      }
      const data = res.data as FormSubmitResponse;
      if (data.cancelled) {
        if (data.feedback) applyFeedback(data.feedback, { adapter, refresh: onCreated });
        return;
      }
      if (data.feedback?.toast) toast[data.feedback.toast.type](data.feedback.toast.message);
      else toast.success(t('action.done', { label: def.label }));
      if (data.feedback?.download)
        triggerDownload(data.feedback.download.url, data.feedback.download.filename);
      if (api.values === values) flushSync(() => api.reset({}));
      focus();
      if (data.feedback?.redirect) {
        if (isSafeHref(data.feedback.redirect)) adapter.visit(data.feedback.redirect);
      } else onCreated();
    } catch {
      if (alive.current && current.current === identity) toast.error(t('http.networkError'));
    } finally {
      if (alive.current) api.setSubmitting(false);
    }
  }
  return (
    <div
      className={
        open ? 'br:flex br:basis-full br:flex-col br:gap-3' : 'br:flex br:flex-col br:gap-3'
      }
    >
      <Button variant="secondary" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {t('resource.quickCreate')}
      </Button>
      {open ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: inputs retain semantics; wrapper handles bubbled Enter submission.
        <div
          ref={root}
          className="br:flex br:flex-wrap br:items-end br:gap-3"
          onKeyDown={(event) => {
            if (
              event.key !== 'Enter' ||
              event.defaultPrevented ||
              event.nativeEvent.isComposing ||
              event.keyCode === 229 ||
              !(event.target instanceof HTMLInputElement)
            )
              return;
            event.preventDefault();
            void save();
          }}
        >
          <div className="br:min-w-0 br:flex-1">
            <FormControls disabled={api.submitting}>
              <FormView ref={view} form={form} api={api} />
            </FormControls>
          </div>
          <Button loading={api.submitting} onClick={() => void save()}>
            {t('resource.add')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
