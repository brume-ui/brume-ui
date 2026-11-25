import { Button } from '@brume-ui/brume-react';
import { FormDialog } from '@brume-ui/brume-renderer';
import type { FormPage } from '@brume-ui/brume-schema';
import { useState } from 'react';
import { colorField, node } from './form-feature-data';

/** The colour field inside a form dialog: the picker panel must open and close inside the Dialog. */
function buildColorDialogPage(): FormPage {
  return {
    type: 'form',
    title: '在彈窗中編輯',
    name: '品牌顏色',
    formId: 'form.field.color.modal',
    mode: 'edit',
    record: { id: '42' },
    form: { layout: 'stacked', nodes: [node(colorField)] },
    values: { value: '#0091ff' },
    submit: { method: 'put', url: '/demo/focused/save', label: '儲存' },
    after: { options: ['edit', 'list'], default: 'edit' },
    presentation: 'modal',
    size: 'md',
  };
}

/** Extra control of the focused colour demo: the same field in a form dialog. */
export function ColorDemoTools() {
  const [open, setOpen] = useState(false);
  const [page] = useState(buildColorDialogPage);
  return (
    <div className="pg-section">
      <Button variant="outline" onClick={() => setOpen(true)}>
        在彈窗中編輯
      </Button>
      <FormDialog page={page} open={open} onOpenChange={setOpen} onSaved={() => setOpen(false)} />
    </div>
  );
}
