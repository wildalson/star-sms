import { Fragment, useState, type FormEvent } from 'react';
import { Card, Field, Glyph, formValues, rowsFor, type DialogSpec } from './controls';
import { dateTime, type Fields, type Role, type Row, type State } from './model';
import { pages } from './pages';
import { adminFieldKey, adminFormFor, adminForms, type AdminField, type AdminFormKey } from './admin-forms';
import { permissions } from './permissions-tree';
import { filterOptions } from './filter-options';
import { useLocale } from './locale';

type Data = Pick<State, 'rows'>;
type Result = { index: number; record: Row };
type Props = {
  name: string;
  role: Role;
  data: Data;
  showDialog: (spec: DialogSpec) => void;
  mutate: (input: unknown) => Promise<void>;
  open: (name: string) => void;
  hideExports?: boolean;
};

const filterKeys: Record<string, Record<string, string>> = {
  'user list': { mobile: 'Contact number', 'product type': 'launched product' },
  'product list': { 'external name': 'Product name', 'State of operation': 'enabled state', 'channel pool': 'Pool of channels' },
  'send record': { 'send status': 'status', 'submit time': 'date', mobile: 'mobile/extension', account: 'user/company', 'product type': 'product/code' },
  'send task': { 'product type': 'product/code', account: 'user/company' },
  'channel list': { channel: 'channel name/vendor', 'Channel account': 'Account number', 'channel pool': 'Channel pool' },
  account: { 'User name': 'User name/name/mobile phone number' },
};

function choices(data: Data, page: string, label: string, hint: string) {
  const observed = filterOptions[page]?.[label];
  if (observed) return observed;
  if (!/please select|include indirect account|^all/i.test(hint)) return undefined;
  const values = (page: string, key: string) => [...new Set(rowsFor(data, page).map(row => row[key]).filter(Boolean))];
  if (/^(account|indirectaccount|parent account)$/i.test(label)) return values('user list', 'account');
  if (label === 'company') return values('user list', 'company');
  if (/^channel$/i.test(label)) return values('channel list', 'channel name/vendor');
  if (/supplier/i.test(label)) return values('channel provider', 'Supplier abbreviation');
  if (/channel pool/i.test(label)) return values('channel pool list', 'channel pool');
  if (/product/i.test(label)) return values('product list', 'Product name');
  if (/country/i.test(label)) return ['Philippines', 'International'];
  if (/status|state/i.test(label)) return ['queued (demo)', 'normal', 'enabled', 'disabled', 'success', 'failed'];
  if (/certified/i.test(label)) return ['certified', 'uncertified'];
  if (/billing/i.test(label)) return ['submission billing', 'success billing'];
  if (/role/i.test(label)) return values('role', 'Role name');
  return undefined;
}

function matching(name: string, record: Row, filters: Fields) {
  return Object.entries(filters).every(([label, value]) => {
    if (!value.trim()) return true;
    const key = filterKeys[name]?.[label] ?? label;
    let candidate = String(record[key] ?? Object.entries(record).find(([column]) => column.toLowerCase() === key.toLowerCase())?.[1] ?? '');
    if (label === 'task type') candidate = ({ Immediate: 'instant send', Scheduled: 'timed transmission' } as Record<string, string>)[candidate] ?? candidate;
    if (label === 'task status' && candidate === 'queued (demo)') candidate = 'not yet started';
    if (label === 'send status') candidate = ({ 'queued (demo)': 'wait for submission', success: 'report success', failed: 'report failure' } as Record<string, string>)[candidate] ?? candidate;
    if (/^(enabled state|State of operation)$/.test(label)) candidate = ({ enabled: 'enable', disabled: 'deactivate' } as Record<string, string>)[candidate] ?? candidate;
    if (label === 'Health state' && candidate === 'offline') candidate = 'failure';
    if (label === 'submit time') {
      const [from, to] = value.split(' - ');
      return to ? candidate >= from && candidate <= to : candidate.includes(from);
    }
    return candidate.toLowerCase().includes(value.toLowerCase().trim());
  });
}

