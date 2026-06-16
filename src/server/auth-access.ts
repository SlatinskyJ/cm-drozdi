import { createAccessControl } from 'better-auth/plugins/access';
import {
	adminAc,
	defaultStatements,
} from 'better-auth/plugins/admin/access';

/**
 * Access-control statements for the admin plugin. We reuse the plugin's
 * default `user`/`session` statements so admin endpoints
 * (createUser/setRole/listUsers/removeUser/revokeUserSessions) authorize
 * correctly.
 */
export const statement = {
	...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

export const guest = ac.newRole({});
export const member = ac.newRole({});
export const admin = ac.newRole({
	...adminAc.statements,
});

export const roles = { guest, member, admin };
