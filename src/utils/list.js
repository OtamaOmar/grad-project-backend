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

// Sorts and pages rows that are already in memory (small tables such as terms or bylaws),
// with the same rules as the SQL lists: "-" for descending, empty values last.
export function sortAndPage(rows, { sort, page, page_size }, allowed) {
  const descending = sort.startsWith("-");
  const field = descending ? sort.slice(1) : sort;
  if (!allowed.includes(field)) throw new Error(`Unknown sort field: ${field}`);
  const sorted = [...rows].sort((a, b) => {
    const x = a[field];
    const y = b[field];
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    const order =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y));
    return descending ? -order : order;
  });
  const start = (page - 1) * page_size;
  return {
    items: sorted.slice(start, start + page_size),
    total: rows.length,
    page,
    page_size,
  };
}
