import { readSession, requestToken } from "../booking/sessions";
import { BookingError } from "../booking/validation";
export async function orderGuest(request: Request) {
  const s = await readSession(requestToken(request));
  if (s?.kind !== "guest") throw new BookingError("UNAUTHORIZED", 401);
  return s;
}
