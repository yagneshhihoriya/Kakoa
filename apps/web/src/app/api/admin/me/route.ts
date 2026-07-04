/**
 * GET /api/admin/me — the acting admin + the registry-composed, permission- and
 * capability-filtered nav for their BusinessContext. Drives the admin shell.
 * 401 when there is no live admin session.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { resolveAdminContext } from '@/lib/admin/context';
import { adminRegistry } from '@/lib/admin/modules';

export async function GET(): Promise<Response> {
  const resolved = await resolveAdminContext();
  if (resolved === null) {
    return jsonErr('UNAUTHORIZED', 'Admin sign-in required.');
  }
  const { admin, ctx } = resolved;
  const composed = adminRegistry.compose(ctx);

  return jsonOk(
    {
      admin: { email: admin.email, name: admin.name, roleKey: admin.roleKey },
      business: { name: ctx.profile.name, vertical: ctx.profile.vertical },
      nav: composed.nav.map((n) => ({
        label: n.label,
        href: n.href,
        icon: n.icon ?? null,
      })),
      widgets: composed.widgets.map((w) => w.key),
    },
    { cacheControl: NO_STORE },
  );
}
