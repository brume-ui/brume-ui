import {
  Field,
  failureMessage,
  RichTextEditor,
  type RichTextUploadResult,
  RichTextView,
  useBrume,
} from '@brume-ui/brume-react';
import {
  type ErrorResponse,
  type RichTextImageResponse,
  UPLOAD_PARAMS,
} from '@brume-ui/brume-schema';
import type { FieldProps } from '../contract';
import { verifiedRowContext } from '../row-identity';
import { resolveAncestorSources } from '../use-remote-options';

type RichTextDef = Extract<FieldProps['def'], { type: 'richText' }>;

export function RichTextField(props: FieldProps) {
  const { adapter, t } = useBrume();
  const { value, errors, path, id, uploadUrl, form } = props;
  if (props.def.type !== 'richText') return null;
  const def: RichTextDef = props.def;
  const html = typeof value === 'string' ? value : null;
  const caption = {
    label: def.label,
    description: def.help,
    error: errors['']?.[0],
    required: def.required,
  };
  if (props.readOnly) {
    return (
      <Field {...caption} group>
        <RichTextView
          html={html}
          contentCss={def.contentCss}
          maxHeight={def.height}
          label={def.label}
        />
      </Field>
    );
  }
  const images = def.images?.accept.length ? def.images : undefined;
  const canUpload = Boolean(images && uploadUrl);
  const upload = async (file: File, signal: AbortSignal): Promise<RichTextUploadResult> => {
    const finish = form.trackUpload();
    signal.addEventListener('abort', finish, { once: true });
    try {
      try {
        const body = new FormData();
        body.append(UPLOAD_PARAMS.file, file);
        body.append(UPLOAD_PARAMS.field, path);
        const context = verifiedRowContext(form, path, props.rowContext);
        if (!context) throw new Error('Invalid upload row context');
        if (context.length) body.append(UPLOAD_PARAMS.rowContext, JSON.stringify(context));
        const ancestors = resolveAncestorSources(form, form.getField(path), []);
        if (!ancestors.valid) throw new Error('Invalid upload ancestor context');
        if (ancestors.values.length)
          body.append(UPLOAD_PARAMS.ancestorSources, JSON.stringify(ancestors.values));
        const res = await adapter.request<RichTextImageResponse>({
          method: 'post',
          url: uploadUrl ?? '',
          body,
          signal,
        });
        if (res.status === 200)
          return {
            ok: true,
            url: res.data.url,
            ...(typeof res.data.name === 'string' ? { name: res.data.name } : {}),
          };
        const message =
          res.status === 422
            ? (res.data as unknown as ErrorResponse)?.errors?.file?.[0]
            : undefined;
        return { ok: false, message: message ?? failureMessage(res, t) };
      } catch {
        // A rejection would leave the editor's placeholder behind forever.
        return { ok: false, message: t('upload.failed') };
      }
    } finally {
      signal.removeEventListener('abort', finish);
      finish();
    }
  };
  return (
    <Field {...caption} group>
      <RichTextEditor
        id={id}
        label={def.label}
        value={html}
        onChange={props.onChange}
        onBlur={props.onBlur}
        height={def.height}
        contentCss={def.contentCss}
        placeholder={def.placeholder}
        disabled={props.disabled}
        invalid={props.invalid}
        aria-describedby={props.describedBy}
        {...(canUpload ? { images, upload } : {})}
      />
    </Field>
  );
}
