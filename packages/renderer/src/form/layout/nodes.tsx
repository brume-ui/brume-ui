import {
  Alert,
  FormBlock,
  FormCollapsible,
  FormDivider,
  FormFieldset,
  FormHtml,
  FormSection,
  Link,
} from '@brume-ui/brume-react';
import type { FieldDef, FormNode, RowContext } from '@brume-ui/brume-schema';
import { type CSSProperties, type ReactNode, useContext, useState } from 'react';
import { MissingComponent } from '../../missing-component';
import { useRegistry } from '../../registry-context';
import { isPathWithin, scopeErrors } from '../errors';
import { FieldIdPrefixContext, FieldsetRevealContext } from '../field-navigation';
import { fieldOwnershipKey } from '../field-ownership';
import { resolveField } from '../registry';
import { groupVisible } from '../use-field-conditions';
import type { FormApi } from '../use-form-state';
import { collectFields } from '../validate';
import { Horizontal } from './horizontal';
import { Stacked } from './stacked';
/** The server's rule for a button link: an absolute http(s) URL, or a path with a single leading "/". */
export function isButtonHref(href: string): boolean {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what is rejected.
  if (/[\u0000-\u0020\u007f\\]/.test(href)) return false;
  if (/^\/(?![/\\])/.test(href)) return true;
  if (!/^https?:\/\/[^/?#]/i.test(href)) return false;
  try {
    return new URL(href).hostname !== '';
  } catch {
    return false;
  }
}

export function isLongField(def: FieldDef): boolean {
  return (
    def.span === 'full' ||
    // More than four inline choices need the whole row to stay on one line.
    (def.type === 'radio' && Array.isArray(def.options) && def.options.length > 4) ||
    [
      'textarea',
      'richText',
      'tags',
      'upload',
      'checkbox',
      'dateRange',
      'datetimeRange',
      'range',
      'timeRange',
      'embeds',
      'relation',
      'repeater',
      'keyValue',
      'list',
      'tree',
    ].includes(def.type) ||
    // The dual listbox needs the whole row for its two panes.
    (def.type === 'multipleSelect' && 'appearance' in def && def.appearance === 'listbox')
  );
}
/** Fields whose values are a few characters wide: one stacked track instead of two. */
export function isShortField(def: FieldDef): boolean {
  return ['number', 'decimal', 'currency', 'rate', 'date', 'datetime', 'time', 'switch'].includes(
    def.type,
  );
}
/** A field cell's span in the stacked grid (see Stacked). */
function cellClass(def: FieldDef, layout: 'stacked' | 'horizontal'): string {
  if (isLongField(def)) return 'br:min-w-0 br:col-span-full';
  if (layout !== 'stacked' || isShortField(def)) return 'br:min-w-0';
  // Two tracks need the form (the FormView container) to leave ~21rem inside cards and rails.
  return 'br:min-w-0 br:@max-[28rem]:col-span-full br:@min-[28rem]:col-span-2';
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
  /** A single table cell: no 12-column grid (its gaps alone would be wider than a narrow cell). */
  cell?: boolean;
  sectionIdPrefix?: string;
  rowContext?: RowContext;
  /** The concrete path of the enclosing repeater row / relation item: where row-scoped conditions resolve. */
  rowPath?: string;
}

/** A collapsible group that reopens whenever a failed submit or a jump targets a field inside. */
function Fieldset(props: {
  node: Extract<FormNode, { type: 'fieldset' }>;
  prefix: string;
  id: string;
  children: ReactNode;
}) {
  const { node, prefix } = props;
  const reveal = useContext(FieldsetRevealContext);
  const [state, setState] = useState({ seen: reveal?.n ?? 0, signal: 0 });
  if (reveal && reveal.n !== state.seen) {
    const inside = collectFields(node.children, prefix).some((field) =>
      isPathWithin(reveal.path, field.path),
    );
    setState({ seen: reveal.n, signal: state.signal + (inside ? 1 : 0) });
  }
  return (
    <FormCollapsible
      id={props.id}
      title={node.title}
      defaultCollapsed={node.collapsed}
      openSignal={state.signal}
    >
      {props.children}
    </FormCollapsible>
  );
}
export function Nodes(props: NodesProps) {
  const { nodes, api, idPrefix, layout, prefix = '', uploadUrl, row, cell } = props;
  const registry = useRegistry();
  const Grid = row ? 'div' : layout === 'horizontal' ? Horizontal : Stacked;
  const children = (items: FormNode[], childPrefix = prefix) => (
    <Nodes {...props} nodes={items} prefix={childPrefix} row={false} cell={false} />
  );
  return (
    <FieldIdPrefixContext.Provider value={idPrefix}>
      <Grid
        {...(cell
          ? { className: 'br:min-w-0' }
          : row
            ? { className: 'br:grid br:grid-cols-12 br:gap-4' }
            : {})}
      >
        {nodes.map((node, index) => {
          if (node.type === 'field') {
            const path = prefix ? `${prefix}.${node.field.name}` : node.field.name;
            const activity = api.getField(path);
            const def = activity?.def ?? node.field;
            if (activity?.visible === false) return null;
            const Component =
              def.type === 'custom'
                ? registry.getField(def.component.name)?.component
                : resolveField(def.type);
            const errors = scopeErrors(api.errors, path);
            const ownership = fieldOwnershipKey(
              api,
              path,
              activity?.rowContext ?? props.rowContext,
            );
            const reset = api.resetVersion;
            const state = api.stateId;
            // Async callbacks may run after a synchronous move but before React renders it.
            // Resolve the current numeric path from the captured lifetime, not a stale index.
            const livePath = () => {
              if (api.resetVersion !== reset || api.stateId !== state) return undefined;
              return api.fields.find(
                (field) => fieldOwnershipKey(api, field.path, field.rowContext) === ownership,
              )?.path;
            };
            const control = Component ? (
              <Component
                key={`${ownership}-${api.resetVersion}`}
                def={def}
                form={api}
                path={path}
                id={fieldId(idPrefix, path)}
                value={api.getValue(path)}
                onChange={(value) => {
                  const current = livePath();
                  if (
                    current !== undefined &&
                    activity?.readOnly !== true &&
                    !def.readOnly &&
                    !(def.type === 'custom' && def.displayOnly) &&
                    activity?.enabled !== false &&
                    !def.disabled &&
                    !api.submitting
                  )
                    api.setValue(current, value);
                }}
                onBlur={() => {
                  const current = livePath();
                  if (current !== undefined) api.touch(current);
                }}
                errors={errors}
                invalid={Object.values(errors).some((v) => v.length > 0)}
                readOnly={Boolean(
                  activity?.readOnly || def.readOnly || (def.type === 'custom' && def.displayOnly),
                )}
                disabled={Boolean(activity?.enabled === false || def.disabled || api.submitting)}
                uploadUrl={uploadUrl}
                rowContext={activity?.rowContext ?? props.rowContext}
              />
            ) : def.type === 'custom' ? (
              <MissingComponent name={def.component.name} />
            ) : (
              <Alert tone="warning">Unknown field type: {def.type}</Alert>
            );
            if (def.type === 'hidden') return control;
            // A captcha answer is never shown back, so a read-only form has no cell for it.
            if (def.type === 'captcha' && (activity?.readOnly || def.readOnly)) return null;
            return (
              <div
                key={ownership}
                data-field-path={path}
                className={row ? 'br:min-w-0' : cellClass(def, layout)}
                style={
                  row && !cell
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
                <FormSection
                  id={id}
                  sectionKey={node.key}
                  title={node.title}
                  description={node.description}
                >
                  {children(node.children)}
                </FormSection>
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
              content = <FormBlock title={node.title}>{children(node.children)}</FormBlock>;
              break;
            case 'fieldset':
              content = (
                <Fieldset
                  node={node}
                  prefix={prefix}
                  id={`${idPrefix}-fieldset-${encodeURIComponent(prefix ? `${prefix}.${node.key}` : node.key)}`}
                >
                  {children(node.children)}
                </Fieldset>
              );
              break;
            case 'group':
              // Only presentation: the fields inside carry their own showWhen, so a hidden group
              // keeps every draft value and validation needs no rule of its own.
              if (!groupVisible(node.showWhen, api, props.rowPath)) return null;
              content = children(node.children);
              break;
            case 'divider':
              content = <FormDivider label={node.label} />;
              break;
            case 'html':
              content = <FormHtml html={node.html} label={node.label} />;
              break;
            case 'button':
              // Never a javascript: link; an unsafe href renders nothing rather than a dead button.
              content = isButtonHref(node.href) ? (
                <Link
                  href={node.href}
                  variant="button"
                  size="md"
                  buttonVariant={node.variant ?? 'primary'}
                  external={node.newTab}
                >
                  {node.label}
                </Link>
              ) : null;
              break;
            case 'embeds':
              content = (
                <FormFieldset legend={node.label}>
                  {children(node.children, prefix ? `${prefix}.${node.name}` : node.name)}
                </FormFieldset>
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
