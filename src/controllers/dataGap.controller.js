import {
  dataGapsSummary,
  listDataGaps,
} from "../services/adminDataGaps.service.js";

// GET /api/data-gaps: the data-gap register for coordinators, read only. Same rows and
// filters as the admin list, plus the open and resolved totals for the page header.
export async function getCoordinatorDataGaps(req, res) {
  const [list, summary] = await Promise.all([
    listDataGaps(req.validatedQuery),
    dataGapsSummary(),
  ]);
  res.json({
    ...list,
    open_count: summary.open,
    resolved_count: summary.resolved,
  });
}
