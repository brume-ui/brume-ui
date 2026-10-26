import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useBrume } from '../provider';
import { IconButton } from './icon-button';
import { TextInput, type TextInputProps } from './text-input';

export type PasswordInputProps = Omit<TextInputProps, 'type'>;

export function PasswordInput({ className, ...rest }: PasswordInputProps) {
  const { t } = useBrume();
  const [visible, setVisible] = useState(false);
  return (
    <div className="br:relative br:flex br:items-center">
      <TextInput
        {...rest}
        type={visible ? 'text' : 'password'}
        className={`br:pr-11 ${className ?? ''}`}
      />
      <IconButton
        icon={visible ? EyeOff : Eye}
        label={t(visible ? 'password.hide' : 'password.show')}
        aria-pressed={visible}
        disabled={rest.disabled}
        onClick={() => setVisible((v) => !v)}
        className="br:absolute br:right-1 br:size-8"
      />
    </div>
  );
}
