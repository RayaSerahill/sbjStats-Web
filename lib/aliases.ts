export const GLOBAL_ALIASES_CREATED_BY = "__global__";

export function usesGlobalAliases(user: { useGlobalAliases?: boolean } | null | undefined) {
  return user?.useGlobalAliases !== false;
}

export function orderAliasesByPrecedence<T extends { createdBy?: string }>(rows: T[], uploaderId: string) {
  const globalRows = rows.filter((row) => row.createdBy === GLOBAL_ALIASES_CREATED_BY);
  const userRows = rows.filter((row) => row.createdBy === uploaderId);
  const otherRows = rows.filter((row) => row.createdBy !== GLOBAL_ALIASES_CREATED_BY && row.createdBy !== uploaderId);

  return [...globalRows, ...otherRows, ...userRows];
}
