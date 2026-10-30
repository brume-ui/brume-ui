# Field component contract

All built-in fields use `FieldProps` from the renderer public API. There are no
private value, validation, error, or upload channels. Built-ins are installed with
an internal `registerBuiltInField` registry; `resolveField(type)` returns a
`FieldComponent` or `undefined` for an unknown type.

## Props

| Property         | Meaning                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `def`            | Schema field definition, including its name, label, options and client rules.                                                                        |
| `value`          | Current value at this field's absolute path; may be undefined before input.                                                                          |
| `onChange(next)` | Write the complete next field value through the form state. Never mutate the supplied value.                                                         |
| `onBlur()`       | Mark the field touched; validation then updates on every value change.                                                                               |
| `errors`         | Errors relative to this field: `''` is the field itself and `2.extra.link` is a descendant. Server errors take precedence at the same absolute path. |
| `path`           | Absolute dot-separated value path, such as `images.2.extra.link`.                                                                                    |
| `id`             | Stable unique control ID used by its label and error links.                                                                                          |
| `describedBy`    | Optional space-separated IDs for help/error descriptions (`aria-describedby`).                                                                       |
| `invalid`        | Whether the field has errors; apply to the accessible control.                                                                                       |
| `readOnly`       | Value may be viewed but not changed; no client validation.                                                                                           |
| `disabled`       | Disable interaction using the control's disabled semantics.                                                                                          |
| `form`           | Shared `FormApi` for root values, nested updates, touched validation, errors, reset, submitting state and upload tracking.                           |
| `uploadUrl`      | Optional schema-provided upload endpoint; uploads use the adapter request API.                                                                       |

`FieldComponent` is a React component accepting this contract; individual fields
may specialize `FieldProps<V, D>` to their value and schema definition.
`display` and `hidden`, like `readOnly`, skip client validation. Validation checks
only declared rules, in their original order, and returns the first message.
Optional empty values skip all rules except `required`. Length uses Unicode code
points. The server remains authoritative.

## Wire values

Values are a nested JSON object. Paths are relative to that root, without a
`values.` prefix. Object keys use dots and array indices use numeric segments;
`embeds` adds an object prefix. `setAt` updates immutably and `getAt` reads own
properties only. Empty paths address the root. Prototype-related path segments
(`__proto__`, `constructor`, `prototype`) are rejected for writes and unreadable.

- Text, textarea, email, URL, mobile, hidden and password use strings. Password
  values always load as `''`; an empty edit password means leave it unchanged.
- `date` is `YYYY-MM-DD`; `datetime` is `YYYY-MM-DDTHH:mm`.
- `dateRange` and `datetimeRange` are `{ start?, end? }` using the corresponding formats.
- `number` is a JSON number or null. `decimal` and `currency` are fixed-scale
  strings (for example `"1280.50"`) or null.
- `switch` is boolean. `select` and `radio` are string or null.
- `multipleSelect`, `checkbox` and `tags` are `string[]`.
- Single upload is `UploadValue | null`; multiple upload is `UploadValue[]`, in
  display/sort order. Preserve the schema upload value and any `extra` object.
- `embeds` is an object. Display fields render their supplied JSON value.

## Nested components

A future Repeater is itself a `FieldComponent`. For each row and child definition,
resolve the child with `resolveField(childDef.type)`. Derive the child path with
`joinPath(joinPath(path, String(index)), childDef.name)` (equivalent to
`${path}.${index}.${name}`). Get its value with `form.getValue(childPath)`, write
with `form.setValue(childPath, next)` and blur with `form.touch(childPath)`.

A Repeater's `errors` are already relative to the Repeater. Pass
`scopeErrors(errors, joinPath(String(index), childDef.name))` to its child; or use
`scopeErrors(form.errors, childPath)` against the absolute root errors. Never
scope relative errors with an absolute path. For example `images.2.extra.link`
becomes `2.extra.link` at `images`, then `''` at the link control.
Generate unique child IDs and description links using the same accessibility
contract. Keep unclaimed root errors in the form summary with
`unclaimedErrors(form.errors, fieldPaths)`; do not discard unknown server keys.

## State lifecycle

`form.stateId` is a readonly symbol identifying one mounted state owner. API
wrappers may change on render while this token remains stable. Async integrations
compare `stateId` and `resetVersion` before applying results or clearing pending
state; a new owner or explicit reset invalidates an older operation.

`dirty` uses deep JSON comparison with object keys sorted (array order matters),
so reverting values restores a clean state. `validateAll()` marks every schema
field touched and checks all editable fields, including inactive tab sections;
remaining server errors also prevent a valid result. First blur enables live
validation. Changed values clear server errors for related ancestor/descendant
paths only; no-op writes retain errors. `setServerErrors` replaces the server
error map without filtering undeclared keys. `reset(values?)` clears errors and
touched/submitting state, establishes a new clean baseline when supplied, or
restores the existing baseline. Initial prop rerenders do not reset edits.

`trackUpload()` increments the pending count and returns an idempotent completion
callback. Finish it when the upload settles or is canceled, including failures.
Reset leaves outstanding uploads counted until their callbacks finish; controls
use `resetVersion` to cancel their requests and release their own pending counts.

`form.resetVersion` is a readonly counter incremented only by explicit `reset(values?)`,
including resets to equal values or the same baseline object. Stateful controls
use it to discard local transient state and cancel requests on reset. Ordinary
value writes, pending upload accounting, touch/errors and submitting updates do
not increment it. A proposed field value may be a semantic no-op: `setValue`
then retains the accepted value reference. Controls must distinguish the last
accepted prop from a proposed emission when synchronizing local state.

