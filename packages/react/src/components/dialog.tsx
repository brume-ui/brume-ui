import * as RadixDialog from '@radix-ui/react-dialog';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, type RefObject, useRef, useState } from 'react';
import { cn } from '../cn';
import { MODAL_MOTION, OVERLAY_MOTION } from '../motion/classes';
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
  headerActions?: ReactNode;
  /** Preserve an external opener when a loading or record change replaces this Dialog instance. */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  busy?: boolean;
  onKeyDown?(event: KeyboardEvent<HTMLDivElement>): void;
  children: ReactNode;
}

const FOCUSABLE =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

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
  headerActions,
  restoreFocusRef,
  busy = false,
  onKeyDown,
  children,
}: DialogProps) {
  const { t } = useBrume();
  const confirm = useConfirm();
  const [maximized, setMaximized] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  async function handleOpenChange(next: boolean) {
    if (busy && !next) return;
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
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (busy || e.nativeEvent.isComposing || e.keyCode === 229) return;
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
        <RadixDialog.Overlay
          className={cn('br:fixed br:inset-0 br:z-50 br:bg-scrim/40', OVERLAY_MOTION)}
        />
        <RadixDialog.Content
          ref={contentRef}
          onKeyDown={handleKeyDown}
          onEscapeKeyDown={(event) => {
            // Radix listens in document capture, before inline controls can handle Escape.
            // Let the inline region's bubbling handler (or its child popup) own this key.
            if (
              event.target instanceof Element &&
              event.target.closest('[data-brume-inline-escape]')
            )
              event.preventDefault();
          }}
          aria-modal="true"
          aria-busy={busy || undefined}
          onCloseAutoFocus={(e) => {
            // The dialog is controlled (no Radix Trigger), so return focus ourselves.
            e.preventDefault();
            (restoreFocusRef?.current ?? returnFocusRef.current)?.focus();
          }}
          onOpenAutoFocus={(e) => {
            returnFocusRef.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            // Start in the content, not on the header's close button: its tooltip would
            // open on focus and swallow the first Esc.
            e.preventDefault();
            const candidates = bodyRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [];
            for (const el of candidates) {
              if (el.closest('[hidden], [aria-hidden="true"]')) continue;
              el.focus();
              if (document.activeElement === el) return;
            }
            contentRef.current?.focus();
          }}
          className={cn(
            'br:fixed br:top-1/2 br:left-1/2 br:z-50 br:flex br:max-h-[calc(100vh-48px)] br:max-w-[calc(100vw-48px)] br:-translate-x-1/2 br:-translate-y-1/2 br:flex-col br:rounded-dialog br:border br:border-border br:bg-surface br:text-text br:shadow-overlay br:[--br-table-header-bg:var(--br-surface)]',
            // Modals scale from their centre; maximize/restore eases the size change.
            'br:transition-[width,height] br:duration-slow br:ease-emphasized',
            MODAL_MOTION,
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
              {headerActions}
              {maximizable ? (
                <IconButton
                  icon={maximized ? Minimize2 : Maximize2}
                  label={maximized ? t('dialog.restore') : t('dialog.maximize')}
                  onClick={() => setMaximized((m) => !m)}
                />
              ) : null}
              <RadixDialog.Close asChild>
                <IconButton icon={X} label={t('common.close')} disabled={busy} />
              </RadixDialog.Close>
            </div>
          </div>
          <div
            ref={bodyRef}
            data-dialog-body=""
            className="br:min-h-0 br:flex-1 br:overflow-y-auto br:px-6 br:py-4"
          >
            {children}
          </div>
          {footer ? (
            <div
              ref={footerRef}
              data-dialog-footer=""
              className="br:flex br:flex-wrap br:shrink-0 br:items-center br:justify-end br:gap-3 br:border-t br:border-border br:px-6 br:py-4 br:[&>button]:shrink-0"
            >
              {footer}
            </div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
