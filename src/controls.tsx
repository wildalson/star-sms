import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Fields, Row, State } from './model';
import { useLocale } from './locale';

export const formValues = (form: HTMLFormElement) => Object.fromEntries(new FormData(form)) as Fields;

export function Glyph({ code }: { code: string }) {
  return <i className="ic" aria-hidden="true">{code}</i>;
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  const { t } = useLocale();
  return <section className="card">{title && <h3 className="card-title">{t(title)}</h3>}{children}</section>;
}

export function Field({ label, hint, value, options = [], required, multiline, extra, idPrefix = 'field' }: {
  label: string; hint?: string; value?: string | number; options?: (string | number)[];
  required?: boolean; multiline?: boolean; extra?: ReactNode; idPrefix?: string;
}) {
  const { t } = useLocale();
  const id = idPrefix + '-' + label;
  const common = { id, name: label, defaultValue: value ?? '', required };
  return <div className="field">
    <label htmlFor={id}>{t(label)}</label>
    {options.length ? <select {...common}>
      <option value="">{t(hint || 'please select')}</option>
      {options.map(option => <option key={option} value={option}>{typeof option === 'string' ? t(option) : option}</option>)}
    </select> : multiline ? <textarea {...common} placeholder={hint && t(hint)} /> :
      <input {...common} className={label === 'submit time' ? 'wide' : ''} type={/password/i.test(label) ? 'password' : 'text'} placeholder={hint && t(hint)} autoComplete="off" />}
    {extra}
  </div>;
}

export type DialogSpec = {
  title: string;
  content: ReactNode;
  submit?: (values: Fields) => Promise<void>;
};

export function Dialog({ spec, close }: { spec: DialogSpec; close: () => void }) {
  const { t } = useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !spec.submit) return;
    setBusy(true);
    setError('');
    try { await spec.submit(formValues(event.currentTarget)); close(); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  return <dialog ref={dialog} onClose={close} onCancel={event => { if (busy) event.preventDefault(); }}>
    <div className="dialog-title">{t(spec.title)}<button type="button" onClick={close} disabled={busy} aria-label={t('Close dialog')}>×</button></div>
    <form className="dialog-body" onSubmit={submit}>
      {spec.content}
      {error && <p className="mt-3 text-red-700" role="alert">{t(error)}</p>}
      <div className="dialog-footer">
        <button type="button" className="btn secondary" disabled={busy} onClick={close}>{t('Cancel')}</button>
        {spec.submit && <button className="btn" type="submit" disabled={busy}>{t(busy ? 'Saving…' : 'Confirm')}</button>}
      </div>
    </form>
  </dialog>;
}

export const rowsFor = (data: Pick<State, 'rows'>, name: string): Row[] => data.rows[name] ?? [];
export const display = (name: string) => name === 'user statis now' ? 'user statis' : name;
export const hot = (name: string) => ['send record', 'user list', 'channel list', 'user statis now'].includes(name);