## Custom fields (subplan 3)

`FieldDef` already declares `{ type: 'custom', component: ComponentRef, displayOnly?: boolean }`.
`ComponentRef` supplies the registered component reference; do not introduce a
`type: 'component'` field. Registry lookup and interactive runtime support remain Task 6 work.
The `resolveField(type: string)` signature stays unchanged: an additional lookup source will
resolve custom registrations at the custom-field boundary. Custom fields use the same
`FieldProps` contract as built-ins; the shared activity walker already skips display-only
custom fields during validation.

## Conditional activity and row state

`useFormState(form, initial, t?)` validates condition/dependency declarations without relying on
mounted controls. Pass the provider's translator as the optional third argument; the default is
zh-TW. Declared rule messages take priority. Malformed primitive/selection/row values without a
rule message use the existing localized `common.hasError` vocabulary with the field label.

`collectValueFields(nodes, values, invalidMessage?)` is the shared current-value walker.
`FormApi.fields` and `FormApi.getField(path)` expose its descriptors:

```ts
interface ValueField {
  path: string;
  def: FieldDef;
  templatePath: string;
  rowPath?: string;
  rowContext: RowContext;
  visible: boolean;
  enabled: boolean;
  readOnly: boolean;
  active: boolean;
  validationError: string | null;
}
```

`path` and `rowPath` use current numeric indexes; `templatePath` uses `*` only at declared array
boundaries. `rowPath` is the nearest repeater row or selected relation item, including a single
selected item. Upload extras inherit their enclosing row origin. Row context entries use the
canonical container path. Repeater entries preserve `_brume.key` and optional `_brume.id`;
selected items use exactly `{path, key: item.id, id: item.id}`. This selected ID is the source
model identity, never an intermediary child ID. Missing row metadata is not replaced by an
index or random key. Row creation/readback normalization belongs to the repeater/server layers.

Descriptors are snapshots, cached until values, declarations, or translator change. Consumers
must not mutate them or use descriptor object identity as a persistent owner. Use the stable
`stateId`, `resetVersion`, canonical path and full row context for asynchronous ownership.
`FieldProps.rowContext` and `Nodes.rowContext` are optional; existing upload-extra rendering
preserves the enclosing context. Stable mounted row wrappers and async request generations are
provided by the later repeater/picker implementations.

`useFieldConditions(def, form, rowPath?)` reads `{visible, enabled}` from these same descriptors.
Pass the declaration object from the form and the explicit nearest row path for row fields.
It throws if that declaration/row is not currently present. It includes ancestor activity;
`enabled` excludes temporary submit locking and does not replace `readOnly`.

`evaluateCondition(condition, values, rowPath?, options?)` is pure. The first three arguments
use strict typed JSON equality. Optional `getField(path)` supplies declaration metadata for
numeric controls; optional `isInvalid(path)` supplies precomputed validation failures. Only
number fields convert numeric strings to numbers. Currency/decimal strings use the public
`canonicalDecimal(value, decimals)` from brume-react: exact digit arithmetic, half-away-from-zero
rounding, negative-zero folding and padding; invalid input returns null, empty input returns ''.
Raw decimal/currency values must first fit the field's declared scale; extra fraction digits are
invalid even when rounding would produce an otherwise matching value. The standalone utility
still rounds for display/paste/calculator use. Money comparison operands retain their JSON types.
Text/product codes are never coerced.

The walker validates every controlling value before resolving activity. If any dependency of
a condition has a validation failure or malformed typed value, the **entire condition** evaluates
true, including `not`/`all`/`any`; invalid input cannot hide a dependent requirement. Ancestor
inactivity still applies. Invalid inactive drafts stay retained and become blocking again when
editable. `empty` means only null, missing, exact empty string, or empty list; whitespace, false,
and zero are present. `all([])` is true and `any([])` is false.

`validateConditionDeclarations(nodes)` throws on unsafe/unknown condition, remote-dependency,
or exclusion paths and activity cycles, even for empty repeater templates. Scalar paths reject
wildcards. Numeric indexes can match declared row templates. Exclusion dependencies are checked
for known declarations but are not activity-cycle edges. Reserved selected-item `id` and `_brume`
identity metadata are not implicit dependency fields: `row('id')` fails with an unknown declaration
path unless it is a separately declared field (reserved IDs should not be redeclared). Use
`rowContext` for identity. Layout tabs/sections never affect
validation. Literal `hidden` preserves its existing validation semantics and is distinct from
`showWhen=false`. Disabled, readonly, display and display-only custom fields are noneditable.

`moveRow(path, from, to)` and `removeRow(path, index)` accept declared repeater arrays and multiple
relation selections. They reject unsafe paths and invalid indexes before mutation, preserve row
objects/metadata, remap all descendant touched/server-error paths, and leave unrelated branches
and unknown errors intact. Removal drops only the removed row's errors. Neither operation changes
`stateId` or `resetVersion`; dirty state still compares against the original baseline. These are
state operations, not mounted row UI or pending-upload lifecycle completion.

Server errors are retained internally and filtered by the longest current declared field owner.
Known inactive/noneditable errors do not block submission; unclaimed errors do. Reactivation
restores retained errors unless their owning value changed. Editing one extra through a parent
object write preserves unchanged sibling errors. Draft values are never stripped by activity.

Shared cross-language cases live in `packages/schema/fixtures/conditions/evaluation.json`.
They cover strict operands, exact empty semantics, row origins, booleans, numeric/money values,
and conservative invalid-controller behavior. Backend parity tests vendor the bytes independently.
