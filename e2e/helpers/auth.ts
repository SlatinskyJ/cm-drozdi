import path from 'node:path';

const AUTH_DIR = path.join(process.cwd(), 'e2e/.auth');

export const ADMIN_AUTH = path.join(AUTH_DIR, 'admin.json');
export const MEMBER_AUTH = path.join(AUTH_DIR, 'member.json');
