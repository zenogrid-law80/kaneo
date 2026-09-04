import { HTTPException } from "hono/http-exception";

export function resolveStatisticsDateRange(
  startDate?: string,
  endDate?: string,
  now = new Date(),
) {
  const defaultStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  defaultStart.setUTCMonth(defaultStart.getUTCMonth() - 1);
  const start = startDate
    ? new Date(`${startDate}T00:00:00.000Z`)
    : defaultStart;
  const inclusiveEnd = endDate
    ? new Date(`${endDate}T00:00:00.000Z`)
    : new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );

  if (start > inclusiveEnd) {
    throw new HTTPException(400, {
      message: "Start date must be on or before end date",
    });
  }

  const endExclusive = new Date(inclusiveEnd);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  return { start, endExclusive };
}

export function getMonthKeys(start: Date, endExclusive: Date) {
  const endInclusive = new Date(endExclusive);
  endInclusive.setUTCDate(endInclusive.getUTCDate() - 1);
  const keys: string[] = [];

  for (
    let cursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
    );
    cursor <= endInclusive;
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    )
  ) {
    keys.push(cursor.toISOString().slice(0, 7));
  }

  return keys;
}
