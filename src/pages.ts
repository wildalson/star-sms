export type Group = [string, string, string[]];
export type ConfigField = [string, string?, string?, string?, string?];
export type PageSpec = {
  title: string;
  fields: string[][];
  columns: string[];
  actions: string[];
  editFields: string[];
};

export const adminGroups: Group[] = [
  ['overview','\ue68e',[]],
  ['SMS','\ue678',['SMS audit','send record','audit record','reply record','send task']],
  ['user','\ue613',['user list','user template','user blacklist','user whitelist','indirect user']],
  ['channel','\ue691',['channel type','channel pool list','channel list','channel steering','channel provider','channel alarm']],
  ['reissue','\ue674',['policy','reissue channel']],
  ['product','\ue653',['product tree','product list','template']],
  ['audit-certify','\ue6c9',['template audit','MMS report']],
  ['statistics','\ue62d',['user statis now','user statis','channel statis','user profit','channel profit','user distribution','Backfill Report']],
  ['basic data','\ue628',['keyword config','global blacklist','invalid mobile','user report map']],
  ['s-url and detect','\ue64c',['short-url domain','short-url charge','detect recharge']],
  ['finance','\ue65e',['recharge record']],
  ['backend users','\ue770',['account','role','my password','operation log']],
  ['system config','\ue628',['system SMS','system SMTP','site config','server info','announcement']]
];
export const clientGroups: Group[] = [
  ['overview','\ue68e',[]],
  ['SMS','\ue678',['send SMS','send record','reply record','send task']],
  ['user','\ue613',['user template','user blacklist','user whitelist']],
  ['statistics','\ue62d',['user statis']],
  ['finance','\ue65e',['recharge record']]
];

