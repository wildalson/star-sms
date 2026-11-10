import type { Role } from './model.ts';

export const demoAccounts = {
  client: { username: 'demo-client', password: 'client-demo' },
  admin: { username: 'demo-admin', password: 'admin-demo' },
} satisfies Record<Role, { username: string; password: string }>;
