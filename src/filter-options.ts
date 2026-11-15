import { billingModes } from './admin-forms.ts';

const certified = ['authenticated', 'waiting for certification', 'authentication rejected', 'no certification submitted'];
const enableState = ['enable', 'deactivate'];
const normalHealth = ['normal', 'failure'];
const userFilters = { certified, 'billing mode': billingModes, sale: [], 'abnormal push': ['yes'] };

export const filterOptions: Record<string, Record<string, string[]>> = {
  'SMS audit': {
    'timed SMS': ['yes timed message', 'untimed SMS'],
    'audit reason': ['Hit audit template', 'No match to the template for review', 'Not in the sending time, into the review',
      'http blacklist api error, into review', 'MMS audit', 'Hit words', 'Too many mobile phone numbers to send tasks',
      'Template configuration is directly reviewed', 'Replacement after the number of inconsistent into the audit',
      'Daily limit review', 'No unsubscribe review is added', 'Unregistered ICP', 'Content security score reached the review threshold',
      'Content security API error, sent for review'],
  },
  'send record': {
    'send status': ['wait for submission', 'commit unknown', 'submit success(receive unknown)', 'commit failure',
      'report failure', 'report success', 'audit rejection', 'system interception'],
    tactics: ['reissue', 'control before sending', 'control after sending', 'blacklist control'],
  },
  'send task': {
    'task type': ['instant send', 'timed transmission'],
    'task status': ['not yet started', 'under way', 'to be reviewed`', 'completed (all successful)',
      'completed (partially successful)', 'completed (all failed)', 'cancelled'],
  },
  'user list': userFilters,
  'indirect user': userFilters,
  'user template': { 'Audit status': ['Pending review', 'already passed', 'be rejected'] },
  'channel pool list': { 'Health state': normalHealth },
  'channel list': { 'Health state': normalHealth, 'enabled state': enableState },
  'channel steering': { scope: ['Channel', 'Product (spid)'] },
  'channel alarm': { 告警类型: ['只设置未知率', '只设置失败率', '未知率+失败率'] },
  policy: { 'enabled state': enableState },
  'reissue channel': { 'Health state': normalHealth },
  'product list': { 'State of operation': enableState },
  template: { 'template direction': ['immunity from trial', 'examine', 'intercept'] },
  'template audit': { 'Audit status': ['pending review', 'approved by review', 'review and reject'] },
  'MMS report': { 'Audit status': ['pending review', 'has been approved', 'be rejected'] },
  'user statis now': { 时间段: ['近10分钟', '近30分钟', '近1小时', '近3小时', '近1天', '当天'] },
  'user profit': { Sorting: ['high => low', 'low => high'] },
  'channel profit': { Sorting: ['high => low', 'low => high'] },
  'recharge record': { 'Billing status': ['awaiting invoicing', 'On the bill', 'Invoiced out', 'Cancel invoicing'] },
};
