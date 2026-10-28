import { Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { CONTROL_BORDER, CONTROL_SKIN, FOCUS_RING } from './focus';
import { IconButton } from './icon-button';

export interface SearchInputProps {
  /** The applied search term; the field follows it when it changes from outside. */
  value: string;
  onSearch(value: string): void;
  placeholder: string;
  /** Pause after the last keystroke before `onSearch` fires. Default 300. */
  debounceMs?: number;
  /** Accessible name of the field. */
  label: string;
  id?: string;
}

/**
 * Pill search field with a leading icon and a clear button. Typing is debounced; Enter and the
 * clear button emit at once and cancel the pending debounce. Nothing is emitted while an IME is
 * composing (zh/ja input); the composed text is debounced from `compositionend`.
 */
export function SearchInput({
  value,
  onSearch,
  placeholder,
  debounceMs = 300,
  label,
  id,
}: SearchInputProps) {
  const { t } = useBrume();
  const autoId = useId();
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const composing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** The last term sent; `value` coming back equal to it is our own echo, not an outside change. */
  const sent = useRef(value);
  useEffect(() => {
    // An echo can arrive after the user typed on (the list reloads asynchronously); keep their text.
    if (value !== sent.current) setDraft(value);
    sent.current = value;
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  // A pending debounce calls the latest onSearch, not the one from the render that scheduled it.
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const emit = (next: string) => {
    sent.current = next;
    onSearchRef.current(next);
  };
  const schedule = (next: string) => {
    cancel();
    timer.current = setTimeout(() => {
      timer.current = undefined;
      emit(next);
    }, debounceMs);
  };

  return (
    <div className="br:relative br:w-full">
      <Search
        aria-hidden="true"
        className="br:pointer-events-none br:absolute br:top-1/2 br:left-3.5 br:size-4 br:-translate-y-1/2 br:text-text-muted"
      />
      <input
        ref={inputRef}
        id={id ?? autoId}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={draft}
        autoComplete="off"
        onChange={(e) => {
          setDraft(e.target.value);
          if (!composing.current) schedule(e.target.value);
        }}
        onCompositionStart={() => {
          composing.current = true;
          cancel();
        }}
        onCompositionEnd={(e) => {
          composing.current = false;
          schedule(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          // Enter that confirms an IME candidate is not a search (Safari: keyCode 229 after compositionend).
          const ime =
            composing.current || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229;
          if (e.key !== 'Enter' || ime) return;
          e.preventDefault();
          cancel();
          emit(e.currentTarget.value);
        }}
        className={cn(
          CONTROL_SKIN,
          CONTROL_BORDER,
          FOCUS_RING,
          // The icon and clear button sit inside the pill; padding lives here, not in the caller.
          'br:w-full br:rounded-pill br:pr-10 br:pl-10',
          'br:[&::-webkit-search-cancel-button]:appearance-none br:[&::-webkit-search-decoration]:appearance-none',
        )}
      />
      {draft !== '' ? (
        <IconButton
          icon={X}
          label={t('search.clear')}
          onClick={() => {
            cancel();
            setDraft('');
            emit('');
            inputRef.current?.focus();
          }}
          className="br:absolute br:top-1/2 br:right-1 br:size-8 br:-translate-y-1/2 br:text-text-muted br:hover:text-text br:[&>svg]:size-4"
        />
      ) : null}
    </div>
  );
}
