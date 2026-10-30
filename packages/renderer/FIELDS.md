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
Row/item containers only own their current rows, declared descendants/groups and protocol identity
properties. Missing rows and undeclared descendants remain unclaimed, even inside inactive parents.
Other controls, including custom composite fields, retain ownership of their relative subpaths;
their internal data is not treated as a declared repeater tree.
Known inactive/noneditable errors do not block submission; unclaimed errors do. Reactivation
restores retained errors unless their owning value changed. Editing one extra through a parent
object write preserves unchanged sibling errors. Draft values are never stripped by activity.

Shared cross-language cases live in `packages/schema/fixtures/conditions/evaluation.json`.
They cover strict operands, exact empty semantics, row origins, booleans, numeric/money values,
and conservative invalid-controller behavior. Backend parity tests vendor the bytes independently.

### Remote choices and shared picker request seam

`useRemoteOptions({remote?, form, path, rowContext?, active?})` returns `scopeKey`, `enabled`,
`request<T extends OptionsResponse = OptionsResponse>(query, channel?)`, `load({q,page})`,
`resolveLabels(ids)`, and `cancel('search'|'labels')`. `OptionsQuery` has optional `q`, `page`,
`perPage`, `section`, and `values`. Generic `request<PickerSearchResponse>` preserves columns and
sections; it does not project responses to Combobox items. `values` defaults to the independent
labels channel; other queries default to search. A newer request cancels only its own channel.
All traffic uses `BrumeAdapter.request`, abort signals, and generation fences for noncooperative
adapters. Rejected/obsolete requests never clear draft values.

`scopeKey` is an opaque identity token for endpoint, canonical dependencies, canonical declaration,
row-context chain, adapter, mounted form `stateId`, and `resetVersion`. Numeric movement alone does
not change it when stable identity and dependencies remain unchanged. `path` must track that same
row at its current location; `rowContext` must agree with its current descriptor. Removed ownership
or `active:false` invalidates requests. Future mounted repeater/picker wrappers must use stable
`_brume.key` / selected source `id` keys, unmount removed rows, and carry the outer-to-inner context.
Removing/reselecting the same ID creates a fresh mounted owner or an intervening scope/selection
generation; old replies cannot revive it.

Combobox and TagsInput accept `scopeKey` to invalidate selected-label and search-page caches while
retaining the typed query/open state. `cancelLabels` cancels hydration on selection clear/remove,
reset, and unmount. Search and selected hydration have independent lifecycles. Loading, empty,
failed/retry and unavailable states use all three locales. Composition Enter prevents native form
submission; Tags otherwise retains its free-text, comma, paste, max/maxLength and chip behavior.
`excludedChoiceValues(fields, values, path)` exports the shared exclusion evaluator for picker reuse.
Exclusions are recomputed at render time so existing loaded pages respond to sibling changes.

Focused MemoryAdapter fixture: playground `/#/form-relations`, with Category A/B/C dependency
controls, A/B reply delays, failure/retry, reset, hierarchical options, remote tag suggestions and
fixed sibling choices with stable row swap. This fixture does not implement the repeater UI.

The same hook also accepts `StandaloneRemoteOptionsConfig` for Grid sources:
`{remote?:{url:string,dependsOn?:never}, ownerKey:string, resolvedDepends?:Record<string,unknown>,
resetKey?:unknown, rowContext?:RowContext, active?:boolean}`. This branch has no FormApi or path;
it owns a stable token for its mounted lifetime. `ownerKey` is the server declaration/source key,
`resolvedDepends` is explicit canonical server-declared source context (not arbitrary URL state),
and `resetKey` must change on an explicit Grid clear/reset/invalidation even when values are
identical. Endpoint/context/owner changes and unmount invalidate both channels. Standalone callers
cannot provide unresolved Form `dependsOn` paths. `RemoteOptionsConfig` is the union of this shape
and `FormRemoteOptionsConfig`; `RemoteOptionsSource` publishes the opaque scope token and methods.

### Relation picker and local selection drafts

`relation` is rendered by the public transport-neutral `RelationPicker` from brume-react. Its
required props are `value: RelationItem[]`, `onChange(next: RelationItem[]): void`, `multiple`,
`items: PickerSearchResponse['data']`, `pagination: PickerSearchResponse['pagination']`, `query`,
`loading`, `label`, `onQueryChange`, `onPageChange`, `onSectionChange` and `onRetry`. Optional
`columns`, `sections`, `section`, `error`, and `disabled` describe presentation. Pagination uses
only `page/perPage/hasMore`; previous/next controls never invent totals. Single field wire values
remain null/object, converted to a zero/one item array only at this boundary. Search option labels
and display columns never become writable relation properties.

