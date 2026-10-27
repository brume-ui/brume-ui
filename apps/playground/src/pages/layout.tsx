import { Button, Card, PageHeader } from '@brume-ui/brume-react';
import { Plus } from 'lucide-react';
import { Page, Section } from './page';

export function PageHeaderPage() {
  return (
    <Page name="page-header" title="PageHeader">
      <Section title="title only">
        <PageHeader title="使用者" />
      </Section>
      <Section title="description + actions">
        <PageHeader
          title="使用者"
          description="管理可以登入後台的人員。"
          actions={<Button iconStart={Plus}>新增使用者</Button>}
        />
      </Section>
    </Page>
  );
}

export function CardPage() {
  return (
    <Page name="card" title="Card">
      <Section title="with title">
        <Card title="基本資料">
          <p>名稱、信箱與角色。</p>
        </Card>
      </Section>
      <Section title="no title">
        <Card>
          <p>沒有標題的卡片。</p>
        </Card>
      </Section>
      <Section title="padding none">
        <Card title="無內距" padding="none">
          <p style={{ margin: 0, padding: 16 }}>內容自己決定內距。</p>
        </Card>
      </Section>
    </Page>
  );
}

export function AppShellPage() {
  return (
    <Page
      name="app-shell"
      title="AppShell parts"
      lead="The shell, sidebar, top menu, breadcrumbs, user menu and drawer are rendered as one on the shell page."
    >
      <Section title="see">
        <a href="#/shell">/#/shell</a>
      </Section>
    </Page>
  );
}
