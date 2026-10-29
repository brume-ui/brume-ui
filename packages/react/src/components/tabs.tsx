import * as RadixTabs from '@radix-ui/react-tabs';
import { type ReactNode, useRef } from 'react';
import { cn } from '../cn';
import { useActiveIndicator } from '../motion/indicator';
import { useBrume } from '../provider';
import { FOCUS_RING } from './focus';

export interface TabItem {
  key: string;
  label: string;
  /** 'error': a danger dot, announced as 「（有錯誤）」 in the tab's name. */
  badge?: 'error';
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange(key: string): void;
  /**
   * The panel of a tab. Every panel stays mounted (the others `hidden`), so fields in other tabs
   * keep their DOM and state, and each tab's `aria-controls` names a panel that exists.
   */
  children(key: string): ReactNode;
  /** Accessible name of the tab list. */
  label: string;
}

/**
 * WAI-ARIA tabs with manual activation: arrow keys, Home and End move focus along the tabs,
 * Enter or Space selects (a panel can be a heavy form section, so focus alone does not switch).
 * An underline slides to the selected tab.
 */
export function Tabs({ items, value, onValueChange, children, label }: TabsProps) {
  const { t } = useBrume();
  const listRef = useRef<HTMLDivElement>(null);
  const underline = useActiveIndicator(listRef, '[role="tab"][data-state="active"]', value);

  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} activationMode="manual">
      <RadixTabs.List
        ref={listRef}
        aria-label={label}
        className="br:relative br:flex br:overflow-x-auto br:border-b br:border-border"
      >
        <span
          aria-hidden="true"
          style={underline.style}
          className="br:pointer-events-none br:absolute br:top-0 br:left-0 br:border-b-2 br:border-accent br:transition-[transform,width,opacity] br:duration-base br:ease-emphasized br:motion-reduce:transition-none"
        />
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.key}
            value={item.key}
            className={cn(
              'br:relative br:inline-flex br:h-10 br:shrink-0 br:items-center br:gap-1.5 br:border-b-2 br:border-transparent br:px-3 br:text-sm br:font-semibold br:whitespace-nowrap br:text-text-muted br:transition-colors br:duration-fast br:ease-out br:hover:text-text br:data-[state=active]:text-text',
              // Before the underline is measured, the selected tab draws its own.
              !underline.ready && 'br:data-[state=active]:border-accent',
              // Drawn inside: the list scrolls horizontally and would clip an outer ring.
              FOCUS_RING,
              'br:focus-visible:-outline-offset-2',
            )}
          >
            {item.label}
            {item.badge === 'error' ? (
              <>
                <span aria-hidden="true" className="br:size-1.5 br:rounded-full br:bg-danger" />
                <span className="br:sr-only">{t('common.hasError')}</span>
              </>
            ) : null}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content
          key={item.key}
          value={item.key}
          forceMount
          // Radix leaves force-mounted panels visible; inactive ones are hidden here.
          hidden={item.key !== value}
          className={cn('br:rounded-input br:pt-4', FOCUS_RING)}
        >
          {children(item.key)}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
