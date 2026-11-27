import {
  AutocompleteInput,
  CheckboxTree,
  DualListbox,
  FormCollapsible,
  KeyValueInput,
  type KeyValuePair,
  ListInput,
} from '@brume-ui/brume-react';
import { type ReactNode, useState } from 'react';
import { Page, Panel, Section } from './page';
import { BRANCHES, CATEGORY_TREE, LISTBOX_OPTIONS } from './structural-fields-data';

function State({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pg-stack">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

const PAIRS: KeyValuePair[] = [
  { key: '材質', value: '純棉' },
  { key: '產地', value: '臺灣' },
];

function KeyValueStates() {
  const [filled, setFilled] = useState<KeyValuePair[]>(PAIRS);
  const [empty, setEmpty] = useState<KeyValuePair[]>([]);
  const [bad, setBad] = useState<KeyValuePair[]>([
    { key: '材質', value: '純棉' },
    { key: '材質', value: '麻' },
  ]);
  return (
    <Section title="KeyValueInput">
      <Panel>
        <State title="空白">
          <KeyValueInput label="鍵值（空白）" value={empty} onChange={setEmpty} />
        </State>
        <State title="已填寫">
          <KeyValueInput label="鍵值（已填寫）" value={filled} onChange={setFilled} max={6} />
        </State>
        <State title="錯誤">
          <KeyValueInput
            label="鍵值（錯誤）"
            value={bad}
            onChange={setBad}
            invalid
            errors={{ 1: { key: '規格不可重複。' } }}
          />
        </State>
        <State title="唯讀">
          <KeyValueInput label="鍵值（唯讀）" value={PAIRS} onChange={() => {}} readOnly />
        </State>
        <State title="停用">
          <KeyValueInput label="鍵值（停用）" value={PAIRS} onChange={() => {}} disabled />
        </State>
      </Panel>
    </Section>
  );
}

function ListStates() {
  const [filled, setFilled] = useState(['手工製作', '當日現做', '可客製刻字']);
  const [empty, setEmpty] = useState<string[]>([]);
  const [bad, setBad] = useState(['手工製作', '這是一個超過二十個字的賣點文字範例很長很長']);
  return (
    <Section title="ListInput">
      <Panel>
        <State title="空白">
          <ListInput label="清單（空白）" value={empty} onChange={setEmpty} />
        </State>
        <State title="已填寫">
          <ListInput label="清單（已填寫）" value={filled} onChange={setFilled} max={6} />
        </State>
        <State title="錯誤">
          <ListInput
            label="清單（錯誤）"
            value={bad}
            onChange={setBad}
            invalid
            errors={{ 1: '最多 20 字。' }}
          />
        </State>
        <State title="唯讀">
          <ListInput label="清單（唯讀）" value={['限量']} onChange={() => {}} readOnly />
        </State>
        <State title="停用">
          <ListInput label="清單（停用）" value={['預購']} onChange={() => {}} disabled />
        </State>
      </Panel>
    </Section>
  );
}

function AutocompleteStates() {
  const [empty, setEmpty] = useState('');
  const [filled, setFilled] = useState('臺北市');
  return (
    <Section title="AutocompleteInput">
      <Panel>
        <State title="空白（500 個建議，最多顯示 50 筆）">
          <AutocompleteInput
            label="門市（空白）"
            value={empty}
            onChange={setEmpty}
            options={BRANCHES}
          />
        </State>
        <State title="已填寫">
          <AutocompleteInput
            label="門市（已填寫）"
            value={filled}
            onChange={setFilled}
            options={BRANCHES}
          />
        </State>
        <State title="錯誤">
          <AutocompleteInput
            label="門市（錯誤）"
            value=""
            onChange={() => {}}
            options={BRANCHES}
            invalid
          />
        </State>
        <State title="唯讀">
          <AutocompleteInput
            label="門市（唯讀）"
            value="新北市"
            onChange={() => {}}
            options={BRANCHES}
            readOnly
          />
        </State>
        <State title="停用">
          <AutocompleteInput
            label="門市（停用）"
            value="桃園市"
            onChange={() => {}}
            options={BRANCHES}
            disabled
          />
        </State>
      </Panel>
    </Section>
  );
}

function TreeStates() {
  const [leaves, setLeaves] = useState<string[]>(['tea-black']);
  const [all, setAll] = useState<string[]>([]);
  const [independent, setIndependent] = useState<string[]>(['drink', 'cake']);
  return (
    <Section title="CheckboxTree">
      <Panel>
        <State title="只存葉節點（含部分勾選）">
          <CheckboxTree
            label="分類（葉節點）"
            options={CATEGORY_TREE}
            mode="leaves"
            value={leaves}
            onChange={setLeaves}
            defaultExpanded
          />
        </State>
        <State title="連父節點一起存（空白）">
          <CheckboxTree
            label="分類（含父節點）"
            options={CATEGORY_TREE}
            mode="all"
            value={all}
            onChange={setAll}
          />
        </State>
        <State title="各自獨立">
          <CheckboxTree
            label="分類（獨立）"
            options={CATEGORY_TREE}
            mode="independent"
            value={independent}
            onChange={setIndependent}
          />
        </State>
        <State title="唯讀">
          <CheckboxTree
            label="分類（唯讀）"
            options={CATEGORY_TREE}
            mode="leaves"
            value={['coffee']}
            onChange={() => {}}
            readOnly
          />
        </State>
        <State title="停用">
          <CheckboxTree
            label="分類（停用）"
            options={CATEGORY_TREE}
            mode="leaves"
            value={['cookie']}
            onChange={() => {}}
            disabled
          />
        </State>
      </Panel>
    </Section>
  );
}

function DualStates() {
  const [empty, setEmpty] = useState<string[]>([]);
  const [filled, setFilled] = useState<string[]>(['tw', 'jp']);
  return (
    <Section title="DualListbox">
      <Panel>
        <State title="空白">
          <DualListbox
            label="地區（空白）"
            options={LISTBOX_OPTIONS}
            value={empty}
            onChange={setEmpty}
          />
        </State>
        <State title="已選（最多 3 個）">
          <DualListbox
            label="地區（已選）"
            options={LISTBOX_OPTIONS}
            value={filled}
            onChange={setFilled}
            max={3}
          />
        </State>
        <State title="錯誤">
          <DualListbox
            label="地區（錯誤）"
            options={LISTBOX_OPTIONS}
            value={[]}
            onChange={() => {}}
            invalid
          />
        </State>
        <State title="唯讀">
          <DualListbox
            label="地區（唯讀）"
            options={LISTBOX_OPTIONS}
            value={['hk']}
            onChange={() => {}}
            readOnly
          />
        </State>
        <State title="停用">
          <DualListbox
            label="地區（停用）"
            options={LISTBOX_OPTIONS}
            value={['kr']}
            onChange={() => {}}
            disabled
          />
        </State>
      </Panel>
    </Section>
  );
}

function CollapsibleStates() {
  return (
    <Section title="FormCollapsible">
      <Panel>
        <FormCollapsible id="demo-open" title="展開的群組">
          <p>群組內容保持掛載。</p>
        </FormCollapsible>
        <FormCollapsible id="demo-closed" title="收合的群組" defaultCollapsed>
          <p>收合時不可見、也無法用鍵盤到達。</p>
        </FormCollapsible>
      </Panel>
    </Section>
  );
}

/** Every structural control in its states; the form-level behaviour lives in the focused demos. */
export function StructuralFieldsPage() {
  return (
    <Page
      name="structural-fields"
      title="結構欄位元件"
      lead="鍵值、清單、自動完成、核取樹、雙欄選單與可收合群組：空白、已填寫、錯誤、唯讀、停用。"
    >
      <KeyValueStates />
      <ListStates />
      <AutocompleteStates />
      <TreeStates />
      <DualStates />
      <CollapsibleStates />
    </Page>
  );
}
