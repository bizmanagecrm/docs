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

function publicBehavior(action) {
  if (!action) return 'Open or submit the current screen.';
  if (/^https?:\/\//i.test(action)) return 'Open linked help or documentation.';
  if (action === 'submit') return 'Submit the current form.';
  if (action === 'button') return 'Run the button behavior configured by the surrounding form.';
  const behavior = humanizeAction(action);
  return behavior ? `${behavior.charAt(0).toUpperCase()}${behavior.slice(1)}.` : 'Open or run the configured screen action.';
}

function publicLabel(label) {
  if (!label) return 'Context action';
  if (/\$|(?:^|\s)[A-Za-z_$][\w$]*\.[\w$]|[?:()]/.test(label)) return 'Dynamic / tenant-configured control';
  return label;
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
      label: publicLabel(label),
      action: publicBehavior(action),
    });
  }
}

const uniqueActions = [...new Map(actions.map((item) => [`${item.screen}|${item.label}|${item.action}`, item])).values()]
  .sort((a, b) => a.screen.localeCompare(b.screen) || a.label.localeCompare(b.label));

const permissionRank = { Public: 0, 'API User': 1, Admin: 2, Root: 3 };
function strongestPermission(...levels) {
  return levels.filter(Boolean).sort((a, b) => permissionRank[b] - permissionRank[a])[0] || 'API User';
}

function joinRoute(prefix, route) {
  const joined = `${prefix}/${route}`.replace(/\/{2,}/g, '/');
  return joined.length > 1 && joined.endsWith('/') ? joined.slice(0, -1) : joined;
}

