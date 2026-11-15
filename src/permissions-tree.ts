type Permission = { id: string; parent: string; label: string };

export const permissions: Permission[] = `
15||overview
4||SMS
19|4|SMS audit
27|4|send record
114|27|view
115|27|export
153|27|unnamed
154|27|unnamed
28|4|intercept record
58|4|audit record
26|4|reply record
23|4|send task
8||user
36|8|user list
109|36|view SPID
113|36|add user
110|36|lock/unlock users
116|36|overview of modifications
104|36|activate new products
117|36|becoming a regular employee
105|36|lock/unlock product
108|36|attribute configuration
106|36|recharge
107|36|unit price
112|36|modify payment mode
111|36|cancel product
155|36|unnamed
37|8|signature management
38|8|user template
39|8|user blacklist
40|8|user whitelist
145|8|indirect user
5||channel
32|5|channel type
78|32|delete channel (pool) type
79|32|add channel (pool) type
33|5|channel pool list
80|33|view
81|33|add
30|5|channel list
70|30|display the "Cost" field
71|30|display the "Supplier" field
72|30|edit/Add Channel
73|30|delete channel
74|30|deactivate/Enable Channel
66|5|channel steering
31|5|channel provider
128|5|state mapping
130|5|channel alarm
135|5|channel signature
152|5|ali sign
120||reissue
121|120|policy
122|120|reissue channel
7||product
34|7|product tree
75|34|delete product
76|34|add product
77|34|edit product
48|7|product list
13|7|template
3||audit-certify
20|3|signature verification
21|3|template audit
22|3|enterprise audit
47|3|personal audit
124|3|MMS report
141|3|AIM content report
50||statistics
149|50|user statis now
52|50|user statis
102|52|view
103|52|export
56|50|channel statis
98|56|view
99|56|export
54|50|user profit
96|54|view
97|54|export
55|50|channel profit
100|55|view
101|55|export
143|50|signature statistics
146|50|user distribution
151|50|content statis
182|50|Backfill Report
60||basic data
144|60|keyword config
156|144|allow delete
147|60|site domain
12|60|global blacklist
14|60|transfer number
59|60|invalid mobile
67|60|carrier number segment
64|60|reply keyword
68|60|number area
157|60|turn net status code
139|60|user report map
132||s-url and detect
150|132|anti fraud
133|132|short-url domain
134|132|short-url charge
138|132|detect recharge
9||finance
41|9|recharge record
49|9|payment set
129|9|top up package
10||backend users
44|10|account
88|44|view
89|44|add
90|44|edit
91|44|delete
45|10|role
84|45|view
85|45|add
86|45|edit
87|45|delete
46|10|my password
82|46|view
83|46|edit
127|10|operation log
61||system config
62|61|system SMS
148|61|system SMTP
65|61|site config
63|61|server info
137|61|announcement
69||safety notification
118||plugin market
119||channel market
`.trim().split('\n').map(line => {
  const [id, parent, label] = line.split('|');
  return { id, parent, label };
});
