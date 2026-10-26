import * as RadixDialog from '@radix-ui/react-dialog';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useRef, useState } from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { useConfirm } from './confirm';
import { IconButton } from './icon-button';

export interface DialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  maximizable?: boolean;
  /** Unsaved changes: every way of closing asks for confirmation first. */
  dirty?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

const FOCUSABLE =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

const WIDTHS = { sm: 'br:w-[420px]', md: 'br:w-[640px]', lg: 'br:w-[880px]' } as const;

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  maximizable = false,
  dirty = false,
  footer,
  children,
}: DialogProps) {
  const { t } = useBrume();
  const confirm = useConfirm();
  const [maximized, setMaximized] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  async function handleOpenChange(next: boolean) {
    if (next || !dirty) {
      if (!next) setMaximized(false);
      onOpenChange(next);
      return;
    }
    const discard = await confirm({
      title: t('dialog.discard.title'),
      confirmLabel: t('dialog.discard.confirm'),
      tone: 'danger',
    });
    if (discard) {
      setMaximized(false);
      onOpenChange(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
    const primary = footerRef.current?.querySelector<HTMLButtonElement>(
      '[type="submit"], [data-dialog-primary]',
    );
    if (!primary || primary.disabled) return;
    e.preventDefault();
    primary.click();
  }

  return (
    <RadixDialog.Root open={open} onOpenChange={handleOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="br:fixed br:inset-0 br:z-50 br:bg-text/40" />
        <RadixDialog.Content
          onKeyDown={handleKeyDown}
          aria-modal="true"
          onCloseAutoFocus={(e) => {
            // The dialog is controlled (no Radix Trigger), so return focus ourselves.
            e.preventDefault();
            returnFocusRef.current?.focus();
          }}
          onOpenAutoFocus={(e) => {
            returnFocusRef.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            // Start in the content, not on the header's close button: its tooltip would
            // open on focus and swallow the first Esc.
            const first = bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE);
            if (first) {
              e.preventDefault();
              first.focus();
            }
          }}
          className={cn(
            'br:fixed br:top-1/2 br:left-1/2 br:z-50 br:flex br:max-h-[calc(100vh-48px)] br:max-w-[calc(100vw-48px)] br:-translate-x-1/2 br:-translate-y-1/2 br:flex-col br:rounded-dialog br:border br:border-border br:bg-surface br:text-text br:shadow-overlay',
            maximized ? 'br:w-[calc(100vw-48px)] br:h-[calc(100vh-48px)]' : WIDTHS[size],
          )}
        >
          <div className="br:flex br:shrink-0 br:items-start br:justify-between br:gap-4 br:border-b br:border-border br:px-6 br:py-4">
            <div className="br:min-w-0">
              <RadixDialog.Title className="br:text-lg br:font-semibold">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="br:mt-1 br:text-sm br:text-text-muted">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <div className="br:flex br:shrink-0 br:items-center br:gap-1">
              {maximizable ? (
                <IconButton
                  icon={maximized ? Minimize2 : Maximize2}
                  label={maximized ? t('dialog.restore') : t('dialog.maximize')}
                  onClick={() => setMaximized((m) => !m)}
                />
              ) : null}
              <RadixDialog.Close asChild>
                <IconButton icon={X} label={t('common.close')} />
              </RadixDialog.Close>
            </div>
          </div>
          <div ref={bodyRef} className="br:min-h-0 br:flex-1 br:overflow-y-auto br:px-6 br:py-4">
            {children}
          </div>
          {footer ? (
            <div
              ref={footerRef}
              className="br:flex br:shrink-0 br:justify-end br:gap-3 br:border-t br:border-border br:px-6 br:py-4"
            >
              {footer}
            </div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
