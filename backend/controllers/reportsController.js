import { getOwnerReports, getTeamToday } from "../services/reportsService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function getOwnerReportsHandler(req, res) {
  const month = req.query.month ? Number(req.query.month) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;

  const data = await getOwnerReports({ month, year });

  return sendSuccess(res, {
    data,
    message: `Owner reports for ${data.period.label} generated`,
  });
}

export async function getTeamTodayHandler(req, res) {
  const data = await getTeamToday();

  return sendSuccess(res, {
    data,
    message: "Team sales today generated",
  });
}
