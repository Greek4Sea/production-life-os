// Server-side module contract. UI (tile + page components) lives in the module's
// folder and is wired up in the dashboard/page routes — kept out of this manifest
// so API routes never import React components.
export interface ModuleManifest {
  id: string;
  name: string;
  tileSize: 'sm' | 'wide' | 'tall' | 'big';
  // Optional: false = module not configured yet; sync is skipped and the tile
  // shows a "set up" hint instead of errors.
  enabled?: () => boolean;
  syncEveryMin?: number;
  sync?: () => Promise<void>;
  // Handle /api/mod/<id>/<path...>; return null for "no such endpoint".
  api?: (req: Request, path: string[]) => Promise<Response | null>;
  // Summary blob consumed by this module's dashboard tile.
  dashboardData?: () => Promise<unknown>;
  defaultSettings?: Record<string, unknown>;
}
