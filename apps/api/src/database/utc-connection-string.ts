/** Drizzle stores and reads timezone-less timestamps as UTC. */
export function withUtcDatabaseSession(connectionString: string): string {
  const url = new URL(connectionString);
  const options = url.searchParams.get("options");

  // Put this last so a URL option cannot restore the server's local timezone.
  // Apply it at connection startup, before the pool can issue its first query.
  url.searchParams.set(
    "options",
    [options, "-c timezone=UTC"].filter(Boolean).join(" "),
  );

  return url.toString();
}
