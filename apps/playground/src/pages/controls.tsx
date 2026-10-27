import {
  Button,
  Checkbox,
  Field,
  IconButton,
  PasswordInput,
  Select,
  TextInput,
} from '@brume-ui/brume-react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Page, Panel, Section } from './page';

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const;

export function ButtonPage() {
  return (
    <Page name="button" title="Button" lead="Variants by row; default, disabled and loading.">
      {VARIANTS.map((variant) => (
        <Section key={variant} title={variant}>
          <Panel>
            <div className="pg-row">
              <Button variant={variant}>儲存</Button>
              <Button variant={variant} iconStart={Plus}>
                新增
              </Button>
              <Button variant={variant} size="sm">
                小尺寸
              </Button>
              <Button variant={variant} disabled>
                停用
              </Button>
              <Button variant={variant} loading>
                儲存中
              </Button>
            </div>
          </Panel>
        </Section>
      ))}
    </Page>
  );
}

export function IconButtonPage() {
  return (
    <Page name="icon-button" title="IconButton" lead="Label is required: aria-label and tooltip.">
      <Section title="default / disabled">
        <Panel>
          <div className="pg-row">
            <IconButton icon={Pencil} label="編輯" />
            <IconButton icon={Trash2} label="刪除" />
            <IconButton icon={Plus} label="新增（停用）" disabled />
          </div>
        </Panel>
      </Section>
    </Page>
  );
}

export function TextInputPage() {
  return (
    <Page name="text-input" title="TextInput">
      <Section title="states">
        <Panel>
          <div className="pg-stack">
            <Field label="帳號">
              <TextInput placeholder="請輸入帳號" />
            </Field>
            <Field label="已填寫">
              <TextInput defaultValue="王小明" />
            </Field>
            <Field label="停用">
              <TextInput defaultValue="無法編輯" disabled />
            </Field>
            <Field label="錯誤" error="帳號已被使用，請換一個。">
              <TextInput defaultValue="admin" />
            </Field>
          </div>
        </Panel>
      </Section>
    </Page>
  );
}

export function PasswordInputPage() {
  return (
    <Page name="password-input" title="PasswordInput">
      <Section title="states">
        <Panel>
          <div className="pg-stack">
            <Field label="密碼">
              <PasswordInput defaultValue="secret-123" />
            </Field>
            <Field label="停用">
              <PasswordInput defaultValue="secret-123" disabled />
            </Field>
            <Field label="錯誤" error="密碼至少需要 8 個字元。">
              <PasswordInput defaultValue="abc" />
            </Field>
          </div>
        </Panel>
      </Section>
    </Page>
  );
}

export function FieldPage() {
  return (
    <Page name="field" title="Field" lead="Label, description, error and required marker.">
      <Section title="variants">
        <Panel>
          <div className="pg-stack">
            <Field label="名稱">
              <TextInput />
            </Field>
            <Field label="必填" required>
              <TextInput />
            </Field>
            <Field label="含說明" description="顯示在後台標題列的名稱。">
              <TextInput defaultValue="Brume" />
            </Field>
            <Field label="錯誤" required error="此欄位必填，請輸入名稱。">
              <TextInput />
            </Field>
          </div>
        </Panel>
      </Section>
    </Page>
  );
}

const OPTIONS = [
  { value: 'admin', label: '管理員' },
  { value: 'editor', label: '編輯' },
  { value: 'viewer', label: '檢視者', disabled: true },
];

export function SelectPage() {
  const [value, setValue] = useState<string | undefined>('admin');
  const [empty, setEmpty] = useState<string | undefined>();
  return (
    <Page name="select" title="Select">
      <Section title="states">
        <Panel>
          <div className="pg-stack">
            <Field label="角色">
              <Select options={OPTIONS} value={value} onValueChange={setValue} />
            </Field>
            <Field label="未選擇">
              <Select
                options={OPTIONS}
                value={empty}
                onValueChange={setEmpty}
                placeholder="請選擇角色"
              />
            </Field>
            <Field label="停用">
              <Select options={OPTIONS} value="editor" onValueChange={() => {}} disabled />
            </Field>
            <Field label="錯誤" error="請選擇角色。">
              <Select options={OPTIONS} onValueChange={() => {}} placeholder="請選擇角色" />
            </Field>
          </div>
        </Panel>
      </Section>
    </Page>
  );
}

export function CheckboxPage() {
  const [a, setA] = useState(false);
  const [b, setB] = useState(true);
  return (
    <Page name="checkbox" title="Checkbox">
      <Section title="states">
        <Panel>
          <div className="pg-stack">
            <Checkbox checked={a} onCheckedChange={setA} label="未勾選" />
            <Checkbox checked={b} onCheckedChange={setB} label="已勾選" />
            <Checkbox checked={false} onCheckedChange={() => {}} label="停用" disabled />
            <Checkbox checked onCheckedChange={() => {}} label="停用且已勾選" disabled />
          </div>
        </Panel>
      </Section>
    </Page>
  );
}
