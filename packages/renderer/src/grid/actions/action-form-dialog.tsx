import {
  Button,
  Dialog,
  FormControls,
  failureMessage,
  isSafeHref,
  toast,
  useBrume,
} from '@brume-ui/brume-react';
import type {
  ActionDef,
  ActionRequest,
  ActionResponse,
  ErrorResponse,
  FormDef,
} from '@brume-ui/brume-schema';
import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { FormView, type FormViewHandle } from '../../form/form-view';
import { useFormState } from '../../form/use-form-state';
import { useGridNavigation } from '../use-grid-navigation';
import { applyFeedback } from './feedback';

export function ActionFormDialog({
  def,
  request,
  endpoint,
  onDone,
}: {
  def: ActionDef;
  request: ActionRequest;
  endpoint: string;
  onDone(ran: boolean): void;
}) {
  const { adapter, t } = useBrume();
  const { refresh } = useGridNavigation();
  const input = def.form ?? { fields: [] };
  const form: FormDef = {
    layout: 'stacked',
    nodes: input.fields.map((field) => ({ type: 'field', field })),
  };
  const api = useFormState(form, {});
  const view = useRef<FormViewHandle>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function save() {
    if (api.submitting) return;
    let valid = false;
    flushSync(() => {
      valid = api.validateAll();
    });
    if (!valid) {
      view.current?.focusFirstError();
      return;
    }
    const url = endpoint.replaceAll('{action}', encodeURIComponent(def.key));
    if (!isSafeHref(url)) return;
    api.setSubmitting(true);
    try {
      const res = await adapter.request<ActionResponse | ErrorResponse>({
        method: 'post',
        url,
        body: { ...request, input: api.values },
      });
      if (!alive.current) return;
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
      onDone(true);
      applyFeedback(
        (res.data as ActionResponse).feedback ?? {
          toast: { type: 'success', message: t('action.done', { label: def.label }) },
          refresh: true,
        },
        { adapter, refresh },
      );
    } catch {
      if (alive.current) toast.error(t('http.networkError'));
    } finally {
      if (alive.current) api.setSubmitting(false);
    }
  }
  return (
    <Dialog
      open
      size="sm"
      title={input.title ?? def.label}
      description={input.description}
      busy={api.submitting}
      onOpenChange={(open) => {
        if (!open && !api.submitting) onDone(false);
      }}
      footer={
        <>
          <Button variant="secondary" disabled={api.submitting} onClick={() => onDone(false)}>
            {t('form.cancel')}
          </Button>
          <Button loading={api.submitting} onClick={() => void save()}>
            {input.submitLabel ?? def.label}
          </Button>
        </>
      }
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: input controls retain semantics; wrapper handles bubbled Enter submission. */}
      <div
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
        <FormControls disabled={api.submitting}>
          <FormView ref={view} form={form} api={api} />
        </FormControls>
      </div>
    </Dialog>
  );
}