export function TablePage({ name, role, data, showDialog, mutate, open, hideExports }: Props) {
  const { t } = useLocale();
  const [filters, setFilters] = useState<Fields>({});
  const [size, setSize] = useState(10);
  const [page, setPage] = useState(1);
  const [filterVersion, resetFilter] = useState(0);
  const spec = pages[name];
  const isUsers = name === 'user list' || name === 'indirect user';
  const results = rowsFor(data, name).map((record, index) => ({ record, index })).filter(({ record }) => matching(name, record, filters));
  const pageCount = Math.max(1, Math.ceil(results.length / size));
  const current = Math.min(page, pageCount);
  const visible = results.slice((current - 1) * size, current * size);
  const query = ({ 'SMS audit': 'detail query', 'Backfill Report': '查询', policy: 'query', 'global blacklist': 'query' } as Record<string, string>)[name] ?? 'inquire';
  const actions = spec.actions.filter(action => action !== query && !(hideExports && /export|derived space/i.test(action)));
  const configurableProduct = role === 'admin' && name === 'product list';
  const status = (value: string) => results.filter(({ record }) => record.status === value).length;

  function openAdminForm(key: AdminFormKey, result?: Result) {
    const spec = adminForms[key];
    const record = result?.record;
    showDialog({
      title: spec.title,
      submitLabel: 'submit' in spec ? spec.submit : undefined,
      content: (spec.fields as AdminField[]).map(field => {
        const name = adminFieldKey(field);
        const stored = record?.[name];
        const normalized = name === 'enabled state' && stored
          ? ({ enabled: 'enable', disabled: 'deactivate' } as Record<string, string>)[String(stored)] ?? stored : stored;
        const value = /password/i.test(field.label) ? '' : normalized ??
          (name === 'internal name' ? record?.['Product name'] : undefined) ?? field.initial;
        const options = field.options ?? sourceOptions(data, field.source);
        return <Field key={name} idPrefix="admin-edit" name={name} label={field.label}
          value={value} hint={field.hint} options={options} required={field.required}
          multiline={field.multiline} radio={field.radio} checkbox={field.checkbox} inputType={field.number ? 'number' : undefined}
          range={field.number} />;
      }),
      submit: values => {
        const clean = Object.fromEntries(Object.entries(values).filter(([name]) => !/password/i.test(name)));
        return mutate(result
          ? { operation: 'edit', form: key, index: result.index, expected: result.record, values: clean }
          : { operation: 'create', form: key, values: clean });
      },
    });
  }

  function edit(title: string, result?: Result) {
    if (!spec.editFields.length) return;
    showDialog({
      title,
      content: spec.editFields.filter(label => !/password/i.test(label)).map((label, index) =>
        label === 'Permissions' && name === 'role' ? <PermissionTree key={label} value={String(result?.record[label] ?? '')} /> :
        <Field key={label} idPrefix="edit" label={label} value={result?.record[label]} required={index === 0} multiline={/content|remark/i.test(label)} />),
      submit: values => mutate(result
        ? { operation: 'edit', index: result.index, expected: result.record, values }
        : { operation: 'create', values }),
    });
  }

  function rowAction(operation: string, result: Result) {
    const { record, index } = result;
    const apply = (values?: Fields) => mutate({ operation, index, expected: record, values });
    if (operation === 'edit') {
      const key = name === 'user list' ? 'customerAttributes' :
        adminFormFor(name, 'edit', String(record.Protocol ?? record['channel type'] ?? ''));
      if (role === 'admin' && key) return openAdminForm(key, result);
      return edit('Editing', result);
    }
    if (operation === 'info') {
      if (name === 'user list') return edit('basic overview', result);
      return showDialog({ title: 'info', content: <dl>{Object.entries(record).map(([key, value]) =>
        <Fragment key={key}><dt><b>{t(key)}</b></dt><dd>{value}</dd></Fragment>)}</dl> });
    }
    if (operation === 'product') {
      return showDialog({
        title: '+product', submitLabel: 'confirm opening',
        content: <>
          <Field label="product" idPrefix="add-product" options={rowsFor(data, 'product list').map(row => row['Product name'])} required />
          <Field label="International product billing word count" idPrefix="add-product"
            options={['160words/pieces', '140words/pieces', 'force 1 piece']} radio />
        </>,
        submit: apply,
      });
    }
    if (operation === 'toggle-channel') {
      const enabled = ['enable', 'enabled'].includes(String(record['enabled state']));
      const title = enabled ? 'Deactivate channel' : 'Enable channel';
      return showDialog({ title, content: <p>{t('Channel state is recorded in this demo.')}</p>, submit: () => apply() });
    }
    const title = operation === 'delete' ? 'Delete record' : record.status === 'locked' ? 'Unlock account' : 'Lock account';
    showDialog({ title, content: <p>{t('{action}?', { action: t(title) })}</p>, submit: () => apply() });
  }

  function toolbar(action: string) {
    const form = role === 'admin' && adminFormFor(name, action);
    if (form) return openAdminForm(form);
    if (action === 'reset form') {
      setFilters({});
      setPage(1);
      resetFilter(version => version + 1);
    } else if (/export|derived space/i.test(action)) {
      downloadCsv(name, spec.columns, results);
    } else if (/^(add |adding |additional |new |创建|standard protocol|international http)/i.test(action) && spec.editFields.length) {
      edit(action);
    } else if (/^(delete by condition|delete data|one-click delete|bulk deletion)$/i.test(action) && spec.editFields.length) {
      showDialog({
        title: action,
        content: <p>{results.length ? t('Delete {count} matching demo records?', { count: results.length }) : t('no data')}</p>,
        submit: results.length ? () => mutate({ operation: 'delete-many', results }) : undefined,
      });
    } else {
      showDialog({ title: action, content: <p className="notice">{t('This operation requires a connected service or additional configuration.')}</p> });
    }
  }

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters(formValues(event.currentTarget));
    setPage(1);
  }

  function actionButton(action: string, index: number) {
    const label = (/^(add |new |adding |additional )/i.test(action) ? '+ ' : '') + t(action);
    const color = action === 'add a user' ? ' orange' : index === 1 && isUsers ? ' blue' : '';
    return <button className={'btn small' + color} key={action} onClick={() => toolbar(action)}>{label}</button>;
  }

  return <Card title={spec.title}><div className="table-page">
    {!!spec.fields.length && <form key={filterVersion} onSubmit={filter}>
      <div className="filter-grid">{spec.fields.map(([label, hint = '']) =>
        <Field key={label} idPrefix={name} label={label} hint={hint} options={choices(data, name, label, hint)} />)}
      </div>
      <button className="btn query" type="submit"><Glyph code={'\ue615'} /> {t(query)}</button>
    </form>}
    {isUsers ? <>
      <div className="actions center">{actions.filter(action => action !== 'export user').map(actionButton)}</div>
      <div className="actions stacked">{actionButton('export user', 0)}</div>
    </> : !!actions.length && <div className="actions">{actions.map(actionButton)}</div>}
    {name === 'send record' && <>
      <div className="record-summary">{t('Total sent')}: {results.length} · {t('Reported success')}: {status('success')} · {t('Awaiting report')}: {status('queued (demo)')} · {t('Failed')}: {status('failed')} · {t('Success rate')}: {results.length ? (100 * status('success') / results.length).toFixed(1) : '0'}%</div>
      {role === 'admin' && <div className="record-tools">{t("Actions for matching records:")}
        {['①repush status', '②failure or success turn each other', '③Unknown transfer success or failure', '④push custom uplink'].map((label, index) =>
          <button className={'btn small ' + ['orange', '', 'yellow', 'blue'][index]} key={label} onClick={() => toolbar(label)}>{t(label)}</button>)}
      </div>}
    </>}
    <div className="table-wrap"><table className={isUsers ? 'user-table' : ''}>
      <thead><tr>{spec.columns.map(column => <th scope="col" key={column}>{t(column)}{isUsers && column === 'account' && <span className="text-[var(--teal)]">{t('(You can right-click on the blank space)')}</span>}</th>)}{configurableProduct && <th scope="col">{t('operate')}</th>}</tr></thead>
      <tbody>{visible.length ? visible.map(result => <tr key={result.index}>
        {spec.columns.map(column => <td key={column} className={column === 'status' ? 'status' : undefined}
          onContextMenu={name === 'user list' && column === 'account' ? event => {
            event.preventDefault();
            showDialog({ title: 'User tools', content: <div className="inline-actions">
              {['user template', 'user blacklist', 'user whitelist'].map(target =>
                <button type="button" className="btn small" key={target} onClick={() => {
                  const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
                  dialog?.close();
                  open(target);
                }}>{t(target)}</button>)}
            </div> });
          } : undefined}>
          {['operate', '操作'].includes(column) ? <div className="inline-actions">
            <button className="btn small" onClick={() => rowAction('info', result)}>{t('info')}</button>
            {!!spec.editFields.length && <button className="btn small" onClick={() => rowAction('edit', result)}>{t(name === 'user list' ? 'Set' : 'Editing')}</button>}
            {name === 'user list' ? <>
              <button className="btn small orange" onClick={() => rowAction('product', result)}>{t('+product')}</button>
              <button className="btn small secondary" onClick={() => rowAction('lock', result)}>{t(result.record.status === 'locked' ? 'unlock' : 'lock')}</button>
            </> : (!!spec.editFields.length || name === 'send task') &&
              <button className="btn small blue" onClick={() => rowAction('delete', result)}>{t('delete')}</button>}
            {role === 'admin' && name === 'channel list' &&
              <button className="btn small secondary" onClick={() => rowAction('toggle-channel', result)}>
                {t(['enable', 'enabled'].includes(String(result.record['enabled state'])) ? 'deactivate' : 'enable')}
              </button>}
          </div> : <Cell name={name} column={column} record={result.record} />}
        </td>)}
        {configurableProduct && <td><button className="btn small" onClick={() => openAdminForm('product', result)}>{t('Editing')}</button></td>}
      </tr>) : <tr><td className="empty" colSpan={spec.columns.length + Number(configurableProduct)}>{t('no data')}</td></tr>}</tbody>
    </table></div>
    {!!results.length && <form className="pager" onSubmit={event => {
      event.preventDefault();
      setPage(Math.max(1, Math.min(pageCount, Number(formValues(event.currentTarget).page) || 1)));
    }}>
      {t('{count} records', { count: results.length })}
      <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)}>{t('Previous page')}</button>
      <button type="button" className="current" aria-current="page">{current}</button>
      <button type="button" disabled={current === pageCount} onClick={() => setPage(current + 1)}>{t('Next page')}</button>
      <select aria-label={t('Records per page')} value={size} onChange={event => { setSize(Number(event.target.value)); setPage(1); }}>
        {[10, 20, 30, 40, 50].map(value => <option key={value} value={value}>{t('{count} per page', { count: value })}</option>)}
      </select>
      {t('Go to page')} <input key={current} type="number" name="page" min="1" max={pageCount} defaultValue={current} aria-label={t('Page number')} /> {t('page suffix')}
      <button type="submit">{t('Confirm')}</button>
    </form>}
    {isUsers && <div className="notice">{t('Health state: Normal · No heartbeat for a long time · Disconnected.')}<br />
      {t('Locked accounts cannot log in. Do not send SMS after a SPID or account is deactivated.')}<br />
      {t('Data is retained for the last two months.')}</div>}
  </div></Card>;
}

