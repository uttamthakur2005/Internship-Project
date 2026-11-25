const PERMISSIONS = Object.freeze({
  'users.manage': 'Manage users',
  'settings.manage': 'Manage settings',
  'dashboard.view': 'View dashboard',
  'products.view': 'View products, categories, and stock quantities',
  'products.manage': 'Manage products and categories',
  'stock.adjust': 'Set opening stock and adjust stock',
  'stock.view': 'View stock movements',
  'contacts.manage': 'Manage suppliers and customers',
  'customers.view': 'Select and view customers',
  'purchases.manage': 'Manage purchases',
  'sales.view': 'View sales',
  'sales.create': 'Create and confirm sales',
  'sales.cancel': 'Cancel any draft sale',
  'reports.view': 'View reports'
});

const ROLE_PERMISSIONS = Object.freeze({
  admin: Object.keys(PERMISSIONS),
  manager: [
    'dashboard.view',
    'products.view',
    'products.manage',
    'stock.adjust',
    'stock.view',
    'contacts.manage',
    'customers.view',
    'purchases.manage',
    'sales.view',
    'sales.create',
    'sales.cancel',
    'reports.view'
  ],
  staff: ['products.view', 'customers.view', 'sales.view']
});

const GRANTABLE_TO_STAFF = Object.freeze(['sales.create']);

function effectivePermissions(user) {
  const defaults = ROLE_PERMISSIONS[user.role] || [];
  if (user.role !== 'staff') return [...defaults];
  const grants = (user.extraPermissions || []).filter((permission) =>
    GRANTABLE_TO_STAFF.includes(permission)
  );
  return [...new Set([...defaults, ...grants])];
}

module.exports = { PERMISSIONS, ROLE_PERMISSIONS, GRANTABLE_TO_STAFF, effectivePermissions };
