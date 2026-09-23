import { Router } from "express";
import Lead from "../models/Lead.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { buildLeadFilter } from "../utils/leadScope.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { slicer, month } = req.query;
    const filter = buildLeadFilter(req.user, { slicer, month });
    const leads = await Lead.find(filter).lean();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let total = 0, todayCount = 0, monthCount = 0, agreements = 0, dropped = 0;
    const stageStats = {};
    const teamStats = {};
    const typeStats = {};
    const monthData = {};

    for (const l of leads) {
      const d = l.timestamp ? new Date(l.timestamp) : null;
      const stage = l.stage || "";
      const ct = l.clientType || "Other";

      total++;
      if (d && d >= today) todayCount++;
      if (d && d >= monthStart) monthCount++;
      if (stage === "6.Agreement Done") agreements++;
      if (stage === "Dropped") dropped++;

      stageStats[stage] = (stageStats[stage] || 0) + 1;

      if (!teamStats[l.leadHead]) teamStats[l.leadHead] = { total: 0, byStage: {} };
      teamStats[l.leadHead].total++;
      teamStats[l.leadHead].byStage[stage] = (teamStats[l.leadHead].byStage[stage] || 0) + 1;

      typeStats[ct] = (typeStats[ct] || 0) + 1;

      if (d) {
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthData[ym] = (monthData[ym] || 0) + 1;
      }
    }

    const monthTrend = Object.keys(monthData)
      .sort()
      .map((key) => {
        const [y, m] = key.split("-").map(Number);
        return {
          key,
          label: new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short", year: "numeric" }),
          count: monthData[key],
        };
      });

    res.json({
      ok: true,
      totalLeads: total,
      todayLeads: todayCount,
      monthLeads: monthCount,
      agreements,
      dropped,
      stageStats,
      teamStats,
      typeStats,
      monthTrend,
    });
  })
);

export default router;
