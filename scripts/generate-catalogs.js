#!/usr/bin/env node
/* Generate public documentation indexes from a checked-out BizManage core tree. */
const fs = require('fs');
const path = require('path');

const core = path.resolve(process.argv[2] || '');
if (!core || !fs.existsSync(path.join(core, 'client', 'views'))) {
  console.error('Usage: node scripts/generate-catalogs.js <path-to-core-system>');
  process.exit(1);
}

const outDir = path.resolve(__dirname, '..', 'data');
fs.mkdirSync(outDir, { recursive: true });

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function clean(value = '') {
  return value
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|times|amp|laquo|raquo);/g, ' ')
    .replace(/\{\{([^}]+)\}\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(attrs, name) {
  const match = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match ? clean(match[2]) : '';
}

function humanizeAction(action) {
  const first = (action.match(/(?:^|[;#/])\s*([A-Za-z_$][\w$.-]*)/) || [])[1] || '';
  return clean(first.replace(/^vm\./, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' '));
}

const viewRoot = path.join(core, 'client', 'views');
const actions = [];
for (const file of walk(viewRoot).filter((file) => /\.(?:html|ejs)$/i.test(file))) {
  const source = fs.readFileSync(file, 'utf8');
  const tagRe = /<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = tagRe.exec(source))) {
    const attrs = match[2];
    const action = attr(attrs, 'ng-click') || attr(attrs, 'ng-href') || attr(attrs, 'href') || attr(attrs, 'type');
    const visible = clean(match[3]);
    const label = visible || attr(attrs, 'aria-label') || attr(attrs, 'title') || humanizeAction(action) || 'Context action';
    if (!label && !action) continue;
    actions.push({
      screen: path.relative(viewRoot, file).replace(/\\/g, '/').replace(/\.html?$/i, '').replace(/(^|\/)[-_]/g, '$1'),
      label,
      action: action || 'Opens or submits the current screen',
    });
  }
}

const uniqueActions = [...new Map(actions.map((item) => [`${item.screen}|${item.label}|${item.action}`, item])).values()]
  .sort((a, b) => a.screen.localeCompare(b.screen) || a.label.localeCompare(b.label));

const publicEndpoints = [
  ['ALL', '/restapi/open-ping', 'Check whether the server is reachable; no API key required.'],
  ['ALL', '/restapi/ping', 'Check an authenticated API connection.'],
  ['POST', '/restapi/crud/:table/:op', 'Run an allowed CRUD operation using the API user permissions.'],
  ['GET', '/restapi/projects/update-status/:project/:status', 'Change a project status.'],
  ['POST', '/restapi/payments/save-payment-method', 'Save a reusable payment method through the configured gateway.'],
  ['POST', '/restapi/payments/charge-payment-method', 'Charge a saved payment method.'],
  ['GET', '/restapi/payments/gateways', 'List payment gateways available to the API user.'],
  ['POST', '/restapi/payments/create-subscription', 'Create a subscription.'],
  ['GET', '/restapi/payments/cancel-subscription/:id', 'Cancel a subscription.'],
  ['GET', '/restapi/payments/resume-subscription/:id', 'Resume a subscription.'],
  ['POST', '/restapi/payments/import-subscription', 'Import an existing gateway subscription.'],
  ['POST', '/restapi/payments/update-subscription-payment-method/:id', 'Replace a subscription payment method.'],
  ['POST', '/restapi/sms/send', 'Queue an SMS message.'],
  ['GET', '/restapi/sms/conversations', 'List SMS conversations.'],
  ['GET', '/restapi/sms/conversation/:conversation_key', 'Read one SMS conversation.'],
  ['GET', '/restapi/sms/gateways', 'List configured SMS gateways.'],
  ['POST', '/restapi/ai/ask', 'Generate a text answer.'],
  ['POST', '/restapi/ai/generate-json', 'Generate schema-constrained JSON.'],
  ['POST', '/restapi/ai/tools/run', 'Run an AI request with approved read-only CRM tools.'],
  ['POST', '/restapi/ai/files', 'Upload a temporary text-like file for AI use.'],
  ['GET', '/restapi/ai/requests', 'Read AI request logs allowed to the API user.'],
  ['POST', '/restapi/ai/skills/relevant', 'Find AI skills relevant to a request.'],
  ['GET', '/restapi/users/invite-user/:id', 'Send an invitation to an existing user record.'],
  ['POST', '/restapi/secure/encrypt', 'Encrypt a value using the instance encryption service.'],
  ['POST', '/restapi/secure/decrypt', 'Decrypt a value when the API user is authorized.'],
];

fs.writeFileSync(path.join(outDir, 'actions.json'), JSON.stringify({ generatedFrom: 'client/views', count: uniqueActions.length, actions: uniqueActions }, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'api.json'), JSON.stringify({ generatedFrom: 'routes/restapi and mounted public API routes', count: publicEndpoints.length, endpoints: publicEndpoints.map(([method, endpoint, purpose]) => ({ method, endpoint, purpose })) }, null, 2) + '\n');
console.log(`Generated ${uniqueActions.length} UI actions and ${publicEndpoints.length} supported API entries.`);
