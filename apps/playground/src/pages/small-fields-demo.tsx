import { Button, IconGlyph } from '@brume-ui/brume-react';
import { FormDialog } from '@brume-ui/brume-renderer';
import type { FormPage } from '@brume-ui/brume-schema';
import { useState } from 'react';
import { node } from './form-feature-data';
import { iconField } from './small-fields-data';

/** The icon field inside a form dialog: the picker must open, scroll and close inside the Dialog. */
function buildIconDialogPage(): FormPage {
  return {
    type: 'form',
    title: '在彈窗中編輯',
    name: '選單圖示',
    formId: 'form.field.icon.modal',
    mode: 'edit',
    record: { id: '42' },
    form: { layout: 'stacked', nodes: [node(iconField)] },
    values: { value: 'settings' },
    submit: { method: 'put', url: '/demo/focused/save', label: '儲存' },
    after: { options: ['edit', 'list'], default: 'edit' },
    presentation: 'modal',
    size: 'md',
  };
}

const GLYPH_STATES: { name: string; note: string }[] = [
  { name: 'settings', note: '一般圖示' },
  { name: 'user-round', note: '多段名稱' },
  { name: 'icon-that-lucide-removed', note: '不存在的名稱（後備圖示）' },
];

/** Extra controls of the focused icon demo: the dialog case and the read-only glyph states. */
export function IconDemoTools() {
  const [open, setOpen] = useState(false);
  const [page] = useState(buildIconDialogPage);
  return (
    <div className="pg-section">
      <Button variant="outline" onClick={() => setOpen(true)}>
        在彈窗中編輯
      </Button>
      <FormDialog page={page} open={open} onOpenChange={setOpen} onSaved={() => setOpen(false)} />
      <ul data-testid="icon-glyph-states" aria-label="IconGlyph 狀態">
        {GLYPH_STATES.map((state) => (
          <li key={state.name}>
            <IconGlyph name={state.name} className="pg-glyph" /> {state.note}：
            <code>{state.name}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
