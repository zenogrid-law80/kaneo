import { createContext, useContext, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { BugEnvironment } from "@/fetchers/bug";
import { useBugEnvironments } from "@/hooks/queries/bug/use-bugs";

export const defaultBugEnvironments: BugEnvironment[] = [
  { id: "development", name: null, archived: false },
  { id: "staging", name: null, archived: false },
  { id: "production", name: null, archived: false },
];
const defaultKeys = {
  development: "tasks:bugs.environments.development",
  staging: "tasks:bugs.environments.staging",
  production: "tasks:bugs.environments.production",
} as const;
const EnvironmentContext = createContext<{
  environments: BugEnvironment[];
  ready: boolean;
  error: boolean;
  retry: () => void;
}>({
  environments: defaultBugEnvironments,
  ready: true,
  error: false,
  retry: () => {},
});
export function BugEnvironmentProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const query = useBugEnvironments(projectId);
  return (
    <EnvironmentContext.Provider
      value={{
        environments: query.data ?? defaultBugEnvironments,
        ready: !!query.data,
        error: query.isError && !query.data,
        retry: () => {
          void query.refetch();
        },
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}
export function useEnvironmentOptions() {
  const { environments, ready, error, retry } = useContext(EnvironmentContext);
  const { t } = useTranslation();
  const label = (id: string | null) => {
    if (id === null || id === "none") return t("tasks:bugs.environments.none");
    const item = environments.find((entry) => entry.id === id);
    if (item?.name) return item.name;
    if (Object.hasOwn(defaultKeys, id))
      return t(defaultKeys[id as keyof typeof defaultKeys]);
    return id;
  };
  return { environments, label, ready, error, retry };
}
