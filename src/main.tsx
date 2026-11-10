import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ApiError, request } from './api';
import { Workspace } from './workspace';
import type { Role, State } from './model';
import { formValues } from './controls';
import { demoAccounts } from './demo-accounts';
import { LanguageSwitch, LocaleProvider, useLocale } from './locale';
import './style.css';

function Login({ role, onLogin }: { role: Role; onLogin: () => void }) {
  const { t } = useLocale();
  const [challenge, setChallenge] = useState<{ id: string; image: string; localDemo: boolean }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setChallenge(undefined);
    try { setChallenge(await request(role, '/challenge')); }
    catch (error) { setError((error as Error).message); }
  }
  useEffect(() => { void refresh(); }, [role]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || busy) return;
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    try {
      await request(role, '/login', 'POST', { ...formValues(form), challengeId: challenge.id });
      onLogin();
    } catch (error) {
      setError((error as Error).message);
      (form.elements.namedItem('captcha') as HTMLInputElement).value = '';
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return <main className="login">
    <div className="login-language"><LanguageSwitch /></div>
    <form className="login-form" onSubmit={submit}>
      {error && <p className="login-error" role="alert">{t(error)}</p>}
      <div className="login-line box"><i className="ic" aria-hidden="true">{'\ue66f'}</i><input name="username" placeholder={t('Enter a username')} aria-label={t('Username')} autoComplete="username" required /></div>
      <div className="login-line box"><i className="ic" aria-hidden="true">{'\ue673'}</i><input name="password" type="password" placeholder={t('Enter password')} aria-label={t('Password')} autoComplete="current-password" required /></div>
      <div className="login-line captcha-line">
        <div className="box"><i className="ic" aria-hidden="true">{'\ue679'}</i><input name="captcha" placeholder={t('Enter the CAPTCHA')} aria-label={t('CAPTCHA')} autoComplete="off" maxLength={4} required /></div>
        <button type="button" onClick={() => void refresh()} disabled={busy} aria-label={t('Refresh CAPTCHA')}>
          {challenge ? <img className="h-full w-full" src={challenge.image} alt={t('Verification code')} /> : t('Refresh')}
        </button>
      </div>
      <button className="login-submit" type="submit" disabled={!challenge || busy}>{t(busy ? 'Logging in…' : 'Log in')}</button>
      {challenge && <div className="login-note">{challenge.localDemo
        ? t('Local demo') + ' · ' + demoAccounts[role].username + ' / ' + demoAccounts[role].password
        : t('Hosted demo') + ' · ' + demoAccounts[role].username}</div>}
    </form>
  </main>;
}

type WorkspaceState = Pick<State, 'rows' | 'settings'>;

function App({ role }: { role: Role }) {
  const { t } = useLocale();
  const state = useQuery({
    queryKey: ['state', role],
    queryFn: () => request<WorkspaceState>(role, '/state'),
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (state.isPending) return <main className="p-5" role="status">{t('Loading…')}</main>;
  if (state.error instanceof ApiError && state.error.status === 401) {
    return <Login role={role} onLogin={() => void state.refetch()} />;
  }
  if (!state.data) return <main className="p-5" role="alert"><LanguageSwitch /> {t(state.error?.message || 'Unable to load the workspace.')} <button className="btn" onClick={() => void state.refetch()}>{t('Retry')}</button></main>;

  return <Workspace role={role} data={state.data} refresh={async () => { await state.refetch(); }} />;
}

const element = document.getElementById('app');
if (element?.dataset.role !== 'admin' && element?.dataset.role !== 'client') throw new Error('Missing application role.');
createRoot(element).render(
  <QueryClientProvider client={new QueryClient()}><LocaleProvider><App role={element.dataset.role} /></LocaleProvider></QueryClientProvider>,
);
