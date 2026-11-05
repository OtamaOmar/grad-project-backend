# CSC 493: minimum completed credits

The 2025 CS course table requires **"Completing 87 Credit Hours or more"** for CSC 493, Senior Project I (CS New Bylaws - 25.pdf, Article 36, p.28). The senior band begins at 96 credits, so using that band would impose the wrong requirement. Previously no requisite row represented this rule.

## Database and query changes

Migration `1793750400001_requisite-min-credits.sql` adds nullable integer `requisite.min_credits_passed` and type `credits`. A credits row must contain a nonnegative minimum and no course, standing, or placement target. The three existing types require their original target and a NULL credit minimum. The same-bylaw trigger continues to enforce all foreign-key targets; credits rows have no extra parent table.

Seed 007 adds exactly one group-1 credits rule for CSC 493 with minimum **87**. Re-running updates that rule rather than creating another. The 2025 requisite count is now 77 (70 course, 3 standing, 3 placement, 1 credits). The audit baseline includes the threshold, so 86 or 96 will fail the audit even though the count remains correct.

`course_requisites_grouped.sql` keeps its existing output columns. For `requisite_type = 'credits'`, `min_credits_passed` is the inclusive requisite minimum, and `max_credits_passed`, `standing_band_id`, `standing_level`, `required_course_id`, `placement_id`, and `placement_code` are NULL. For standing rows, both bounds continue to come from the standing band. No artificial standing band is added.

## Handoff to Ayman / Backend B

The eligibility implementation is not in this checkout. **Database readiness does not enforce eligibility by itself.** Add support for `requisite_type === 'credits'` in the prerequisite evaluator:

- Use the existing completed/passed credit total **at the information cutoff**, not current registration credits or results after the cutoff. Preserve the engine's distinct-course and degree-credit rules; do not count repeated attempts twice.
- A known total of 86 fails this requirement; 87 and 88 meet it. The rule remains part of the existing AND-within-group / OR-across-groups evaluation. Meeting this one requisite does not override other forecast rules.
- An unknown credit total remains unresolved. Do not guess zero or automatically pass an unrecognised requisite type.
- Handle the query's numeric `min_credits_passed` value directly; do not substitute `standing_level = 'senior'` or 96.

Run `npm run migrate:up`, then `npm run db:seed` after receiving these changes. The `new_csc_493_87_credits` data-gap status is preserved rather than automatically marked resolved: confirm consumer integration and its boundary tests before resolving it.

## Verification and rollback

With `TEST_DATABASE_URL` explicitly set to a disposable, migrated and seeded database ending in `_test`, run `npm run test:db-credits`. It tests the actual query, 86/87/88 contract examples, unchanged standing bounds, invalid NULL/negative/mixed targets, and audit detection of a wrong threshold. It does not load `.env` or test Backend B's absent implementation.

Down requires credit-type rows to be explicitly removed first. With CSC 493's rule still present, Down fails transactionally and preserves the new schema and rule; it never silently deletes the requirement. Re-running the new seeds requires Up again.