Optional `selectedOptions: readonly OptionItem[]` supplies independently hydrated label metadata;
it is not appended to the search page. `onOpenChange(open)` observes explicit opening/closing.
`commitDisabled` disables Apply while draft uploads are pending; Cancel stays available.
`renderSelection(item,index,onChangeNext,draft,getDraft)` receives the selected item, its current
index, an explicit item replacement callback, the full render snapshot, and a live read accessor.
Existing callbacks taking only the first three arguments remain valid. `getDraft()` is stable for
one selected ownership generation and returns the latest complete draft synchronously, or `[]`
once that selection is removed, replaced, closed or unmounted. Removing/reselecting the same ID
creates fresh ownership even in one event. A stale callback cannot edit a replacement selection.

The renderer uses a local FormApi overlay for each selected owner. `FormApi.definition: FormDef`
is the full authoritative declaration tree, including empty row templates; overlays preserve it.
All reads use the current complete picker draft over the live parent values and the shared value
walker. Writes, touched paths, row operations, errors and pending uploads stay local until Apply.
Selected fields render through the ordinary `Nodes`, with flattened error paths such as
`products.0.quantity` (not `products.0.extra.quantity`). The canonical selection context remains
`{path, key: selectedId, id: selectedId}`. A same-ID replacement changes the local FormApi ownership
and remounts its child controls; ordinary numeric movement preserves ownership. Upload cancellation
aborts and discards late completion. Nested repeater/custom children will use this same contract;
Task 5/6 supply those renderers and their deeper acceptance tests.

Opening creates a deep draft copy. Search, page and section changes preserve selection order and
extras; Cancel discards them and Apply emits once. Endpoint/dependency/form-reset/source-identity
changes deliberately close and discard the uncommitted draft, preserving committed values and
starting fresh metadata hydration. Only the existing page/Dialog/Popover surface is used. Escape
cancels the inline region and restores its trigger; child popups retain their own Escape handling.
Enter in text inputs cannot submit the containing form. Button refs are supported for restoration.

Grid `selectTable` and `multipleSelectTable` reuse this picker with a real standalone source:
`endpoints.options` plus encoded filter key, owner identity `gridId:filterKey`, and applied-filter
reset context. Panel Reset remounts the controls even for identical values. Committed Grid values
are string/string-array query values, never relation objects; old Combobox filter APIs remain.
The `/#/form-relations` MemoryAdapter fixture now includes paged/sectioned relation selection,
a FormDialog and Grid table filter in addition to its existing remote delay/failure controls.

Browser specs in `apps/playground/e2e/relation-picker.spec.ts` cover keyboard, the one-dialog
policy, 390px geometry, axe and light/dark screenshot cases. They require real-browser CI acceptance;
unit tests/builds do not substitute for that gate.

Relation error navigation preserves the root field-ID namespace. Internally, `Nodes` provides
`FieldIdPrefixContext` and composite selection Nodes reuse it. `RelationField` keeps its supplied
stable ID on its fieldset. `FieldRevealContext` lets a mounted composite register
`register(path, reveal): cleanup`; FormView reveals ancestor composites in walker order before
looking up and focusing the error target. Relation-level errors focus the existing trigger;
selected extra errors can reveal a closed picker without a new public picker API.

`fieldOwnershipKey(form, path, rowContext?)` is the shared internal mounted-control identity:
canonical declaration template plus the complete explicit RowContext chain when both exist,
otherwise the numeric/current path. `Nodes` uses this key for field wrappers and combines it with
`resetVersion` for controls. `UploadField` uses the same identity instead of treating every numeric
path move as a replacement; value replacement, form stateId change and resetVersion still replace
its upload controller. Upload completion calls the current field callback, so a surviving selected
ID receives its token at the new numeric position. Removed/same-ID-replaced owners still unmount
and abort; late replies cannot write the replacement selection. Task 5 should reuse these helpers
while mounting repeater rows by stable keys and preserving the existing selection-generation reset.

This change does not alter upload transport: multipart still carries `file` and the request-start
`field` path only. Adding rowContext JSON to upload requests remains a later protocol task; options
requests continue carrying their existing separate rowContext chain.