function PermissionTree({ value }: { value: string }) {
  const { t } = useLocale();
  const [checked, setChecked] = useState(() => new Set(value.split(',').filter(Boolean)));
  function descendants(id: string): string[] {
    return [id, ...permissions.filter(item => item.parent === id).flatMap(item => descendants(item.id))];
  }
  function change(id: string, selected: boolean) {
    setChecked(previous => {
      const next = new Set(previous);
      for (const item of descendants(id)) {
        if (selected) next.add(item);
        else next.delete(item);
      }
      return next;
    });
  }
  function nodes(parent: string) {
    return <ul>{permissions.filter(item => item.parent === parent).map(item =>
      <li key={item.id}>
        <label><input type="checkbox" checked={checked.has(item.id)} onChange={event => change(item.id, event.target.checked)} /> {t(item.label)}</label>
        {permissions.some(child => child.parent === item.id) && nodes(item.id)}
      </li>,
    )}</ul>;
  }
  return <fieldset className="tree">
    <legend>{t('Permissions')}</legend>
    <input type="hidden" name="Permissions" value={[...checked].join(',')} />
    {nodes('')}
  </fieldset>;
}

function sourceOptions(data: Data, source: AdminField['source']) {
  if (!source) return undefined;
  const fields = {
    roles: ['role', 'Role name'], suppliers: ['channel provider', 'Supplier abbreviation'],
    channelTypes: ['channel type', 'name'], pools: ['channel pool list', 'channel pool'],
    channels: ['channel list', 'channel name/vendor'], customers: ['user list', 'account'],
    products: ['product list', 'Product name'],
  };
  const [page, key] = fields[source];
  return [...new Set(rowsFor(data, page).map(row => row[key]).filter(value => value !== undefined && value !== ''))];
}

