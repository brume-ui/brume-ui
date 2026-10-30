import {
  Alert,
  Field,
  failureMessage,
  type UploadItem,
  UploadList,
  useBrume,
} from '@brume-ui/brume-react';
import {
  type ErrorResponse,
  UPLOAD_PARAMS,
  type UploadTempResponse,
  type UploadValue,
} from '@brume-ui/brume-schema';
import { useRef, useState } from 'react';
import type { FieldProps } from '../contract';
import { scopeErrors } from '../errors';
import { resolveField } from '../registry';
import { ReadOnlyField } from './misc';

type UploadDef = Extract<FieldProps['def'], { type: 'upload' }>;

export function UploadField(props: FieldProps) {
  const accepted = useRef(props.value);
  const emitted = useRef(props.value);
  const generation = useRef(0);
  const context = useRef(props.path);
  const resetVersion = useRef(props.form.resetVersion);
  // No-op form writes may retain the accepted prop instead of the proposed emission.
  if (
    (props.value !== accepted.current && props.value !== emitted.current) ||
    context.current !== props.path ||
    resetVersion.current !== props.form.resetVersion
  ) {
    emitted.current = props.value;
    context.current = props.path;
    resetVersion.current = props.form.resetVersion;
    generation.current++;
  }
  accepted.current = props.value;
  if (props.def.type !== 'upload') return null;
  if (props.readOnly) {
    const values = Array.isArray(props.value) ? props.value : props.value ? [props.value] : [];
    return (
      <ReadOnlyField
        {...props}
        value={values
          .map((v: UploadValue) => ('path' in v ? (v.name ?? v.path) : v.token))
          .join(', ')}
      />
    );
  }
  if (!props.uploadUrl) return <Alert tone="danger">這個表單沒有上傳端點</Alert>;
  return (
    <UploadControl
      key={generation.current}
      {...props}
      def={props.def}
      onChange={(next) => {
        emitted.current = next;
        props.onChange(next);
      }}
    />
  );
}

function UploadControl(props: FieldProps<unknown, UploadDef>) {
  const { def, value, errors, path, id, uploadUrl, form } = props;
  const { adapter, t } = useBrume();
  const [items, setItems] = useState<UploadItem[]>(() => {
    const values: UploadValue[] = Array.isArray(value)
      ? value
      : value
        ? [value as UploadValue]
        : [];
    return values.map((v, i) => ({
      key: `existing-${i}`,
      status: 'done',
      name: 'path' in v ? (v.name ?? v.path) : v.token,
      ...('path' in v ? { url: v.url, size: v.size } : {}),
      value: v,
    }));
  });
  const change = (next: UploadItem[]) => {
    setItems(next);
    const values = next.flatMap((item) =>
      item.status === 'done' && item.value ? [item.value] : [],
    );
    props.onChange(def.multiple ? values : (values[0] ?? null));
  };
  // Protocol indices refer to persisted values, never transient/error display rows.
  const valueIndex = (index: number) =>
    items.slice(0, index).filter((item) => item.status === 'done' && item.value).length;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: delegate descendant blur events for field validation.
    <div onBlur={props.onBlur}>
      <Field
        label={def.label}
        description={def.help}
        error={errors['']?.[0]}
        required={def.required}
        group
      >
        <UploadList
          id={id}
          label={def.label}
          kind={def.kind}
          multiple={def.multiple}
          accept={def.accept}
          maxSize={def.maxSize}
          maxFiles={def.maxFiles}
          sortable={def.sortable}
          disabled={props.disabled}
          invalid={props.invalid}
          aria-describedby={props.describedBy}
          items={items}
          onItemsChange={change}
          upload={async (file, signal) => {
            const finish = form.trackUpload();
            signal.addEventListener('abort', finish, { once: true });
            try {
              const body = new FormData();
              body.append(UPLOAD_PARAMS.file, file);
              body.append(UPLOAD_PARAMS.field, path);
              const res = await adapter.request<UploadTempResponse>({
                method: 'post',
                url: uploadUrl ?? '',
                body,
                signal,
              });
              if (res.status === 200) return { ok: true, value: res.data };
              const message =
                res.status === 422
                  ? (res.data as unknown as ErrorResponse)?.errors?.file?.[0]
                  : undefined;
              return { ok: false, message: message ?? failureMessage(res, t) };
            } finally {
              signal.removeEventListener('abort', finish);
              finish();
            }
          }}
          itemErrors={(index) =>
            items[index]?.status === 'done'
              ? errors[def.multiple ? String(valueIndex(index)) : '']?.[0]
              : undefined
          }
          renderExtra={(item, index) =>
            item.status === 'done' && item.value
              ? def.extra?.map((extra) => {
                  const Component = resolveField(extra.type);
                  const prefix = def.multiple
                    ? `${valueIndex(index)}.extra.${extra.name}`
                    : `extra.${extra.name}`;
                  const childErrors = scopeErrors(errors, prefix);
                  return Component ? (
                    <Component
                      key={extra.name}
                      {...props}
                      def={extra}
                      id={`${id}-extra-${encodeURIComponent(prefix)}`}
                      path={`${path}.${prefix}`}
                      onBlur={() => form.touch(`${path}.${prefix}`)}
                      value={item.value?.extra?.[extra.name]}
                      errors={childErrors}
                      invalid={!!childErrors['']?.length}
                      describedBy={undefined}
                      readOnly={!!extra.readOnly}
                      disabled={props.disabled || !!extra.disabled}
                      onChange={(next: unknown) =>
                        change(
                          items.map((current) =>
                            current.key === item.key && current.value
                              ? {
                                  ...current,
                                  value: {
                                    ...current.value,
                                    extra: { ...current.value.extra, [extra.name]: next },
                                  },
                                }
                              : current,
                          ),
                        )
                      }
                    />
                  ) : (
                    <Alert key={extra.name} tone="warning">
                      Unknown field type: {extra.type}
                    </Alert>
                  );
                })
              : null
          }
        />
      </Field>
    </div>
  );
}
