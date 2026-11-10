import { Fragment, useState, type FormEvent } from 'react';
import { Card, Field, Glyph, formValues, rowsFor, type DialogSpec } from './controls';
import { dateTime, type Fields, type Role, type Row, type State } from './model';
import { pages } from './pages';

type Data = Pick<State, 'rows'>;
type Result = { index: number; record: Row };
type Props = {
  name: string;
  role: Role;
  data: Data;
  showDialog: (spec: DialogSpec) => void;
  mutate: (input: unknown) => Promise<void>;
  open: (name: string) => void;
};

const filterKeys: Record<string, Record<string, string>> = {
  'user list': { mobile: 'Contact number', 'product type': 'launched product' },
  'send record': { 'send status': 'status', 'submit time': 'date', mobile: 'mobile/extension', account: 'user/company', 'product type': 'product/code' },
  'send task': { 'product type': 'product/code', account: 'user/company' },
  'channel list': { channel: 'channel name/vendor', 'Channel account': 'Account number', 'channel pool': 'Channel pool' },
  account: { 'User name': 'User name/name/mobile phone number' },
};

function choices(data: Data, label: string, hint: string) {
  if (!/please select|include indirect account|^all/i.test(hint)) return [];
  const values = (page: string, key: string) => [...new Set(rowsFor(data, page).map(row => row[key]).filter(Boolean))];
  if (/^(account|indirectaccount|parent account)$/i.test(label)) return values('user list', 'account');
  if (label === 'company') return values('user list', 'company');
  if (/^channel$/i.test(label)) return values('channel list', 'channel name/vendor');
  if (/channel pool/i.test(label)) return values('channel pool list', 'channel pool');
  if (/product/i.test(label)) return values('product list', 'Product name');
  if (/country/i.test(label)) return ['Philippines', 'International'];
  if (/status|state/i.test(label)) return ['queued (demo)', 'normal', 'enabled', 'disabled', 'success', 'failed'];
  if (/certified/i.test(label)) return ['certified', 'uncertified'];
  if (/billing/i.test(label)) return ['submission billing', 'success billing'];
  if (/role/i.test(label)) return values('role', 'Role name');
  return [];
}

function matching(name: string, record: Row, filters: Fields) {
  return Object.entries(filters).every(([label, value]) => {
    if (!value.trim()) return true;
    const key = filterKeys[name]?.[label] ?? label;
    const candidate = String(record[key] ?? Object.entries(record).find(([column]) => column.toLowerCase() === key.toLowerCase())?.[1] ?? '');
    if (label === 'submit time') {
      const [from, to] = value.split(' - ');
      return to ? candidate >= from && candidate <= to : candidate.includes(from);
    }
    return candidate.toLowerCase().includes(value.toLowerCase().trim());
  });
}

