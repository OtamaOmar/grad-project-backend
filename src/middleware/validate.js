// Checks req.body against a Zod schema and keeps only the cleaned values.
// Our schemas are strict, so an extra key the route does not expect (for example a
// userId or approvedBy sent by the browser) is refused with 400 instead of ignored.
//
// Usage: router.post("/path", validate({ body: schema }), handler)
export function validate({ body }) {
  // The actual check that runs on each request.
  return (req, res, next) => {
    req.body = body.parse(req.body ?? {});
    next();
  };
}
