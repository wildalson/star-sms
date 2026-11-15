export type AdminField = {
  label: string;
  key?: string;
  hint?: string;
  required?: boolean;
  options?: string[];
  source?: 'roles' | 'suppliers' | 'channelTypes' | 'pools' | 'channels' | 'customers' | 'products';
  initial?: string;
  multiline?: boolean;
  radio?: boolean;
  checkbox?: boolean;
  number?: { min: number; max: number };
};

export const billingModes = ['Successful billing', 'Submission billing'];
const billing: AdminField = { label: 'Billing mode', options: billingModes, initial: billingModes[1], radio: true };
const speed: AdminField = { label: 'Total delivery speed', hint: 'Total delivery rate 10-50000', required: true, number: { min: 10, max: 50000 } };
const extension: AdminField = { label: 'Extension length', hint: 'The maximum extension length is 20', required: true, number: { min: 0, max: 20 } };
const countryPrice: AdminField = { label: 'country:cost price', hint: 'One country and price per line, separated by a colon', multiline: true };
const channelType: AdminField = { label: 'channel type', source: 'channelTypes' };
const supplier: AdminField = { label: 'Channel provider(Optional)', source: 'suppliers' };

export const protocolTemplates = [
  '天一国际短信接口', 'vonage', 'cm', 'sinch', 'vg-whatsapp', 'vg-facebook', 'vg-viber',
  'macrokiosk', 'buka', 'msg5', '51sms', 'opt专用短信', '沃联短信接口(国际)', 'SKySMS 短信接口',
  '节点专用', 'vg-voice', 'WorldSMS', 'worldcode越南', 'fachaiba', 'vg-mode-whatsapp', 'NeoSMS 巴西',
  'vg-rcs', 'laaffic-sms', 'zc-whatsapp', 'twilio', 'smslive247', 'TG-OTP', 'RCS普短', 'mitto-viber',
  'nxcloud-ws-temp', 'nx-sms', 'cloud-sms', 'GC Voice', 'cmmaap', 'Sleengshort', 'Bluebird-WS',
  'ANTS', 'accessyou', 'nxcloud语音验证码', 'telkomsel Broadcast', 'emmamms', '电服兔',
  'nxcloud-rcs', '节点短信', 'telkomsel Broadcast Var', 'gulfTwRCS', '电服兔彩信',
];

const channelName: AdminField = { label: 'channel', key: 'channel name/vendor', hint: 'enter a channel name', required: true };
const certified = ['Exemption from certification', 'Personal/business certification required'];
const yesNo = ['no', 'yes'];
const customerRights = [
  'Hide reports', 'Hide send details', 'Send details to hide verification code',
  'Hide mobile Detect', 'Hide your finances', 'Hide short chains', 'Hide the developer',
  'Hide exports', 'Hide cell phone number', 'Hidden state', 'Hide unit price',
  'Close subordinate customers', 'automatic payment', 'open two-factor authentication',
];