export function TablePage({ name, role, data, showDialog, mutate, open }: Props) {
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
  const actions = spec.actions.filter(action => action !== query);
  const status = (value: string) => results.filter(({ record }) => record.status === value).length;

  function edit(title: string, result?: Result) {
    if (!spec.editFields.length) return;
    showDialog({
      title,
      content: spec.editFields.filter(label => !/password/i.test(label)).map((label, index) =>
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
      return edit(name === 'user list' ? 'Attribute configuration' : 'Editing', result);
    }
    if (operation === 'info') {
      if (name === 'user list') return edit('basic overview', result);
      return showDialog({ title: 'info', content: <dl>{Object.entries(record).map(([key, value]) =>
        <Fragment key={key}><dt><b>{key}</b></dt><dd>{value}</dd></Fragment>)}</dl> });
    }
    if (operation === 'product') {
      return showDialog({ title: '+product', content:
        <Field label="product" idPrefix="add-product" options={rowsFor(data, 'product list').map(row => row['Product name'])} required />,
      submit: apply });
    }
    const title = operation === 'delete' ? 'Delete record' : record.status === 'locked' ? 'Unlock account' : 'Lock account';
    showDialog({ title, content: <p>{title}?</p>, submit: () => apply() });
  }

  function toolbar(action: string) {
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
        content: <p>{results.length ? 'Delete ' + results.length + ' matching demo records?' : 'no data'}</p>,
        submit: results.length ? () => mutate({ operation: 'delete-many', results }) : undefined,
      });
    } else {
      showDialog({ title: action, content: <p className="notice">This operation requires a connected service or additional configuration.</p> });
    }
  }

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters(formValues(event.currentTarget));
    setPage(1);
  }

  function actionButton(action: string, index: number) {
    const label = /^(add |new |adding |additional )/i.test(action) ? '+ ' + action : action;
    const color = action === 'add a user' ? ' orange' : index === 1 && isUsers ? ' blue' : '';
    return <button className={'btn small' + color} key={action} onClick={() => toolbar(action)}>{label}</button>;
  }

  return <Card title={spec.title}><div className="table-page">
    {!!spec.fields.length && <form key={filterVersion} onSubmit={filter}>
      <div className="filter-grid">{spec.fields.map(([label, hint = '']) =>
        <Field key={label} idPrefix={name} label={label} hint={hint} options={choices(data, label, hint)} />)}
      </div>
      <button className="btn query" type="submit"><Glyph code={'\ue615'} /> {query}</button>
    </form>}
    {isUsers ? <>
      <div className="actions center">{actions.filter(action => action !== 'export user').map(actionButton)}</div>
      <div className="actions stacked">{actionButton('export user', 0)}</div>
    </> : !!actions.length && <div className="actions">{actions.map(actionButton)}</div>}
    {name === 'send record' && <>
      <div className="record-summary">Total sent: {results.length} Reported success: {status('success')} Awaiting report: {status('queued (demo)')} Failed: {status('failed')} Success rate: {results.length ? (100 * status('success') / results.length).toFixed(1) : '0'}%</div>
      {role === 'admin' && <div className="record-tools">according to the search conditions to the user：
        {['①repush status', '②failure or success turn each other', '③Unknown transfer success or failure', '④push custom uplink'].map((label, index) =>
          <button className={'btn small ' + ['orange', '', 'yellow', 'blue'][index]} key={label} onClick={() => toolbar(label)}>{label}</button>)}
      </div>}
    </>}
    <div className="table-wrap"><table className={isUsers ? 'user-table' : ''}>
      <thead><tr>{spec.columns.map(column => <th scope="col" key={column}>{column}{isUsers && column === 'account' && <span className="text-[var(--teal)]">(You can right-click on the blank space)</span>}</th>)}</tr></thead>
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
                }}>{target}</button>)}
            </div> });
          } : undefined}>
          {['operate', '操作'].includes(column) ? <div className="inline-actions">
            <button className="btn small" onClick={() => rowAction('info', result)}>info</button>
            {!!spec.editFields.length && <button className="btn small" onClick={() => rowAction('edit', result)}>{name === 'user list' ? 'Set' : 'Editing'}</button>}
            {name === 'user list' ? <>
              <button className="btn small orange" onClick={() => rowAction('product', result)}>+product</button>
              <button className="btn small secondary" onClick={() => rowAction('lock', result)}>{result.record.status === 'locked' ? 'unlock' : 'lock'}</button>
            </> : (!!spec.editFields.length || name === 'send task') &&
              <button className="btn small blue" onClick={() => rowAction('delete', result)}>delete</button>}
          </div> : <Cell name={name} column={column} record={result.record} />}
        </td>)}
      </tr>) : <tr><td className="empty" colSpan={spec.columns.length}>no data</td></tr>}</tbody>
    </table></div>
    {!!results.length && <form className="pager" onSubmit={event => {
      event.preventDefault();
      setPage(Math.max(1, Math.min(pageCount, Number(formValues(event.currentTarget).page) || 1)));
    }}>
      共 {results.length} 条
      <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)}>上一页</button>
      <button type="button" className="current" aria-current="page">{current}</button>
      <button type="button" disabled={current === pageCount} onClick={() => setPage(current + 1)}>下一页</button>
      <select aria-label="Records per page" value={size} onChange={event => { setSize(Number(event.target.value)); setPage(1); }}>
        {[10, 20, 30, 40, 50].map(value => <option key={value} value={value}>{value} 条/页</option>)}
      </select>
      到第 <input key={current} type="number" name="page" min="1" max={pageCount} defaultValue={current} aria-label="Page number" /> 页
      <button type="submit">确定</button>
    </form>}
    {isUsers && <div className="notice">1、Health state： ● normal · ● No heartbeat was received for a long time · ● ununited。<br />
      2、After the account is locked, you cannot log in. Do not send SMS messages after the SPID or account is deregistered<br />
      3、The data to be returned is reserved only for the last two months</div>}
  </div></Card>;
}

function Cell({ name, column, record }: { name: string; column: string; record: Row }) {
  if (name === 'user list' && column === 'account') return <>
    <b>{record.account}</b><br /><span className="tag probation">probation</span><br />
    <span className="tag company">company</span><br /><span className="tag channel">channel</span><br /><span className="tag">none</span>
  </>;
  if (name === 'user list' && column === 'launched product') {
    const products = String(record[column] ?? '').split('|').filter(Boolean);
    return products.length ? products.map(product => <div key={product}><span className="product-badge">{product}</span> <small>balance 0.00 · price -</small></div>) : '-';
  }
  if (name === 'user list' && column.startsWith('Contact person')) return <>
    {['contact person', 'company', 'Contact number', 'create time', 'remark'].map(key => <div key={key}>{record[key] || '-'}</div>)}
  </>;
  return record[column] === '' || record[column] === undefined ? '-' : record[column];
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
