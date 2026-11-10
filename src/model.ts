export type Role = 'admin' | 'client';
export type Row = Record<string, string | number>;
export type Fields = Record<string, string>;
export type State = {
  rows: Record<string, Row[]>;
  settings: Record<string, Fields>;
  lastTaskId: number;
  lastRecordId: number;
};

const initialData: Record<string, Row[]> = {
  'user list': [{ ID: 1, account: 'Demo customer', company: 'Demo company', status: 'normal' }],
  'channel list': [
    { 'channel id': 1, 'channel name/vendor': 'Demo SMPP', 'Health state': 'offline', 'enabled state': 'disabled', 'channel type': 'SMPP' },
    { 'channel id': 2, 'channel name/vendor': 'Demo HTTP', 'Health state': 'offline', 'enabled state': 'disabled', 'channel type': 'HTTP' }
  ],
  'channel pool list': [{ ID: 1, 'channel pool': 'Demo pool A', Classification: 'Normal' }, { ID: 2, 'channel pool': 'Demo pool B', Classification: 'Normal' }],
  'product list': [{ 'Product name': 'International SMS', 'Pool of channels': 'Demo pool A', 'enabled state': 'disabled' }, { 'Product name': 'Philippines', 'Pool of channels': 'Demo pool B', 'enabled state': 'disabled' }],
  account: [{ UID: 1, 'User name/name/mobile phone number': 'admin', Role: '超级管理员', 'login user side': 'yes' }],
  role: [{ 'S/N': 1, 'Role name': '超级管理员', 'Number of people': 1 }]
};

export function initialState(): State {
  return { rows: structuredClone(initialData), settings: {}, lastTaskId: 0, lastRecordId: 0 };
}

export const dateTime = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Manila', dateStyle: 'short', timeStyle: 'medium',
}).format(new Date());
