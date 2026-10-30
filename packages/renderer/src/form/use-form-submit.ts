import { failureMessage, isSafeHref, toast, useBrume } from '@brume-ui/brume-react';
import type {
  AfterSave,
  ErrorResponse,
  FormPage,
  FormSubmitResponse,
  FormSubmitSuccess,
} from '@brume-ui/brume-schema';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { triggerDownload } from '../grid/actions/feedback';
import type { FormViewHandle } from './form-view';
import type { FormApi } from './use-form-state';

/** Returns only saved records; hook cancellation never resets the form or invokes success flows. */
export function useFormSubmit(
  page: FormPage,
  api: FormApi,
  view: RefObject<FormViewHandle | null>,
): {
  submit(after: AfterSave): Promise<FormSubmitSuccess | null>;
  submitting: boolean;
} {
  const { adapter, t } = useBrume();
  const locked = useRef(false);
  const current = useRef({ page, api });
  current.current = { page, api };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [submitting, setSubmitting] = useState(false);
  async function submit(after: AfterSave): Promise<FormSubmitSuccess | null> {
    if (locked.current || api.submitting) return null;
    if (api.pendingUploads) {
      toast.info(t('form.pendingUploads'));
      return null;
    }
    let valid = false;
    flushSync(() => {
      valid = api.validateAll();
    });
    if (!valid) {
      view.current?.focusFirstError();
      return null;
    }
    locked.current = true;
    const version = api.resetVersion;
    const values = api.values;
    const relevant = () =>
      mounted.current &&
      current.current.page === page &&
      current.current.api.resetVersion === version;
    flushSync(() => {
      setSubmitting(true);
      api.setSubmitting(true);
    });
    try {
      const res = await adapter.request<FormSubmitResponse | ErrorResponse>({
        method: page.submit.method,
        url: page.submit.url,
        body: { values, after },
      });
      if (!relevant()) return null;
      if (res.status === 422) {
        flushSync(() => {
          api.setServerErrors((res.data as ErrorResponse).errors ?? {});
          api.setSubmitting(false);
          setSubmitting(false);
        });
        view.current?.focusFirstError();
        return null;
      }
      if (res.status < 200 || res.status >= 300) {
        toast.error(failureMessage(res, t));
        return null;
      }
      const data = res.data as FormSubmitResponse;
      const fb = data.feedback;
      if (fb?.toast) toast[fb.toast.type](fb.toast.message);
      if (fb?.download) triggerDownload(fb.download.url, fb.download.filename);
      if (data.cancelled === true) {
        if (fb?.redirect && isSafeHref(fb.redirect)) adapter.visit(fb.redirect);
        else if (!fb?.redirect && fb?.refresh) adapter.reload();
        return null;
      }
      // A programmatic write during the request must not be erased by its response.
      if (current.current.api.values !== values) return null;
      flushSync(() => api.reset(values));
      return data;
    } catch {
      if (relevant()) toast.error(t('http.networkError'));
      return null;
    } finally {
      locked.current = false;
      if (relevant()) api.setSubmitting(false);
      if (mounted.current) setSubmitting(false);
    }
  }
  return { submit, submitting };
}