export const adminForms = {
  customer: {
    page: 'user list', title: 'add a user', submit: 'Confirm new addition',
    fields: [
      { label: 'User attribute', options: certified, initial: certified[1], required: true },
      { label: 'account', hint: 'Platform user login name', required: true },
      { label: 'password', hint: 'A combination of 6 to 20 digits and uppercase letters' },
      { label: 'Contact number', hint: 'Cell phone number, if only available for login', required: true },
      { label: 'email address', hint: 'optional' },
      billing,
      { label: 'company', hint: 'optional' },
      { label: 'contact person', hint: 'optional' },
    ],
  },
  customerAttributes: {
    page: 'user list', title: 'Attribute configuration', submit: 'Confirm configuration',
    fields: [
      { label: 'user size', options: ['personage', 'firm'], initial: 'firm' },
      { label: 'user type', options: ['channel', 'customer without a customer'], initial: 'channel' },
      { label: 'Billing mode', options: billingModes, initial: billingModes[1] },
      { label: 'Online recharge', options: ['do not open', 'on'], initial: 'do not open' },
      { label: 'user login ip', hint: 'leave blank or 0.0.0.0 indicates no limit' },
      { label: 'user login area', hint: 'please select' },
      { label: 'Suspended death', hint: 'Leaving 0/ blank indicates no active disconnection', number: { min: 0, max: Number.MAX_SAFE_INTEGER } },
      ...customerRights.map(label => ({ label, checkbox: true })),
    ],
  },
  smpp: {
    page: 'channel list', title: 'Standard protocol channel SMPP', subtype: 'SMPP',
    fields: [
      channelName,
      { label: 'server IP', hint: 'IP address such as :127.0.0.1' },
      { label: 'port', hint: 'port such as 7890', number: { min: 1, max: 65535 } },
      { label: 'SenderId', hint: 'access code such as :10690' },
      { label: 'account', key: 'Account number', hint: 'Channel account(SPID)' },
      { label: 'password', hint: 'fill in the channel password' },
      { label: 'Access protocol', options: ['SMPP'], initial: 'SMPP', required: true },
      extension, channelType, speed,
      { label: 'Number of channel connections', hint: 'an integer from 1-10', required: true, number: { min: 1, max: 10 } },
      billing, countryPrice,
    ],
  },
  http: {
    page: 'channel list', title: 'International HTTP protocol channel', subtype: 'HTTP',
    fields: [
      channelName,
      { label: 'Protocol template', hint: 'Select the protocol template', options: protocolTemplates, required: true },
      { label: 'SenderId', hint: 'If not, it will be concatenated before sender_id' },
      extension,
      { label: 'operation number segment', options: ['country'], initial: 'country', required: true },
      { ...countryPrice, required: true }, channelType, speed, billing,
      { label: 'Whether or not to group packages', options: ['yes', 'no'], initial: 'no', radio: true },
      { label: 'Maximum number of group packets', initial: '0', number: { min: 0, max: Number.MAX_SAFE_INTEGER } },
      { label: 'Group packet waiting time', initial: '1', number: { min: 0, max: Number.MAX_SAFE_INTEGER } },
      { label: 'Monthly credit limit' },
      { label: 'Fixed sign', options: yesNo, radio: true },
      { label: 'Location of signature', options: ['Default', 'In front of', 'post', 'Dual signature', 'Go to the autograph'], radio: true },
      supplier, { label: 'country:sender id', hint: 'One country and sender ID per line, separated by a colon', multiline: true },
    ],
  },
  supplier: {
    page: 'channel provider', title: 'New supplier',
    fields: [
      { label: 'Full name of supplier', required: true },
      { label: 'Supplier abbreviation', required: true },
      { label: 'Contact name', key: 'contact person', required: true },
      { label: 'mobile', key: 'Contact number', required: true },
      { label: 'remark', hint: 'Enter remarks' },
    ],
  },
  pool: {
    page: 'channel pool list', title: 'New channel pool',
    fields: [
      { label: 'Normal Pool type', key: 'Classification', source: 'channelTypes' },
      { label: 'channel pool', hint: 'please enter', required: true },
    ],
  },
  account: {
    page: 'account', title: 'Add new account',
    fields: [
      { label: 'User name', required: true },
      { label: 'password', hint: 'Please use a combination of 6-20 digits plus letter case' },
      { label: 'mobile', required: true },
      { label: 'Real name', key: 'name', required: true },
      { label: 'Role', source: 'roles', required: true },
      { label: 'Multiple profit ratio' },
      { label: 'Mobile phone number visible', options: yesNo, radio: true },
      { label: 'Text message content visible', options: yesNo, radio: true },
      { label: 'Quantity control plug-in', options: yesNo, radio: true },
      { label: 'login user side', options: yesNo, radio: true },
    ],
  },
  product: {
    page: 'product list', title: 'Product configuration',
    fields: [
      { label: 'internal name', required: true },
      { label: 'external name', key: 'Product name', required: true },
      { label: 'Default configuration', multiline: true },
      { label: 'Pool of channels', source: 'pools' },
      { label: 'Blacklist' },
      { label: 'Prohibited area' },
      { label: 'Sending time period' },
      { label: 'Frequency intercept' },
      { label: 'Forced Unsubscribe' },
      { label: 'Default selling price' },
      { label: 'priority' },
      { label: 'Default enabled', options: yesNo, radio: true },
      { label: 'enabled state', options: ['enable', 'deactivate'] },
    ],
  },
  userTemplate: {
    page: 'user template', title: 'add template',
    fields: [
      { label: 'template direction', key: 'direction', options: ['immunity from trial', 'examine', 'intercept'], initial: 'immunity from trial' },
      { label: 'account', key: 'Account number', source: 'customers', required: true },
      { label: 'template content', hint: 'Enter template content', multiline: true, required: true },
      ...['including URL', 'mobile phone included', 'including wechat', 'including QQ', 'complex form',
        'emoji included', 'seaborne aircraft', 'chinese language', 'no URL', 'mobile phone not included',
        'wechat is not included', 'QQ free', 'no complexity', 'emoji-free', 'landline not included',
        'no Chinese', 'unsubscribe is not included'].map(label => ({ label, checkbox: true })),
    ],
  },
  blacklist: {
    page: 'user blacklist', title: 'Add blacklist',
    fields: [
      { label: 'account', source: 'customers', required: true },
      { label: 'launched product(SPID)', key: 'Product name/product code', source: 'products' },
      { label: 'signature', key: 'Signature belonging' },
      { label: 'mobile', hint: 'Multiple separated by line breaks', multiline: true, required: true },
      { label: 'remark', hint: 'optional', multiline: true },
    ],
  },
  whitelist: {
    page: 'user whitelist', title: 'Add whitelist',
    fields: [
      { label: 'account', source: 'customers', required: true },
      { label: 'launched product(SPID)', key: 'Product name/product code', source: 'products' },
      { label: 'signature', key: 'Signature belonging' },
      { label: 'mobile', key: 'Whitelist mobile phone number', hint: 'Multiple lines with carriage return, a maximum of 20,000 imported at a time', multiline: true, required: true },
    ],
  },
  newPolicy: {
    page: 'policy', title: 'New reissue policy',
    fields: [{ label: 'Policy name', hint: 'Please enter a policy name', required: true }],
  },
  channelAlarm: {
    page: 'channel alarm', title: '创建告警',
    fields: [
      { label: '选择通道', key: '通道名称', source: 'channels', required: true },
      { label: '未知率', options: ['5', '10', '15', '20', '25', '30'], initial: '10' },
      { label: 'Unknown rate threshold', number: { min: 0, max: 100 } },
      { label: '失败率', options: ['5', '10', '15', '20', '25', '30'], initial: '10' },
      { label: 'Failure rate threshold', number: { min: 0, max: 100 } },
      { label: '告警起始量', initial: '20', number: { min: 0, max: Number.MAX_SAFE_INTEGER } },
      { label: '告警手机' },
      { label: '通知方式', options: ['仅短信通知', '仅企业微信机器人通知', '同时通知'], initial: '仅短信通知' },
      { label: '告警级别' },
      { label: '间隔时间', initial: '1', number: { min: 0, max: Number.MAX_SAFE_INTEGER } },
      { label: 'Interval minutes', initial: '0', number: { min: 0, max: 59 } },
    ],
  },
  announcement: {
    page: 'announcement', title: 'Additional Announcements',
    fields: [
      { label: 'product type', key: 'radius', source: 'products' },
      { label: 'Contents of the announcement', key: 'Content of Announcement', hint: 'Enter the announcement content', multiline: true, required: true },
    ],
  },
} satisfies Record<string, { page: string; title: string; submit?: string; subtype?: string; fields: AdminField[] }>;

export type AdminFormKey = keyof typeof adminForms;
export const adminFieldKey = (field: AdminField) => field.key ?? field.label;

export function adminFormFor(page: string, action: string, subtype?: string): AdminFormKey | undefined {
  if (page === 'channel list' && action === 'edit') return subtype === 'HTTP' ? 'http' : 'smpp';
  const match = (Object.entries(adminForms) as [AdminFormKey, { page: string; title: string }][])
    .find(([key, form]) => form.page === page && (form.title === action ||
      (action === 'edit' && key !== 'customerAttributes' && key !== 'customer' && key !== 'newPolicy')));
  return match?.[0];
}
