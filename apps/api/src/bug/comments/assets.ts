import { and, eq, notInArray } from "drizzle-orm";
import type db from "../../database";
import { assetTable } from "../../database/schema";
import { extractAssetIds } from "../../storage/cleanup-assets";
import { queueStorageCleanup } from "../../storage/cleanup-queue";

export async function removeBugCommentAssets(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  commentId: string,
  content = "",
) {
  const retained = [...extractAssetIds(content)];
  const removed = await tx
    .delete(assetTable)
    .where(
      and(
        eq(assetTable.bugCommentId, commentId),
        retained.length ? notInArray(assetTable.id, retained) : undefined,
      ),
    )
    .returning({ key: assetTable.objectKey });
  await queueStorageCleanup(
    tx,
    removed.map((asset) => asset.key),
  );
}
