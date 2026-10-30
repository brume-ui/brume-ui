import { Alert, Button, Dialog, isSafeHref, useBrume } from '@brume-ui/brume-react';
import type { AfterSave, FormSubmitSuccess, GridRow, ListPage } from '@brume-ui/brume-schema';
import { useEffect, useState } from 'react';
import { FormDialog } from '../../form/form-dialog';
import { GridView } from '../grid-view';
import { useGridNavigation } from '../use-grid-navigation';
import { QuickCreate } from './quick-create';
import { useFormLoader } from './use-form-loader';

export function ResourceGridView({ page }: { page: ListPage }) {
  const { adapter, t } = useBrume();
  const { refresh } = useGridNavigation();
  const loader = useFormLoader();
  const [opened, setOpened] = useState<{ url: string; id?: string } | null>(null);
  // The effective form can change after lifecycle hooks. Only the loader's current
  // generation reaches this branch; cleared or superseded responses never navigate.
  useEffect(() => {
    if (opened && loader.page?.presentation === 'page') {
      const url = opened.url;
      setOpened(null);
      loader.clear();
      adapter.visit(url);
    }
  }, [opened, loader.page, loader.clear, adapter]);
  function open(url: string, id?: string) {
    if (!isSafeHref(url)) return;
    if (page.resource?.presentation === 'page') {
      adapter.visit(url);
      return;
    }
    setOpened({ url, id });
    void loader.load(url);
  }
  function close() {
    setOpened(null);
    loader.clear();
  }
  function edit(row: GridRow) {
    const url =
      page.resource?.editUrl?.replaceAll('{id}', encodeURIComponent(String(row.id))) ??
      row._meta?.editUrl;
    if (url) open(url, String(row.id));
  }
  function saved(result: FormSubmitSuccess, after: AfterSave) {
    const redirect = result.feedback?.redirect;
    if (redirect) {
      if (isSafeHref(redirect)) adapter.visit(redirect);
      return;
    }
    if (after === 'view') {
      if (result.urls.view && isSafeHref(result.urls.view)) adapter.visit(result.urls.view);
      return;
    }
    if (after === 'list') close();
    else {
      const url =
        after === 'edit' ? result.urls.edit : (result.urls.create ?? page.resource?.createUrl);
      if (url && isSafeHref(url)) {
        setOpened({ url, id: after === 'edit' ? String(result.id) : undefined });
        void loader.load(url);
      }
    }
    refresh();
  }
  const createUrl = page.resource?.createUrl;
  const index =
    opened?.id === undefined ? -1 : page.rows.findIndex((row) => String(row.id) === opened.id);
  const prev = index > 0 ? page.rows[index - 1] : undefined;
  const next = index >= 0 ? page.rows[index + 1] : undefined;
  return (
    <>
      <GridView
        page={page}
        onEdit={page.resource?.editUrl ? edit : undefined}
        toolbarStart={
          <>
            {createUrl ? (
              <Button onClick={() => open(createUrl)}>
                {t('resource.create', { name: page.resource?.name ?? '' })}
              </Button>
            ) : null}
            {page.quickCreate ? (
              <QuickCreate
                key={page.quickCreate.submitUrl}
                def={page.quickCreate}
                onCreated={refresh}
              />
            ) : null}
          </>
        }
      />
      {loader.error && opened ? (
        <Dialog
          open
          title={t('form.loading')}
          onOpenChange={(value) => {
            if (!value) close();
          }}
        >
          <Alert tone="danger">{loader.error}</Alert>
          <Button onClick={() => void loader.load(opened.url)}>{t('resource.retry')}</Button>
        </Dialog>
      ) : (
        <FormDialog
          open={Boolean(opened) && loader.page?.presentation !== 'page'}
          page={loader.page}
          onOpenChange={(value) => {
            if (!value) close();
          }}
          onSaved={saved}
          nav={{
            prev: prev ? () => edit(prev) : undefined,
            next: next ? () => edit(next) : undefined,
          }}
        />
      )}
    </>
  );
}
