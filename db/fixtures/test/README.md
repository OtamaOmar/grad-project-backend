# SYN-0001 test fixtures

Synthetic students and enrollments for testing the forecast on a throwaway database.
All data is fake. Student ids are `SYN-0001`, `SYN-0002`, and so on; a real university id never starts with `SYN-`.

## Rules

- Load only into a database whose name ends in `_test` or `_dev`. Every file checks `current_database()` first and stops otherwise.
- Never loaded by `npm run db:seed`. That command reads `seeds/` only.
- There is no marker column. The synthetic set is recognised by its `SYN-` ids in a `_test` or `_dev` database.

## Load

The schema and the reference seeds come first:

```
npm run migrate:up
npm run db:seed
```

Then load the three files in one transaction:

```
psql -X -v ON_ERROR_STOP=1 --single-transaction -d <name>_test -f db/fixtures/test/001_syn_terms.sql -f db/fixtures/test/002_syn_students.sql -f db/fixtures/test/003_syn_enrollments.sql
```

If a guard or the final check fails, no rows are inserted or updated (identity sequences may still advance).

## Files

| File                      | Rows                                                    |
| ------------------------- | ------------------------------------------------------- |
| `001_syn_terms.sql`       | 9 academic terms, fall 2022 to fall 2026                |
| `002_syn_students.sql`    | 10 students, `SYN-0001` to `SYN-0010`                   |
| `003_syn_enrollments.sql` | 166 enrollments, then a self-check of the whole SYN set |

## Loading twice

Loading again is safe. Terms are inserted only when missing and are never changed. Students and enrollments are updated in place on their unique keys, so counts and ids stay the same. A student's `bylaw_id` is never updated; an existing `SYN-` student under another bylaw stops the load.

A reload does not delete anything. To start from zero, drop the throwaway database and create it again.

## Cases

Suggested run: target term fall 2026, information cutoff spring 2026.

| Student            | Case                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------- |
| SYN-0001           | No track                                                                              |
| SYN-0002           | No English path                                                                       |
| SYN-0003           | No math path                                                                          |
| SYN-0004           | 2025 bylaw, CGPA 3.00: the CGPA 3.00-3.30 band, 21 credits (was a null maximum)       |
| SYN-0005           | Old bylaw, CGPA 3.30: above 3.0 while "first year" is undefined                       |
| SYN-0006           | Old bylaw, CGPA exactly 3.00: control, not counted                                    |
| SYN-0007           | COMM 401 consumes the cap (was null); prerequisite code conflict (CSCI 417, CSCI 415) |
| SYN-0008           | CSCI 490 needs 67 passed credits (was Senior Standing with no minimum)                |
| SYN-0009, SYN-0010 | Unknown repeat intention (withdrawn MATH 210, incomplete HUMA 101)                    |

Details and sources: `docs/features/db-syn-0001-fixtures.md`.

## Pending

The Table 10 check (three contributions on one old-bylaw course, `1.00 + 0.80 + 0.25 = 2.05`) is **pending**. Those rows come later from Backend B and are not in these files.
