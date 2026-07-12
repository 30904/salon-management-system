import { sendSuccess } from "../utils/apiResponse.js";
import { getMyEarnings } from "../services/staffEarningsService.js";

export async function getMyEarningsHandler(req, res) {
  const data = await getMyEarnings(req.user._id, req.query);

  return sendSuccess(res, {
    data,
    message: "Staff earnings fetched",
  });
}
