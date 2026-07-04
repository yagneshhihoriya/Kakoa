/**
 * Module registry (docs/admin-platform §5, [03] manifests) — the plugin system.
 *
 * Each admin module registers a manifest. `composeAdmin(ctx)` filters modules by
 * (a) enablement (default ⊕ per-business settings override), (b) required
 * capabilities ⊆ the business's capabilities, and (c) whether the acting admin
 * holds at least one nav item's permission. Adding a module is ONE register()
 * call — nav, routes, permission catalog and dashboard widgets compose
 * automatically. This is how modules turn on/off per business with no code change.
 */
import type { Capability } from './capabilities';
import type { Permission } from './permissions';
import type { BusinessContext } from './business-context';

export type ModuleGroup = 'kernel' | 'commerce' | 'content' | 'insight';

export interface NavItem {
  readonly label: string;
  readonly href: string;
  /** Minimum permission to see this nav entry. */
  readonly permission: Permission;
  /** Optional icon key resolved by the UI layer. */
  readonly icon?: string;
}

export interface PermissionDef {
  readonly key: Permission;
  readonly label: string;
}

export interface DashboardWidget {
  readonly key: string;
  readonly permission: Permission;
  readonly requiresCapabilities?: readonly Capability[];
}

export interface AdminModule {
  readonly key: string;
  readonly title: string;
  readonly group: ModuleGroup;
  readonly order: number;
  /** Registry default; a business may override via `module.<key>.enabled`. */
  readonly enabledByDefault: boolean;
  /** Module hidden unless ALL of these capabilities are enabled. */
  readonly requiresCapabilities?: readonly Capability[];
  /** Permissions this module contributes to the catalog. */
  readonly permissions: readonly PermissionDef[];
  readonly nav: readonly NavItem[];
  readonly widgets?: readonly DashboardWidget[];
}

export interface ComposedAdmin {
  /** Enabled + permitted modules for this context, in nav order. */
  readonly modules: readonly AdminModule[];
  /** Flattened, permission-filtered nav in group+order. */
  readonly nav: readonly NavItem[];
  /** Dashboard widgets the acting admin may see. */
  readonly widgets: readonly DashboardWidget[];
}

const GROUP_ORDER: Record<ModuleGroup, number> = {
  kernel: 0,
  commerce: 1,
  content: 2,
  insight: 3,
};

export class ModuleRegistry {
  private readonly modules = new Map<string, AdminModule>();

  /** Register a module manifest. Throws on a duplicate key (config bug). */
  register(module: AdminModule): this {
    if (this.modules.has(module.key)) {
      throw new Error(`Duplicate admin module key: ${module.key}`);
    }
    this.modules.set(module.key, module);
    return this;
  }

  /** All registered modules (unfiltered) — for the Permissions catalog view. */
  all(): readonly AdminModule[] {
    return [...this.modules.values()];
  }

  /** The full permission catalog contributed by all registered modules. */
  permissionCatalog(): readonly PermissionDef[] {
    return this.all().flatMap((m) => m.permissions);
  }

  /** Is a module enabled for this context? default ⊕ settings override. */
  private isEnabled(module: AdminModule, ctx: BusinessContext): boolean {
    const override = ctx.settings.getBool(
      'module',
      `${module.key}.enabled`,
      module.enabledByDefault,
    );
    if (!override) return false;
    // Every required capability must be present.
    if (module.requiresCapabilities) {
      for (const cap of module.requiresCapabilities) {
        if (!ctx.has(cap)) return false;
      }
    }
    return true;
  }

  /**
   * Compose the admin surface for a context: enabled modules whose capabilities
   * are met and for which the acting admin holds ≥1 nav permission, plus the
   * permission-filtered nav and widgets. Deterministic ordering (group, order).
   */
  compose(ctx: BusinessContext): ComposedAdmin {
    const sorted = [...this.modules.values()].sort(
      (a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || a.order - b.order,
    );

    const modules: AdminModule[] = [];
    const nav: NavItem[] = [];
    const widgets: DashboardWidget[] = [];

    for (const module of sorted) {
      if (!this.isEnabled(module, ctx)) continue;
      // Nav entries the acting admin is permitted to see.
      const permittedNav = module.nav.filter((n) => ctx.can(n.permission));
      if (permittedNav.length === 0) continue; // no visible entry ⇒ hide module
      modules.push(module);
      nav.push(...permittedNav);
      for (const w of module.widgets ?? []) {
        const capOk = (w.requiresCapabilities ?? []).every((c) => ctx.has(c));
        if (capOk && ctx.can(w.permission)) widgets.push(w);
      }
    }

    return { modules, nav, widgets };
  }
}