function purposeFor(method, endpoint) {
  const exact = {
    'ALL /restapi/open-ping': 'Check server reachability without authentication.',
    'ALL /restapi/ping': 'Check an authenticated API connection.',
    'POST /restapi/register': 'Register an API user (root only).',
    'POST /restapi/crud/:table/:op': 'Run a generic CRUD operation subject to table, operation, and API-user permissions.',
    'POST /restapi/ai/ask': 'Generate a text answer.',
    'POST /restapi/ai/generate-json': 'Generate schema-constrained JSON.',
    'POST /restapi/ai/tools/run': 'Run AI with approved read-only CRM tools.',
    'POST /restapi/ai/files': 'Upload a temporary text-like file for AI use.',
    'POST /restapi/payments/charge-payment-method': 'Charge a saved payment method through a configured gateway.',
    'POST /restapi/sms/send': 'Queue an SMS message.',
  };
  if (exact[`${method} ${endpoint}`]) return exact[`${method} ${endpoint}`];
  const words = endpoint
    .replace(/^\/restapi\//, '')
    .split('/')
    .filter((part) => part && !part.startsWith(':'))
    .map((part) => part.replace(/[-_]/g, ' '))
    .join(' → ');
  const verb = method === 'GET' ? 'Read or run' : method === 'POST' ? 'Create, update, or run' : method === 'PUT' ? 'Replace or associate' : method === 'PATCH' ? 'Update' : method === 'DELETE' ? 'Delete' : 'Access';
  return `${verb} ${words}.`;
}

function impactFor(method, endpoint) {
  if (endpoint.includes('/payments/')) return 'Financial';
  if (/\/(sms|users\/invite-user)/.test(endpoint)) return 'Communication';
  if (/publish/i.test(endpoint)) return 'Publishes content';
  if (/\/admin\/(?:create|cache|tools\/(?:ai-gateways|payment-gateways|sms-gateways|ip-wb-list|mail-domains|migrations|files\/sync))/.test(endpoint) || endpoint === '/restapi/register') return 'Production configuration';
  if (/delete|remove|force-delete|reset|cancel|refund|void|stop|terminate|decrypt/i.test(endpoint) || method === 'DELETE') return 'Destructive';
  if (/create|update|publish|register|set-|upsert|encrypt|regenerate|sync|import|top-up|recalculate/i.test(endpoint) || ['POST', 'PUT', 'PATCH'].includes(method)) return 'Writes data';
  return 'Read only';
}

function parseRouteFile(relativeFile, prefix, inheritedPermission = 'API User') {
  const absolute = path.join(core, relativeFile);
  const source = fs.readFileSync(absolute, 'utf8');
  const globalPermission = /router\.use\(\s*(?:Perm\.)?onlyRoot\s*\)/.test(source) ? 'Root'
    : /router\.use\(\s*(?:Perm\.)?onlyAdmin\s*\)/.test(source) ? 'Admin'
      : inheritedPermission;
  const results = [];
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/router\.(get|post|put|patch|delete|all)\s*\(\s*(["'`])([^"'`]+)\2\s*,(.*)/i);
    if (!match) continue;
    const method = match[1].toUpperCase();
    const endpoint = joinRoute(prefix, match[3]);
    const routePermission = /(?:Perm\.)?onlyRoot/.test(match[4]) ? 'Root' : /(?:Perm\.)?onlyAdmin/.test(match[4]) ? 'Admin' : null;
    const permission = strongestPermission(inheritedPermission, globalPermission, routePermission);
    results.push({
      method,
      endpoint,
      purpose: purposeFor(method, endpoint),
      permission,
      impact: impactFor(method, endpoint),
    });
  }
  return results;
}

const apiMounts = [
  ['routes/restapi/crud.js', '/restapi/crud', 'API User'],
  ['routes/cust_report.js', '/restapi/c-reports', 'API User'],
  ['routes/restapi/projects.js', '/restapi/projects', 'API User'],
  ['routes/restapi/payments.js', '/restapi/payments', 'API User'],
  ['routes/restapi/sms.js', '/restapi/sms', 'API User'],
  ['routes/ai.js', '/restapi/ai', 'API User'],
  ['routes/restapi/users.js', '/restapi/users', 'API User'],
  ['routes/secure.js', '/restapi/secure', 'API User'],
  ['routes/cust-fields.js', '/restapi/customization', 'API User'],
  ['routes/scripts.js', '/restapi/be-scripts', 'API User'],
  ['routes/custom-pages.js', '/restapi/custom-pages', 'Admin'],
  ['routes/admin.js', '/restapi/admin', 'Admin'],
  ['routes/recycle-bin.js', '/restapi/admin/recycle-bin', 'Admin'],
  ['routes/custom-text.js', '/restapi/admin/custom-text', 'Admin'],
  ['routes/custom-pages.js', '/restapi/admin/custom-pages', 'Admin'],
  ['routes/cache.js', '/restapi/admin/cache', 'Admin'],
  ['routes/admin-tools.js', '/restapi/admin/tools', 'Admin'],
];

const publicEndpoints = [
  { method: 'ALL', endpoint: '/restapi/open-ping', purpose: purposeFor('ALL', '/restapi/open-ping'), permission: 'Public', impact: 'Read only' },
  { method: 'POST', endpoint: '/restapi/register', purpose: purposeFor('POST', '/restapi/register'), permission: 'Root', impact: 'Writes data' },
  { method: 'ALL', endpoint: '/restapi/ping', purpose: purposeFor('ALL', '/restapi/ping'), permission: 'API User', impact: 'Read only' },
];
for (const [file, prefix, permission] of apiMounts) publicEndpoints.push(...parseRouteFile(file, prefix, permission));
const uniqueEndpoints = [...new Map(publicEndpoints.map((item) => [`${item.method}|${item.endpoint}`, item])).values()]
  .sort((a, b) => a.endpoint.localeCompare(b.endpoint) || a.method.localeCompare(b.method));

fs.writeFileSync(path.join(outDir, 'actions.json'), JSON.stringify({ generatedFrom: 'supplied BizManage source snapshot', count: uniqueActions.length, actions: uniqueActions }, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'api.json'), JSON.stringify({
  generatedFrom: 'supplied BizManage source snapshot',
  count: uniqueEndpoints.length,
  permissions: {
    Public: 'No API credential required by the route.',
    'API User': 'Any authenticated API identity, still subject to policy, operation, table, feature, and usage checks.',
    Admin: 'API identity with role admin or root.',
    Root: 'API identity with role root.',
  },
  endpoints: uniqueEndpoints,
}, null, 2) + '\n');
console.log(`Generated ${uniqueActions.length} UI actions and ${uniqueEndpoints.length} REST API entries.`);
