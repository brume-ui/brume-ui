import {
  Button,
  Dialog,
  FormControls,
  IconButton,
  Select,
  Skeleton,
  useBrume,
  useConfirm,
} from '@brume-ui/brume-react';
import type { AfterSave, FormPage, FormSubmitSuccess } from '@brume-ui/brume-schema';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { type KeyboardEvent, useRef, useState } from 'react';
import { readAfterSave, writeAfterSave } from './after-save';
import { FormView, type FormViewHandle } from './form-view';
import { useFormState } from './use-form-state';
import { useFormSubmit } from './use-form-submit';

export interface FormDialogProps {
  page: FormPage | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  onSaved(res: FormSubmitSuccess, after: AfterSave): void;
  nav?: { prev?(): void; next?(): void };
}
export function FormDialog(props: FormDialogProps) {
  const { t } = useBrume();
  const identity = useRef({ page: props.page, version: 0 });
  if (identity.current.page !== props.page) {
    identity.current = { page: props.page, version: identity.current.version + 1 };
  }
  if (!props.open) return null;
  if (!props.page)
    return (
      <Dialog open={props.open} onOpenChange={props.onOpenChange} title={t('form.loading')}>
        <Skeleton />
      </Dialog>
    );
  // Each loaded page has independent values, requests, and after-save preference.
  return <LoadedFormDialog key={identity.current.version} {...props} page={props.page} />;
}
function LoadedFormDialog({
  page,
  open,
  onOpenChange,
  onSaved,
  nav,
}: FormDialogProps & { page: FormPage }) {
  const { t } = useBrume();
  const confirm = useConfirm();
  const api = useFormState(page.form, page.values);
  const view = useRef<FormViewHandle>(null);
  const { submit, submitting } = useFormSubmit(page, api, view);
  const [after, setAfter] = useState(() => readAfterSave(page));
  const navigating = useRef(false);
  async function navigate(direction: 'prev' | 'next') {
    if (submitting || api.submitting || navigating.current || !nav?.[direction]) return;
    navigating.current = true;
    try {
      if (
        api.dirty &&
        !(await confirm({
          title: t('dialog.discard.title'),
          confirmLabel: t('dialog.discard.confirm'),
          tone: 'danger',
        }))
      )
        return;
      nav[direction]?.();
    } finally {
      navigating.current = false;
    }
  }
  function keyDown(event: KeyboardEvent) {
    if (event.nativeEvent.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    const editable =
      event.target instanceof Element &&
      event.target.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="combobox"],[role="listbox"],[role="spinbutton"]',
      );
    if (!event.altKey && editable) return;
    const direction = event.key === 'ArrowUp' ? 'prev' : 'next';
    if (!nav?.[direction]) return;
    event.preventDefault();
    void navigate(direction);
  }
  async function close() {
    if (submitting || api.submitting) return;
    if (
      api.dirty &&
      !(await confirm({
        title: t('dialog.discard.title'),
        confirmLabel: t('dialog.discard.confirm'),
        tone: 'danger',
      }))
    )
      return;
    onOpenChange(false);
  }
  async function save() {
    const result = await submit(after);
    if (result) onSaved(result, after);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={page.title}
      description={page.description}
      size={page.size}
      maximizable
      dirty={api.dirty}
      busy={submitting}
      onKeyDown={keyDown}
      headerActions={
        <>
          <IconButton
            icon={ArrowUp}
            label={t('form.prev')}
            disabled={submitting || !nav?.prev}
            onClick={() => void navigate('prev')}
          />
          <IconButton
            icon={ArrowDown}
            label={t('form.next')}
            disabled={submitting || !nav?.next}
            onClick={() => void navigate('next')}
          />
        </>
      }
      footer={
        <>
          <div className="br:mr-auto br:flex br:flex-wrap br:items-center br:gap-2">
            <label className="br:shrink-0" htmlFor={`after-${page.formId}`}>
              {t('form.after')}
            </label>
            <div className="br:w-40 br:shrink-0">
              <Select
                id={`after-${page.formId}`}
                disabled={submitting}
                value={after}
                options={page.after.options.map((value) => ({ value, label: t(`form.${value}`) }))}
                onValueChange={(value) => {
                  setAfter(value as AfterSave);
                  writeAfterSave(page.formId, value as AfterSave);
                }}
              />
            </div>
          </div>
          <Button variant="secondary" disabled={submitting} onClick={() => void close()}>
            {t('form.cancel')}
          </Button>
          <Button data-dialog-primary loading={submitting} onClick={() => void save()}>
            {submitting ? t('form.saving') : page.submit.label}
          </Button>
        </>
      }
    >
      <div>
        <FormControls disabled={submitting}>
          <FormView ref={view} form={page.form} api={api} uploadUrl={page.uploadUrl} />
        </FormControls>
      </div>
    </Dialog>
  );
}