const translatedColumns = new Set(['status', '状态', 'task status', 'audit status', 'enabled state', 'health state', 'role', 'role name', 'login user side']);

function Cell({ name, column, record }: { name: string; column: string; record: Row }) {
  const { t } = useLocale();
  if (name === 'user list' && column === 'account') return <>
    <b>{record.account}</b><br /><span className="tag probation">{t('probation')}</span><br />
    <span className="tag company">{t('company')}</span><br /><span className="tag channel">{t('channel')}</span><br /><span className="tag">{t('none')}</span>
  </>;
  if (name === 'user list' && column === 'launched product') {
    const products = String(record[column] ?? '').split('|').filter(Boolean);
    return products.length ? products.map(product => <div key={product}><span className="product-badge">{product}</span> <small>{t('Balance {amount} · price {price}', { amount: '0.00', price: '-' })}</small></div>) : '-';
  }
  if (name === 'user list' && column.startsWith('Contact person')) return <>
    {['contact person', 'company', 'Contact number', 'create time', 'remark'].map(key => <div key={key}>{record[key] || '-'}</div>)}
  </>;
  const value = record[column];
  if (value === '' || value === undefined) return '-';
  return typeof value === 'string' && translatedColumns.has(column.toLowerCase()) ? t(value) : value;
}

function downloadCsv(name: string, columns: string[], results: Result[]) {
  const headers = columns.filter(column => !['operate', '操作'].includes(column));
  const quote = (value: string | number = '') => {
    const text = String(value);
    return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
  };
  const lines = [headers, ...results.map(({ record }) => headers.map(key => record[key]))];
  const content = lines.map(line => line.map(quote).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name.replaceAll(' ', '-') + '-' + dateTime().slice(0, 10) + '.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
