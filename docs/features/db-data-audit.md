# Reference-data audit

The 2025 courses existed while their study-plan rows were missing. A successful connection (`db:check`) and per-file row counts did not establish complete plan coverage. The audit now checks the loaded reference data against a reviewed baseline and separates unexpected omissions from documented gaps.

## Run

```powershell
npm run db:audit
```

This uses the normal database configuration, executes SELECTs in a repeatable-read, read-only transaction, and exits nonzero on errors. It does not repair or seed data. `npm run db:seed` also runs this audit before printing `Seeding complete.` An empty seeds directory now fails instead of exiting successfully.

Seeding still commits each file separately: a later file or audit failure does not undo earlier seed files. Resolve the reported error, then re-run the seeds. The audit can also be run separately after deployment or imports to check the database actually being used.

## Checked coverage

- Expected course **codes**, not numeric IDs or counts alone (67 old, 78 new).
- Exact stored prerequisite tuples (49 old, 77 new), including group number and required course, standing band, or placement.
- Exact 2025 component types, weekly hours, and lab kinds (141 rows).
- All 12 expected templates, their bylaw, program, track, entry paths, and individual slot counts (542 slots total).
- Course placement through either direct slots **or elective-pool membership**, including nonempty, placed pools with the per-box selection count.
- SSCI 301 in year 3 spring; CSC 291 and CSC 391 in year 2/year 3 summer.
- Warnings for documented courses without placement or stored prerequisites, unresolved `data_gap` rows, and CS students whose track/paths do not match any template. Student identities are not printed.

`scripts/reference-data-policy.json` records the current baseline independently of database IDs. Update it only when a source-backed seed change is reviewed. Changing the baseline to match unexplained database damage would hide the problem. Synthetic fixtures should use a separate bylaw, as the existing query tests do; extra courses under the two official bylaws are deliberately flagged for review.

The audit checks data consistency and the explicit coverage listed above. It is not a new, exhaustive extraction of all PDFs and workbooks, and does not validate every course title, credit value, old plan position, elective member identity, or application eligibility decision. A passing audit does **not** mean every academic rule is supported.

## Remaining findings

| Finding                                                                                                                                                                 | Current effect                                                                           | Needed follow-up                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSC 493 now has a stored 87-credit rule; eligibility integration is pending (`new_csc_493_87_credits`).                                                                 | An application that ignores the new credits type could allow Senior Project I too early. | Database support and seed are implemented. Backend B must evaluate the inclusive minimum at the information cutoff; see [credit-requisite follow-up](db-credit-requisite.md).           |
| Old courses have no component rows (`old_weekly_hours`).                                                                                                                | Lecture/lab section estimates cannot be derived from these reference rows.               | Support fractional weekly hours before loading the old PDF's hours; some are 12.5, 2.5, or 1.5.                                                                                         |
| Old standing/code conflicts and concurrent prerequisites remain unresolved (`old_senior_threshold`, `old_sheet_vs_table_codes`, `old_or_concurrent`, and related gaps). | A course can exist while its eligibility rule or plan placement is unknown.              | Apply the team's confirmed decisions; do not infer equivalences from similar titles or treat missing rules as automatic passes.                                                         |
| Two compulsory positions per 2025 track and unprinted entry-path variants remain absent (`plan_2025_by_term`).                                                          | The current 2025 plans are partial, as explicitly agreed.                                | Obtain the semester mapping and any additional official entry-path plans.                                                                                                               |
| Multiple elective boxes share a pool.                                                                                                                                   | A consumer could reuse the same passed member to satisfy multiple boxes.                 | Verify distinct-member allocation in Backend B; the forecasting implementation is not present in this checkout, so this is an integration risk rather than a confirmed application bug. |

The known no-placement lists contain 13 old and 9 new course codes after considering pools. Those numbers are not 22 newly discovered load failures: they include preparatory courses, known code conflicts, unsupported compulsory mappings, and courses without a sourced placement. Warnings identify them rather than silently declaring the curriculum complete. AI/BMD/CSEC curricula remain outside this CS seed scope.

## Regression tests

Use a disposable, migrated and seeded database whose name ends in `_test`. Set `TEST_DATABASE_URL` explicitly, then run:

```powershell
npm run test:db-audit
```

The tests never load `.env`. They deliberately change test data inside transactions and always roll those changes back. Ten tests cover the original missing-plan failure, a missing template, wrong course codes/prerequisite targets/component hours with unchanged counts, incorrect SSCI 301 placement, incorrect elective counts, valid elective-only coverage, read-only operation with known warnings, and anonymous reporting of unmatched students.

Verified on isolated PostgreSQL alongside repeated seeding, migration upgrade/down/up checks, and the existing forecast query suite. No development database was used.
