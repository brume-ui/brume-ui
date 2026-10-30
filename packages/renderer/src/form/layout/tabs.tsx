import { Tabs, useBrume } from '@brume-ui/brume-react';
import type { FormNode } from '@brume-ui/brume-schema';
import type { ReactNode } from 'react';

type Section = Extract<FormNode, { type: 'section' }>;
export function FormTabs({
  sections,
  errors,
  value,
  onChange,
  children,
}: {
  sections: Section[];
  errors: Set<string>;
  value: string;
  onChange(key: string): void;
  children(section: Section): ReactNode;
}) {
  const { t } = useBrume();
  return (
    <Tabs
      label={t('form.sections')}
      value={value}
      onValueChange={onChange}
      items={sections.map((s) => ({
        key: s.key,
        label: s.title,
        badge: errors.has(s.key) ? 'error' : undefined,
      }))}
    >
      {(key) => {
        const section = sections.find((s) => s.key === key);
        return section ? children(section) : null;
      }}
    </Tabs>
  );
}
