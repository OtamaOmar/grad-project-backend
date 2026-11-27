# Error envelope

Every error from the Node API uses one shape. FastAPI errors are mapped into it by Node. The browser never sees a FastAPI error body.

Owner: Omar. Approver for changes: Backend B (REST envelope), plus Omar.
Code: `src/middleware/errorHandler.js` and `src/utils/AppError.js`. Frontend reader: `src/services/http.js` and `src/services/ApiError.js`.

## Shape

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request is not valid.",
    "details": [{ "path": "decision_notes", "message": "Notes are required when the opening differs from the implied sections." }]
  }
}
```

| Field | Rule |
|---|---|
| `code` | Stable, upper snake case. The frontend branches on `code`, never on `message` |
| `message` | Short English sentence for a person. May change wording |
| `details` | Only when there is something to show. For field problems it is a list of `{ path, message, code }`, where `code` is a short machine code (Zod's issue code such as `too_small`, or one of ours such as `taken`). `BYLAW_IN_USE` sends `{ related: { <kind>_count: n } }` instead. Absent otherwise |

A successful response never contains `error`. A `204` has no body.

## Codes in use

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Body or query does not match the route's schema. This includes any key the route does not expect (for example `userId`, `approvedBy`, a section count), and business checks on a valid body (missing notes, a flag for a component the course does not have, unknown course or term) |
| 400 | `INVALID_JSON` | The body is not valid JSON |
| 400 | `PAYLOAD_TOO_LARGE` | The JSON body is over 16 KB |
| 401 | `UNAUTHENTICATED` | No session cookie, or it is forged, expired, or points to a missing or deactivated account |
| 401 | `INVALID_CREDENTIALS` | Login with a wrong username or password. The same answer for both, so it does not reveal which accounts exist |
| 403 | `FORBIDDEN` | Signed in, but the role (read from the database) may not use the route. Also a student account that is not linked to a student row |
| 403 | `ACCOUNT_INACTIVE` | Login with the right password on a deactivated account |
| 404 | `NOT_FOUND` | No route matches the method and path, or the record a route asks for (for example a data gap id) does not exist |
| 404 | `STUDENT_NOT_FOUND` | Signup with a university ID that is not in `student` |
| 409 | `ALREADY_LINKED` | Signup for a student who already has an account |
| 409 | `USERNAME_TAKEN` | Signup with a username another account uses |
| 409 | `BYLAW_CODE_TAKEN` | Creating a bylaw with a code another bylaw uses |
| 409 | `BYLAW_IN_USE` | Deleting a bylaw that courses, programs, limits, grades, bands, plans or students still refer to. `details.related` counts them |
| 409 | `TERM_EXISTS` / `ACTIVE_TERM_EXISTS` / `TERM_IN_USE` | A term with that year and type exists / another term is already active / a used term's year or type cannot change |
| 409 | `STAFF_CODE_TAKEN` | Another account has that staff code |
| 409 | `SELF_DEACTIVATION` / `SELF_ROLE_CHANGE` | An admin tried to deactivate themselves or change their own role |
| 409 | `PRIORITY_TAKEN` / `CREDIT_LIMIT_IN_USE` | Another rule of the bylaw has that priority / a stored forecast used the rule |
| 409 | `COURSE_CODE_TAKEN` / `BYLAW_IMMUTABLE` | The bylaw already has that course code / a course cannot move to another bylaw |
| 409 | `PROGRAM_CODE_TAKEN` / `TRACK_CODE_TAKEN` | The bylaw or program already uses that code |
| 409 | `SLOT_POSITION_TAKEN` | The plan already has a slot at that year, term and position |
| 429 | `RATE_LIMITED` | More than 20 auth requests from one IP in 15 minutes |
| 501 | `NOT_AVAILABLE` | An admin action that needs a pipeline the app does not have yet (file ingestion for imports and snapshots) |
| 500 | `INTERNAL_ERROR` | An unexpected server error. The cause is logged on the server (stack only) and never sent to the client |

A new code is a contract change: add it to this table in the same pull request.

## Rules

- Do not log passwords, tokens, `Cookie`, `Authorization`, or request bodies.
- Do not put stack traces, SQL, or constraint names in `message` or `details`.
- Explanation-service failures (timeout, refusal, bad response) become one of the codes above, or a new code added here first. There is no second envelope for AI errors.
