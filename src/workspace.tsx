import { useEffect, useRef, useState, type FormEvent } from 'react';
import { request } from './api';
import { Card, Dialog, Field, Glyph, display, formValues, hot, rowsFor, type DialogSpec } from './controls';
import { dateTime, type Role, type State } from './model';
import { adminGroups, clientGroups, configForms, pages } from './pages';
import { TablePage } from './table-page';

type Data = Pick<State, 'rows' | 'settings'>;

export function Workspace({ role, data, refresh }: { role: Role; data: Data; refresh: () => Promise<void> }) {
  const [active, setActive] = useState('overview');
  const [tabs, setTabs] = useState(['overview']);
  const [group, setGroup] = useState(role === 'admin' ? 'user' : 'SMS');
  const [collapsed, setCollapsed] = useState(false);
  const [dialog, setDialog] = useState<DialogSpec>();
  const [toast, setToast] = useState('');
  const timer = useRef<number>(undefined);
  const scroll = useRef<HTMLDivElement>(null);
  const tab = useRef<HTMLDivElement>(null);
  const groups = role === 'admin' ? adminGroups : clientGroups;
  const queued = rowsFor(data, 'send task').filter(row => row['task status'] === 'queued (demo)').length;
  useEffect(() => { tab.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [active]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function open(name: string) {
    const parent = groups.find(([, , children]) => children.includes(name));
    if (name !== 'overview' && !parent) return;
    setTabs(previous => previous.includes(name) ? previous : [...previous, name]);
    if (parent) setGroup(parent[0]);
    setActive(name);
  }

  function close(name: string) {
    if (active === name) setActive(tabs[tabs.indexOf(name) - 1] ?? 'overview');
    setTabs(previous => previous.filter(entry => entry !== name));
  }

  function notify(message: string) {
    window.clearTimeout(timer.current);
    setToast(message);
    timer.current = window.setTimeout(() => setToast(''), 3200);
  }

  async function save(path: string, method: string, values?: unknown) {
    await request(role, path, method, values);
    await refresh();
  }

  async function logout() {
    try { await save('/logout', 'POST'); }
    catch (error) { notify((error as Error).message); }
  }

  return <div className={'app' + (collapsed ? ' collapsed' : '')}>
    <aside className="sidebar">
      <div className="brand">{data.settings['site config']?.['Site name'] || '短信'}</div>
      <nav className="nav-list" aria-label="Main navigation">
        {groups.map(([label, icon, children]) => <div key={label}>
          <button type="button" title={label} aria-expanded={children.length ? group === label : undefined}
            className={'nav-group' + (group === label ? ' open' : '') + (children.includes(active) ? ' selected' : '')}
            onClick={() => {
              if (!children.length) return open(label);
              setGroup(group === label && !collapsed ? '' : label);
              setCollapsed(false);
            }}>
            <Glyph code={icon} /><span>{label}</span>{!!children.length && <span className="arrow" />}
          </button>
          {group === label && !!children.length && <div className="submenu">
            {children.map(name => <button type="button" key={name}
              className={'nav-link' + (active === name ? ' selected' : '')} onClick={() => open(name)}>
              {display(name)} {role === 'admin' && hot(name) && <span className="hot">hot</span>}
            </button>)}
          </div>}
        </div>)}
      </nav>
    </aside>
    <header className="topbar">
      <button className="icon-btn" aria-label="Expand or collapse sidebar" onClick={() => setCollapsed(!collapsed)}><Glyph code={'\ue668'} /></button>
      <button className="icon-btn" aria-label="Refresh" onClick={() => void refresh()}><Glyph code={'\ue9aa'} /></button>
      <button className="icon-btn" aria-label="Go back" onClick={() => open(tabs[Math.max(0, tabs.indexOf(active) - 1)])}><Glyph code={'\ue65c'} /></button>
      <div className="health"><span>pending SMS<b>{queued}</b></span>
        {role === 'admin' && ['CPU', 'memory', 'disk'].map(label => <span key={label}>{label}<b>—</b></span>)}
      </div>
      <div className="righttop"><Clock />
        <details className="profile"><summary>{role === 'admin' ? '超级管理员' : 'Demo customer'}<span className="arrow" /></summary>
          <div className="dropdown">
            {role === 'admin' && <button onClick={() => open('my password')}>edit password</button>}
            <button onClick={() => void logout()}>exit</button>
          </div>
        </details>
        <details className="profile"><summary aria-label="Tab actions">⋮</summary><div className="dropdown">
          <button onClick={() => setTabs(active === 'overview' ? ['overview'] : ['overview', active])}>close other tabs</button>
          <button onClick={() => { setTabs(['overview']); setActive('overview'); }}>close all tabs</button>
        </div></details>
      </div>
    </header>
    <div className="tabbar">
      <button className="tab-arrow" aria-label="Scroll tabs left" onClick={() => scroll.current?.scrollBy({ left: -200, behavior: 'smooth' })}><Glyph code={'\ue65a'} /></button>
      <div className="tab-scroll" ref={scroll}>
        {tabs.map(name => <div key={name} ref={name === active ? tab : undefined} className={'tab-item' + (name === active ? ' current' : '')}>
          <button aria-label={display(name) + ' tab'} onClick={() => open(name)}>{name === 'overview' ? <Glyph code={'\ue68e'} /> : display(name) + (role === 'admin' && hot(name) ? 'hot' : '')}</button>
          {name !== 'overview' && <button className="close-tab" aria-label={'Close ' + display(name)} onClick={() => close(name)}>×</button>}
        </div>)}
      </div>
      <button className="tab-arrow" aria-label="Scroll tabs right" onClick={() => scroll.current?.scrollBy({ left: 200, behavior: 'smooth' })}><Glyph code={'\ue65b'} /></button>
    </div>
    <main className="content">
      {tabs.map(name => <div key={name} hidden={name !== active}>
        {name === 'overview' ? <Overview role={role} data={data} open={open} /> :
          name === 'send SMS' ? <SendSms data={data} send={async values => { await save('/tasks', 'POST', values); notify('Task queued locally'); open('send task'); }} /> :
          name === 'server info' ? <Card><div className="blank-info">
            {['cpu Usage', 'Memory usage', 'Disk usage'].map(label => <section key={label}><h3>{label}</h3><output aria-label="No server configured">—</output></section>)}
          </div></Card> :
          Object.hasOwn(configForms, name) ? <Settings name={name} data={data} save={async values => {
            await save('/settings/' + encodeURIComponent(name), 'PUT', values);
            notify('Configuration saved locally');
          }} /> :
          name === 'product tree' || name === 'channel type' ? <Tree name={name} data={data} /> :
          <TablePage name={name} role={role} data={data} showDialog={setDialog}
            mutate={async values => { await save('/rows/' + encodeURIComponent(name), 'POST', values); notify('Saved locally'); }}
            open={open} />}
      </div>)}
    </main>
    {dialog && <Dialog spec={dialog} close={() => setDialog(undefined)} />}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

function Clock() {
  const [clock, setClock] = useState(dateTime);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(dateTime()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="clock">UTC+8 {clock}</span>;
}

function Overview({ role, data, open }: { role: Role; data: Data; open: (name: string) => void }) {
  const sent = rowsFor(data, 'send record');
  const count = (name: string) => rowsFor(data, name).length;
  const status = (name: string) => sent.filter(row => row.status === name).length;
  const metrics = (title: string, items: [string, number | string, string][], three = false) =>
    <Card title={title}><div className={'metrics' + (three ? ' three' : '')}>
      {items.map(([label, value, target]) => <button className="metric" key={label} onClick={() => open(target)}>{label}<b>{value}</b></button>)}
    </div></Card>;
  return <>
    {role === 'admin' ? metrics('Number of customers/channels', [
      ['parent account', count('user list'), 'user list'], ['Channel', count('channel list'), 'channel list'],
      ['indirect account', count('indirect user'), 'indirect user'], ['Pool of channels', count('channel pool list'), 'channel pool list'],
    ]) : <>
      <Card title="Customer portal · local demo"><div className="table-page"><button className="btn" onClick={() => open('send SMS')}>Send SMS</button></div></Card>
      {metrics('Account overview', [['Available balance', '0.00', 'recharge record'], ['Send tasks', count('send task'), 'send task']])}
    </>}
    {metrics('Today summary', [
      ['Channel commit', sent.length, 'send record'], ['Status failure', status('failed'), 'send record'],
      ['Status successful', status('success'), 'send record'], ['commit failure', 0, 'send record'],
      ['Current queue number', count('send task'), 'send task'], ['Status unknown', status('queued (demo)'), 'send record'],
    ], true)}
    {role === 'admin' && metrics('audit', [
      ['blacklist', count('user blacklist'), 'user blacklist'], ['intercept template', 0, 'template'],
      ['audit template', count('template audit'), 'template audit'], ['immunity template', count('user template'), 'user template'],
    ])}
    <Card title="statistics of sent volume(Statistics are collected every 5 minutes)"><div className="plot" aria-label="No production traffic" /></Card>
    {role === 'admin' && <div className="split">
      <Card title="The top 10 channels in terms of sending volume"><div className="plot" /></Card>
      <Card title="The top 10 customers in terms of sending volume"><div className="plot" /></Card>
    </div>}
  </>;
}

function Tree({ name, data }: { name: string; data: Data }) {
  const product = name === 'product tree';
  return <Card title={pages[name].title}><div className="tree"><details open><summary>All</summary>
    <ul>{rowsFor(data, product ? 'product list' : 'channel pool list').map((row, index) =>
      <li key={index}>{row[product ? 'Product name' : 'channel pool']}</li>)}</ul>
  </details></div></Card>;
}

function SendSms({ data, send }: { data: Data; send: (values: ReturnType<typeof formValues>) => Promise<void> }) {
  return <Card title="Send SMS"><AsyncForm className="send-form" submit={send} label="Submit task">
    <p className="notice">Local demo. Messages are queued without sending.</p>
    <Field idPrefix="send" label="product type" hint="please select" options={rowsFor(data, 'product list').map(row => row['Product name'])} required />
    <Field idPrefix="send" label="Sender" hint="senderID" />
    <Field idPrefix="send" label="mobile" hint="Enter one phone number per line" multiline required />
    <Field idPrefix="send" label="SMS content" hint="Enter message content" multiline required />
  </AsyncForm></Card>;
}

function Settings({ name, data, save }: { name: string; data: Data; save: (values: ReturnType<typeof formValues>) => Promise<void> }) {
  const [title, label, fields] = configForms[name];
  if (name === 'my password') return <Card title={title}><div className="config-form">This local demo uses fixed demo credentials.</div></Card>;
  return <Card title={title}><AsyncForm className="config-form" submit={save} label={label}>
    {fields.map(([field, hint, initial, upload, dimensions]) =>
      <Field key={field} idPrefix={name} label={field} hint={hint} value={data.settings[name]?.[field] ?? initial}
        options={field === 'Encryption' ? ['TLS', 'SSL', 'None'] : field === 'SMTP Auth' ? ['Yes', 'No'] : []}
        extra={upload && <><label className="btn upload-control">{upload}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon"
          onChange={event => {
            const file = event.currentTarget.files?.[0];
            const form = event.currentTarget.form;
            if (!file || !form) return;
            if (file.size > 512_000) { alert('Choose a picture smaller than 500 KB.'); return; }
            const reader = new FileReader();
            reader.onload = () => { (form.elements.namedItem(field) as HTMLInputElement).value = String(reader.result); };
            reader.readAsDataURL(file);
          }} /></label><span className="hint">{dimensions}</span></>}
      />)}
  </AsyncForm></Card>;
}

function AsyncForm({ className, submit, label, children }: {
  className: string; submit: (values: ReturnType<typeof formValues>) => Promise<void>; label: string; children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try { await submit(formValues(event.currentTarget)); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <form className={className} onSubmit={onSubmit}>
    {children}
    {error && <p className="notice mt-3 text-red-700" role="alert">{error}</p>}
    <button className="btn save" type="submit" disabled={busy}>{busy ? 'Saving…' : label}</button>
  </form>;
}
