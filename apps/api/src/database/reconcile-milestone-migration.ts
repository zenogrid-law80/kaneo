import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

// main shipped milestone migration 0045 after upstream had already used that
// number. Its timestamp would make Drizzle skip upstream migrations 0045–0059.
// Reconcile only that exact known history; 0060 preserves the existing data.
export async function reconcileMilestoneMigration(
  db: Pick<NodePgDatabase, "execute">,
) {
  await db.execute(
    sql.raw(`
    DO $$ BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('kaneo:milestone-migration-history'));
      IF to_regclass('drizzle.__drizzle_migrations') IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM drizzle.__drizzle_migrations
          WHERE hash = '9cf671001c053fae4d3720c7dd7e3973588ce0cb1d31df83be5c345463269fa7' AND created_at = 1791878252275
        ) THEN
          IF EXISTS (
            SELECT 1 FROM drizzle.__drizzle_migrations
            WHERE created_at > 1791878252275
          ) THEN
            RAISE EXCEPTION 'Cannot reconcile milestone migration with a later unknown migration history';
          END IF;
          DELETE FROM drizzle.__drizzle_migrations
          WHERE hash = '9cf671001c053fae4d3720c7dd7e3973588ce0cb1d31df83be5c345463269fa7' AND created_at = 1791878252275;
        END IF;
      END IF;
    END $$;
  `),
  );
}
