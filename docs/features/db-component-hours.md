# Old-bylaw component hours

The old course tables contain lecture and Section/Lab contact hours, including 12.5, 2.5 and 1.5. The integer column prevented an exact load. The original PDF and workbook remain unchanged; the component rows were checked visually against **CS Old Bylaws.pdf, printed pp.19-23**.

## Changes

- Migration `1793750400002_fractional-component-hours.sql` changes `course_component.weekly_contact_hours` to exact `numeric`, with no fixed decimal scale that could round source values. The check requires positive finite values; zero, negatives, NaN and infinities are rejected. Existing 2025 whole-hour values remain numerically unchanged.
- Seed `016_course-components-old.sql` adds **97 components on 54 old courses**: 54 lecture, 13 tutorial and 30 lab. Explicit `sec` maps to tutorial; explicit `lab` maps to lab. When both are printed, both rows are retained (PHYS 101, CSCI 101 and CSCI 221). Duplicate track listings agree and are seeded only once.
- Examples: ENGL 100 lecture = **12.5**; ECEN 101, MATH 210 and MATH 211 lecture = **2.5**; PHYS 101 lab = **1.5**. CSCI 201 lab = **3**. Hours are not inferred from credit values.
- Lab kind follows the existing team prefix rule: PHYS/ECEN labs are `physics_circuits`, other labs are `computing`. One exception: the Logic Design lab is `physics_circuits` in both bylaws, CSCI 221 (old; Omar's decision, 2026-11-06) and CSC 211 (2025; Omar's decision, 2026-11-26). Class capacity remains unknown (`max_students` NULL), consistent with seed 006.
- The reference audit now compares exact component values for both bylaws: **97 old + 141 new = 238**. It handles PostgreSQL numeric strings without rounding them through JavaScript numbers.

The existing `course_components.sql` query is unchanged: it returns component types and lab kinds, not weekly hours. Backend B can now read the sourced old components through that same query. Direct callers that select `weekly_contact_hours` should expect PostgreSQL `numeric` values to arrive as strings with the default `pg` parser. No eligibility/section-calculation implementation is present in this checkout.

## Preserved uncertainties

MATH 111 has lecture **3**, but the second column contains an unlabelled **2** under the combined `Section/Lab` heading (p.20). Its lecture is loaded; those two hours are not assigned to either type without confirmation. `old_weekly_hours` and the audit warning keep this visible.

The nine workbook-only old codes receive no copied hours from similarly named courses. COMM 401, CSCI 490, CSCI 495 and CSCI 496 have blank contact-hour cells and receive no invented components. MATH 001 is not a seeded course because its credits remain disputed; no component or alias is added for it.

## Apply and test

```powershell
npm run migrate:up
npm run db:seed
npm run db:audit
```

With `TEST_DATABASE_URL` explicitly set to a disposable, migrated and seeded database ending in `_test`, run `npm run test:db-hours`. Tests cover exact fractions, all three component types, unclassified/blank source cells, invalid numeric values, precision, equivalent numeric spellings, and audit detection of tiny changes. They never load `.env` and all test mutations are rolled back.

Down refuses fractional values or positive values above the integer limit instead of rounding or deleting them. It takes an exclusive table lock before checking, so concurrent writes cannot bypass the prerequisite. A failed Down preserves the numeric schema and values transactionally. Whole-valued data can be converted back exactly; the old integer schema cannot run the new seed until Up is applied again.
