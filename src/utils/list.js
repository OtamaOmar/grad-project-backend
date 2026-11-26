import { z } from "zod";

// Shared rules for list endpoints, matching the frontend mock's listResponse():
// sort = a column name, "-" in front for descending; page from 1; page_size 1-100.

// Query fields every list accepts. Only the names in `sortColumns` are valid sorts.
export function listFields(sortColumns, defaultSort, defaultPageSize = 10) {
  const sorts = Object.keys(sortColumns).flatMap((key) => [key, `-${key}`]);
  return {
    sort: z.enum(sorts).default(defaultSort),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(defaultPageSize),
  };
}

// A filter value from the query string. "all" or "" means "no filter", like the mock.
export const optionalFilter = (max = 32) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((value) =>
      value === "all" || value === "" ? undefined : value,
    );

// Builds the ORDER BY text. Only SQL from `sortColumns` is used, never the raw value,
// so the browser cannot inject anything. Empty values always sort last.
export function orderBy(sort, sortColumns, tieBreaker) {
  const descending = sort.startsWith("-");
  const column = sortColumns[descending ? sort.slice(1) : sort];
  return `${column} ${descending ? "DESC" : "ASC"} NULLS LAST, ${tieBreaker}`;
}
