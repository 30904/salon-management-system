import { getDashboardForUser } from "../services/dashboardService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function getDashboardHandler(req, res) {
  const dashboard = await getDashboardForUser(req.user, req.permissions || []);

  return sendSuccess(res, {
    data: dashboard,
    message: "Dashboard summary fetched",
  });
}
