// Checks req.body and/or the query string against Zod schemas and keeps only the cleaned values.
// Our schemas are strict, so an extra key the route does not expect (for example a
// userId or approvedBy sent by the browser) is refused with 400 instead of ignored.
//
// Usage: router.post("/path", validate({ body: schema }), handler)
//        router.get("/path", validate({ query: schema }), handler)
export function validate({ body, query }) {
  // The actual check that runs on each request.
  return (req, res, next) => {
    if (body) req.body = body.parse(req.body ?? {});
    // Express 5 does not let us overwrite req.query, so the cleaned copy goes here.
    if (query) req.validatedQuery = query.parse(req.query);
    next();
  };
}
