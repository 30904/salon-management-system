import { getMyCalendar } from "../services/staffCalendarService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function getMyCalendarHandler(req, res) {
  const data = await getMyCalendar(req.user._id, req.query);

  return sendSuccess(res, {
    data,
    message: "Staff calendar fetched",
  });
}
