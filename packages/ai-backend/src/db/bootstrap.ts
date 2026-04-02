/**
 * @fileoverview Development database bootstrap
 * @description Seeds baseline records required for local and Docker-based runs.
 */

import { eq } from 'drizzle-orm';

import { organizations } from './schema/organizations.js';

import { db } from './index.js';

export const DEFAULT_DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_DEV_ORG_NAME = 'Meeting AI Dev Org';
export const DEFAULT_DEV_ORG_SLUG = 'meeting-ai-dev-org';

export async function ensureDefaultOrganization(): Promise<void> {
  const [existing] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, DEFAULT_DEV_ORG_ID))
    .limit(1);

  if (existing) return;

  await db.insert(organizations).values({
    id: DEFAULT_DEV_ORG_ID,
    name: DEFAULT_DEV_ORG_NAME,
    slug: DEFAULT_DEV_ORG_SLUG,
    isActive: true,
  });
}

async function bootstrap(): Promise<void> {
  await ensureDefaultOrganization();
  process.stdout.write(`Default development organization ensured: ${DEFAULT_DEV_ORG_ID}\n`);
}

if (require.main === module) {
  bootstrap()
    .then(() => process.exit(0))
    .catch((error) => {
      process.stderr.write(`Failed to bootstrap development database: ${String(error)}\n`);
      process.exit(1);
    });
}
