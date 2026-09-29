import { asyncHandler } from "../utils/asyncHandler.js";
import { paginate } from "../utils/paginate.js";
import Remark from "../models/Remark.js";
import IfoConversion from "../models/IfoConversion.js";
import { dateRangeFilter } from "../utils/dateRange.js";

// Admin/manager-only oversight: not a new log of its own, but a lens onto
// records the app already writes — undoLeadStatus() and deleteIfo() both
// leave a permanent Remark behind (see leadController.js / ifoController.js),
// and a conversion recorded with ₹0 received is just an IfoConversion row
// where amountReceived is still 0. Matched by the exact text those two
// controllers write — stable because this file owns both strings.
const REVERSAL_TEXT = { $or: [{ text: /^Stage change undone/ }, { text: /^Conversion deleted/ }] };

// @route GET /api/audit/reversals   (admin, manager)   ?from &to &by
// Every stage-move undo and every manager's conversion reversal — who did
// it, when, and on which lead — so a pattern of someone routinely
// backing out changes doesn't go unnoticed.
export const listReversals = asyncHandler(async (req, res) => {
  const filter = { ...REVERSAL_TEXT, ...dateRangeFilter("createdAt", req.query.from, req.query.to) };
  if (req.query.by) filter.author = req.query.by;

  const result = await paginate(Remark, filter, {
    query: req.query,
    sort: "-createdAt",
    populate: [
      {
        path: "lead",
        select: "name restaurantName assignedTo",
        populate: { path: "assignedTo", select: "name" },
      },
      { path: "author", select: "name role" },
    ],
  });
  res.json(result);
});

// @route GET /api/audit/mistakes   (admin, manager)   ?from &to
// Conversions sitting at ₹0 received — either genuinely nothing collected
// yet (fine, common right after a sale) or the salesperson forgot to log
// the actual payment while recording the conversion (a real mistake).
// Surfaced for a manager to check, not auto-flagged as wrong either way.
export const listMistakes = asyncHandler(async (req, res) => {
  const filter = { amountReceived: 0, ...dateRangeFilter("conversionDate", req.query.from, req.query.to) };

  const result = await paginate(IfoConversion, filter, {
    query: req.query,
    sort: "-conversionDate",
    select: "-payments",
    populate: [
      { path: "lead", select: "name restaurantName phone" },
      { path: "convertedBy", select: "name" },
    ],
  });
  res.json(result);
});