export const pages: Record<string, PageSpec> = {};
function define(name: string, title: string, fields: string, columns: string, actions = '', editFields = '') {
  pages[name] = {
    title,
    fields: fields ? fields.split('|').map(field => field.split('~')) : [],
    columns: columns ? columns.split('|') : [],
    actions: actions ? actions.split('|') : [],
    editFields: editFields ? editFields.split('|') : []
  };
}
define('SMS audit','','product type~please select|mobile|account~include indirect account|SMS content~Specific lossability|SPID~six SPID digits|task ID~ID of the task to be sent|timed SMS~please select|audit reason~please select','content|operate','detail query|group packet query|export mobile|reset form|audit setup');
define('send record','','country/area~Please select (search)|channel msgID~channel msgID|our msgID~Our MsgId|senderID~senderID|SPID~six SPID digits|channel~Please select|account~include indirect account|company~please select|mobile~Support for fuzzy queries,15611****47|task ID~ID of the task to be sent|report code~MK:0001,UNDELIV|send status~all|SMS content~Specific lossability|tactics~all|submit time','S/N|user/company|mobile/extension|date|status|SMS content|product/code|channel','reset form|export data');
define('audit record','','product type~please select|account~include indirect account|mobile|auditor~auditor’s account|提交时间','S/N|user/company|mobile|product/code|auditor|status|send content|date');
define('reply record','','account~include indirect account|company~please select|SPID~Example :7777777|mobile|channel~Please select|reply content|task ID|replay time','replay time|reply content|mobile|send content|Sender|Channel used|user/company|product/code','repush the reply according to the query condition|export reply logs');
define('send task','','account~include indirect account|company~please select|product type~please select|SPID~Example :7777777|task ID~例:888|task type~please select|task status~please select','task ID|user/company|create time/timed transmission time|task status|SPID|send content|Total number/Submission success/submission failure|operate');
define('user list','','account~please select|company~please select|SPID~six SPID digits|mobile~New mobile phone number|product type~please select|channel~Please select|channel pool~Please select (search)|certified~all|billing mode~all|customer IP~please enter ip|sale~all sale|Sender~请输入扩展号|abnormal push~all','ID|account|Contact person/company/phone number/activation time/remarks|launched product|sale|status|operate','add a user|Batch change channel|Batch change channel pool|export user','account|password|company|contact person|Contact number|wechat|email address|user type|channel type|address of correspondence|Expire time|remark');
define('user template','user template','product type~please select|template content~includes signature|account~Please enter a login name|Audit status~please select','template content|direction|Audit status|Product name/product code|Account number|operate','delete by condition|Export by condition|add template|Importing templates','template content|direction|Product name/product code|Account number');
define('user blacklist','user blacklist','mobile~please enter|account~please enter|launched product~6 spid digits|创建时间','mobile|Product name/product code|Signature belonging|account|Source|remark|create time|operate','delete Data|export data|Add blacklist','mobile|Product name/product code|Signature belonging|account|remark');
define('user whitelist','user whitelist','mobile~please enter|Signature belonging~Signature belonging|SPID~Please enter the product code (SPID)','Whitelist mobile phone number|account|Product name/product code|Signature belonging|create time|operate','Add whitelist','Whitelist mobile phone number|account|Product name/product code|Signature belonging');
define('indirect user','','indirectaccount~please select|company~please select|SPID~six SPID digits|mobile~New mobile phone number|product type~please select|channel~Please select|channel pool~Please select (search)|certified~please select|billing mode~please select|customer IP~please enter ip|parent account~Please select (search)|Sender~请输入扩展号|abnormal push~please select','ID|account|Contact person/company/phone number/activation time/remarks|launched product|parent account|status|operate','Batch change channel|Batch change channel pool|export user');
define('channel type','Channel (pool) type tree--It can be understood as a folder, which is used to facilitate the management of special channels, channels can ignore the tree','','','Displays the number of channels (pools)');
define('channel pool list','','channel pool~Please select (search)|channel~Please select|Normal Pool type~please select|product type~please select|Health state~please select|country~Please select (search)','ID|channel pool|Classification|Include channel|Average cost|Application product|operate|Health state|remark','New channel pool','channel pool|Classification|Include channel|Average cost|Application product|remark');
define('channel list','','channel~Please select|channel pool~Please select (search)|supplier~Please select (search)|Channel account~Upstream channel account number|channel type~please select|country~Please select (search)|Health state~please select|enabled state~please select|ip~请输入ip','channel id|channel name/vendor|Real-time information|Cost|Account number|Health state|operate|enabled state|Channel pool|channel type|remark','Standard protocol channel SMPP|International HTTP protocol channel','channel name/vendor|Account number|Cost|Channel pool|channel type|enabled state|remark');
define('channel steering','Steering of flow','scope|Original channel|目标通道|spid~please enter|Go to name','scope|Original channel|目标通道|spid|Go to name|operate','New steering','scope|Original channel|目标通道|spid|Go to name');
define('channel provider','Supplier management','supplier~Please select (search)|contact person~contact Name|Contact number','ID|Supplier abbreviation|Full name of supplier|contact person|Contact number|Number of access channels|remark|Last modification time|operate','New supplier','Supplier abbreviation|Full name of supplier|contact person|Contact number|remark');
define('channel alarm','通道告警','通道名称~请选择(搜索)通道|告警类型~please select','ID|类型|通道名称|告警级别|告警条件|状态|操作','设置告警信息|创建告警','类型|通道名称|告警级别|告警条件|状态');
define('policy','Reissue policy list','Policy name|enabled state~please select','Policy name|Times of replacement|Replacement time|Support loss|Prohibit the inclusion of content|Selection method|user type|Ordinary replacement pool|enabled state|操作','New reissue policy','Policy name|Times of replacement|Replacement time|Selection method|user type|Ordinary replacement pool|enabled state');
define('reissue channel','List of replacement pools','channel pool~Please select (search)|Health state~please select|普通池类型|省网池类型','ID|channel pool|Classification|Include channel|Average cost|Application strategy|Health state|operate|remark','New channel pool','channel pool|Classification|Include channel|Average cost|Application strategy|remark');
define('product tree','Product tree','','','Shows the number of opened');
define('product list','product list','internal name|external name~internal name|channel~Please select|channel pool~Please select (search)|State of operation~please select','Product name|Default configuration|Pool of channels|Blacklist|Prohibited area|Sending time period|Frequency intercept|Forced Unsubscribe|Default selling price|priority|Default enabled|enabled state');
define('template','product template','template direction~please select|product type~please select|template content~includes signature|Adding people','product|template content|template direction|Adding people|operate','delete by condition|add template|Importing templates|Exporting templates','product|template content|template direction|Adding people');
define('template audit','Templates are submitted for review','Customer mobile phone|SPID|product type|Audit status~please select','template content|product|Customer mobile phone|signature|Review time at submission|Auditor|Audit status|operate','Batch pass|Batch rejection|Bulk deletion');
define('MMS report','MMS report','account|SPID|Time period~please select','account|SPID|date|status|operate');
const userStats = 'account~include indirect account|company~Please select (search)|product type~please select|SPID|Time period~please select';
define('user statis now','User statistics',userStats,'account|product/code|Total quantity|success|fail|unknown|operate','export data');
define('user statis','User statistics report',userStats,'account|product/code|Total quantity|success|fail|unknown|operate','Export by day|export data');
define('channel statis','Channel statistics report','channel type|channel~Please select|supplier~Please select (search)|Channel account~Account name for the channel|Time period~please select','channel|supplier|Total quantity|success|fail|unknown|operate','Export by day|export data');
define('user profit','User profit statistics report','Name of sale~please select|account~include indirect account|SPID~6位SPID数字|company~Please select (search)|Sorting~please select|Time period~please select','Customer account|company|Name of sale|Type of customer|Billing mode|profit|operate','export data|Daily details|Country Details');
define('channel profit','Channel profit statistics report','Product name|channel~Please select|supplier~Please select (search)|Sorting~please select|Time period~please select','channel|supplier|Billing mode|unit price|profit|operate','export data|Daily details|Country Details');
define('user distribution','','account~include indirect account|Name of sale~please select|product type~please select|Date~Please select a date','account|Company of affiliation|Total amount of distribution|Total amount of profit|Amount refunded|Refund deduction of profit|Actual profit');
define('Backfill Report','回填统计报表','account~include indirect account|SPID~请输入SPID|日期范围~请选择日期范围','用户|SPID（产品）|发送总数|回填数量|回填率|操作');
define('keyword config','Keyword configuration','keyword','keyword|remark|operate','Add keyword','keyword|remark');
define('global blacklist','System blacklist management','Classification~please select','Class name|Number of manually imported numbers (in)|API|Last modification time|operate','New categories|Importing a blacklist','Class name');
define('invalid mobile','Space management (total：0)','Mobile phone number','number|Adding time|operate','One-click delete|Derived space number|New empty number|Importing empty numbers','number');
define('user report map','Downstream status report mapping (converting the status to another value and pushing it downstream)','Status report|Mapping|account~Please select (search)','ID|Status report|Mapping|Account number|operate','New mapping','Status report|Mapping|Account number');
define('short-url domain','Short-url domain','domain','ID|domain|status|operate','Add domain','domain|status');
define('short-url charge','Short-url charge','account|date','account|amount|date|remark');
define('detect recharge','Detect recharge','account|date','account|amount|date|remark');
define('recharge record','Record of prepaid recharge','product type|Name of sale~please select|Billing status~please select|account~User login account, fuzzy query|SPID~6 spid digits|_Recharge time~date','account|Product name/product code|recharge amount|The unit price at the time of recharge|recharge method|operator|remark|create time','Agent/sales recharge record|User recharge record');
define('account','Background Account management','Role~please select|User name~Enter a username|mobile~Enter your phone number','UID|User name/name/mobile phone number|Role|Two-dimensional code|Mobile phone number visible|Text message content visible|Quantity control plug-in|login user side|Multiple profit ratio|Products for sale|operate','Add new account','User name|name|mobile|Role');
define('role','Role management','','S/N|Role name|Number of people|operate','Adding a role','Role name');
define('operation log','Operation log','User name~Enter a username|Operation name~Enter the operation name|date~Select a creation time','User name|user type|Operation name|ip|date');
define('announcement','Announcement management','','S/N|Content of Announcement|radius|date|operate','Additional Announcements','Content of Announcement|radius');

export const configForms: Record<string, [string, string, ConfigField[]]> = {
  'site config': ['Site configuration','Saving configuration',[
    ['IP Address'],['Interface binding domain (for documentation)','Please enter a domain name'],
    ['Site name','','短信'],['LOGO','address or upload a picture','','UploadLOGO','500x240px'],
    ['Favicon','address or upload a picture','','UploadFavicon','32x32px'],
    ['Manage background login background','address or upload a picture','','Upload background image','1920x1080px'],
    ['Client login background','address or upload a picture','','Upload background image','1920x1080px']
  ]],
  'system SMS': ['System SMS','Confirm configuration',[
    ['SPID','6 spid digits,Indicates sending system SMS using this SPID'],['Uses of SMS','please select']
  ]],
  'system SMTP': ['SMTP Setting','Save',[
    ['SMTP Server','Please enter SMTP server address'],['Port','Please enter the port number'],
    ['Encryption','Select Encryption'],['SMTP Auth','please select'],['Username','Please enter the username'],
    ['Password','Please enter the password'],['From email','Please enter the from email address'],['From name','Please enter the from name']
  ]],
  'my password': ['Edit password','Confirm',[['Old password'],['New password'],['Confirm password']]]
};
