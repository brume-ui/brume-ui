import { Button } from '@brume-ui/brume-react';
import { FormDialog, FormPageView } from '@brume-ui/brume-renderer';
import { useState } from 'react';
import { buildRichTextDialogPage, RICH_TEXT_FIXTURES } from './rich-text-demo-data';

/**
 * Extra controls of the focused richText demo: load another legacy fixture into 「商品介紹」 (as a
 * reset, the way a newly loaded record arrives), remount the form (e.g. mid-upload), and the same
 * editor inside a form dialog and on a form page.
 */
export function RichTextDemoTools({
  onLoadFixture,
  onRemount,
}: {
  onLoadFixture(html: string): void;
  onRemount(): void;
}) {
  const [fixture, setFixture] = useState(RICH_TEXT_FIXTURES[0]?.name ?? '');
  const [open, setOpen] = useState(false);
  const [page] = useState(() => buildRichTextDialogPage('modal'));
  const [formPage] = useState(() => buildRichTextDialogPage('page'));
  const [showPage, setShowPage] = useState(false);
  return (
    <div className="pg-section">
      <label>
        載入舊內容範例{' '}
        <select
          value={fixture}
          onChange={(event) => {
            const next = RICH_TEXT_FIXTURES.find((x) => x.name === event.target.value);
            if (!next) return;
            setFixture(next.name);
            onLoadFixture(next.html);
          }}
        >
          {RICH_TEXT_FIXTURES.map((x) => (
            <option key={x.name} value={x.name}>
              {x.title}
            </option>
          ))}
        </select>
      </label>
      <Button variant="outline" onClick={onRemount}>
        重新掛載表單
      </Button>
      <Button variant="outline" onClick={() => setOpen(true)}>
        在彈窗中編輯
      </Button>
      <Button variant="outline" aria-pressed={showPage} onClick={() => setShowPage((x) => !x)}>
        表單頁版本
      </Button>
      {showPage ? (
        <div data-testid="rich-text-form-page">
          <FormPageView page={formPage} />
        </div>
      ) : null}
      <FormDialog page={page} open={open} onOpenChange={setOpen} onSaved={() => setOpen(false)} />
    </div>
  );
}
