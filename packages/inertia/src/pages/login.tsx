import {
  BrumeProvider,
  Button,
  Card,
  Checkbox,
  Field,
  PasswordInput,
  TextInput,
  Toaster,
  useBrume,
} from '@herb09638/brume-react';
import { Head, useForm } from '@inertiajs/react';
import { type FormEvent, useRef } from 'react';
import { inertiaAdapter } from '../default-adapter';
import { useFlashToast } from '../flash';
import { useHtmlLang } from '../use-html-lang';
import { useShared } from '../use-shared';

/** Inertia component `brume/login`: its own centered layout, no AppShell. */
export function LoginPage({ status }: { status?: string }) {
  const shared = useShared();
  useFlashToast(shared.flash);
  useHtmlLang(shared.app.locale);
  return (
    <BrumeProvider adapter={inertiaAdapter} locale={shared.app.locale}>
      <div
        data-brume=""
        className="br-root br:flex br:min-h-screen br:items-center br:justify-center br:bg-surface-canvas br:px-4 br:py-12 br:text-text"
      >
        <main className="br:w-full br:max-w-sm">
          <LoginForm appName={shared.app.name} status={status} />
        </main>
      </div>
      <Toaster />
    </BrumeProvider>
  );
}

function LoginForm({ appName, status }: { appName: string; status?: string }) {
  const { t } = useBrume();
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const form = useForm({ username: '', password: '', remember: false });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(window.location.pathname, {
      onError: (errors) => {
        if (errors.username) usernameRef.current?.focus();
        else if (errors.password) passwordRef.current?.focus();
      },
      onFinish: () => form.reset('password'),
    });
  };

  return (
    <Card>
      <Head title={t('login.pageTitle')} />
      <div className="br:mb-6 br:flex br:flex-col br:gap-1">
        <h1 className="br:text-xl br:font-bold br:text-text">{appName}</h1>
        <p className="br:text-sm br:text-text-muted">{t('login.title')}</p>
      </div>
      {status ? (
        <p
          role="status"
          className="br:mb-4 br:rounded-input br:bg-surface-canvas br:px-3 br:py-2 br:text-sm br:text-text"
        >
          {status}
        </p>
      ) : null}
      <form noValidate onSubmit={submit} className="br:flex br:flex-col br:gap-4">
        <Field label={t('login.username')} error={form.errors.username} required>
          <TextInput
            ref={usernameRef}
            name="username"
            autoComplete="username"
            value={form.data.username}
            onChange={(e) => form.setData('username', e.target.value)}
          />
        </Field>
        <Field label={t('login.password')} error={form.errors.password} required>
          <PasswordInput
            ref={passwordRef}
            name="password"
            autoComplete="current-password"
            value={form.data.password}
            onChange={(e) => form.setData('password', e.target.value)}
          />
        </Field>
        <Checkbox
          name="remember"
          label={t('login.remember')}
          checked={form.data.remember}
          onCheckedChange={(checked) => form.setData('remember', checked)}
        />
        <Button type="submit" loading={form.processing} className="br:w-full">
          {t('login.submit')}
        </Button>
      </form>
    </Card>
  );
}
