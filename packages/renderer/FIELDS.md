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

## Future custom fields (subplan 3)

The reserved future schema shape is `{ type: 'custom', component: ComponentRef }`.
This is not part of the current `FieldDef` union. `ComponentRef` supplies the
registered component reference; do not introduce a `type: 'component'` field.
The `resolveField(type: string)` signature stays unchanged: a future additional
lookup source resolves custom registrations at the custom-field boundary.
Custom fields will use the same `FieldProps` contract as all built-ins.
