import { Alert, Card, FormDivider, FormHeading } from '@brume-ui/brume-react';
import type { FieldDef, FormNode, RowContext } from '@brume-ui/brume-schema';
import type { CSSProperties, ReactNode } from 'react';
import { scopeErrors } from '../errors';
import { FieldIdPrefixContext } from '../field-navigation';
import { fieldOwnershipKey } from '../field-ownership';
import { resolveField } from '../registry';
import type { FormApi } from '../use-form-state';
import { Horizontal } from './horizontal';
import { Stacked } from './stacked';
export function isLongField(def: FieldDef): boolean {
  return (
    def.span === 'full' ||
    [
      'textarea',
      'tags',
      'upload',
      'checkbox',
      'dateRange',
      'datetimeRange',
      'embeds',
      'relation',
      'repeater',
    ].includes(def.type)
  );
}
export function fieldId(prefix: string, path: string): string {
  return `${prefix}-field-${encodeURIComponent(path)}`;
}
export interface NodesProps {
  nodes: FormNode[];
  api: FormApi;
  idPrefix: string;
  layout: 'stacked' | 'horizontal';
  prefix?: string;
  uploadUrl?: string;
  row?: boolean;
  sectionIdPrefix?: string;
  rowContext?: RowContext;
}
export function Nodes(props: NodesProps) {
  const { nodes, api, idPrefix, layout, prefix = '', uploadUrl, row } = props;
  const Grid = row ? 'div' : layout === 'horizontal' ? Horizontal : Stacked;
  const children = (items: FormNode[], childPrefix = prefix) => (
    <Nodes {...props} nodes={items} prefix={childPrefix} row={false} />
  );
  return (
    <FieldIdPrefixContext.Provider value={idPrefix}>
      <Grid {...(row ? { className: 'br:grid br:grid-cols-12 br:gap-4' } : {})}>
        {nodes.map((node, index) => {
          if (node.type === 'field') {
            const def = node.field;
            const path = prefix ? `${prefix}.${def.name}` : def.name;
            const activity = api.getField(path);
            if (activity?.visible === false) return null;
            const Component = resolveField(def.type);
            const errors = scopeErrors(api.errors, path);
            const ownership = fieldOwnershipKey(
              api,
              path,
              activity?.rowContext ?? props.rowContext,
            );
            const control = Component ? (
              <Component
                key={`${ownership}-${api.resetVersion}`}
                def={def}
                form={api}
                path={path}
                id={fieldId(idPrefix, path)}
                value={api.getValue(path)}
                onChange={(value) => api.setValue(path, value)}
                onBlur={() => api.touch(path)}
                errors={errors}
                invalid={Object.values(errors).some((v) => v.length > 0)}
                readOnly={activity?.readOnly ?? Boolean(def.readOnly)}
                disabled={Boolean(activity?.enabled === false || def.disabled || api.submitting)}
                uploadUrl={uploadUrl}
                rowContext={activity?.rowContext ?? props.rowContext}
              />
            ) : (
              <Alert tone="warning">Unknown field type: {def.type}</Alert>
            );
            if (def.type === 'hidden') return control;
            return (
              <div
                key={ownership}
                data-field-path={path}
                className={isLongField(def) ? 'br:min-w-0 br:col-span-full' : 'br:min-w-0'}
                style={
                  row
                    ? { gridColumn: `span ${isLongField(def) ? 12 : (def.width ?? 12)}` }
                    : undefined
                }
              >
                {control}
              </div>
            );
          }
          let content: ReactNode;
          switch (node.type) {
            case 'section': {
              const id = props.sectionIdPrefix
                ? `${props.sectionIdPrefix}-${encodeURIComponent(node.key)}`
                : `${idPrefix}-section-${encodeURIComponent(node.key)}`;
              content = (
                <section aria-labelledby={id} className="br:grid br:gap-4">
                  <FormHeading id={id} sectionKey={node.key}>
                    {node.title}
                  </FormHeading>
                  {node.description ? <p>{node.description}</p> : null}
                  {children(node.children)}
                </section>
              );
              break;
            }
            case 'row':
              content = <Nodes {...props} nodes={node.children} row />;
              break;
            case 'columns':
              content = (
                <div className="br:grid br:grid-cols-1 br:gap-4 br:@min-[640px]:grid-cols-12">
                  {node.columns.map((column, i) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: schema columns have no key and fixed structural order.
                      key={i}
                      className="br:min-w-0 br:@min-[640px]:[grid-column:var(--br-form-column-span,span_12)]"
                      style={{ '--br-form-column-span': `span ${column.width}` } as CSSProperties}
                    >
                      {children(column.children)}
                    </div>
                  ))}
                </div>
              );
              break;
            case 'block':
              content = <Card title={node.title}>{children(node.children)}</Card>;
              break;
            case 'divider':
              content = <FormDivider label={node.label} />;
              break;
            case 'embeds':
              content = (
                <fieldset className="br:min-w-0 br:grid br:gap-4">
                  <legend>{node.label}</legend>
                  {children(node.children, prefix ? `${prefix}.${node.name}` : node.name)}
                </fieldset>
              );
              break;
          }
          return (
            <div
              key={node.type === 'section' ? node.key : index}
              className="br:col-span-full br:min-w-0"
            >
              {content}
            </div>
          );
        })}
      </Grid>
    </FieldIdPrefixContext.Provider>
  );
}
