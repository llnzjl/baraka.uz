import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { database, transaction } from "./db";
import { BookingError } from "./validation";

export const sessionCookie = "baraka_session";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
type OwnerCredentials = {
  username: string;
  password_salt: string;
  password_hash: string;
  credential_version: string;
};
async function ownerCredentials(): Promise<OwnerCredentials> {
  let row = (await database().query(
    "SELECT username,password_salt,password_hash,credential_version::text FROM booking.owner_credentials WHERE id=1",
  )).rows[0] as OwnerCredentials | undefined;
  if (!row) {
    const username = process.env.OWNER_USERNAME || "";
    const [salt, hash] = (process.env.OWNER_PASSWORD_HASH || "").split(":");
    if (!/^[A-Za-z0-9_.-]{3,100}$/.test(username) || !/^[a-f0-9]{64}$/.test(salt || "") || !/^[a-f0-9]{128}$/.test(hash || ""))
      throw new BookingError("UNAVAILABLE", 503);
    await database().query(
      "INSERT INTO booking.owner_credentials(id,username,password_salt,password_hash) VALUES(1,$1,$2,$3) ON CONFLICT(id) DO NOTHING",
      [username, salt, hash],
    );
    row = (await database().query(
      "SELECT username,password_salt,password_hash,credential_version::text FROM booking.owner_credentials WHERE id=1",
    )).rows[0] as OwnerCredentials | undefined;
  }
  if (!row) throw new BookingError("UNAVAILABLE", 503);
  return row;
}
export async function currentOwnerEmail(connection?: Pick<import("pg").PoolClient, "query">) {
  const query = connection || database();
  const stored = (await query.query("SELECT owner_email FROM booking.owner_credentials WHERE id=1")).rows[0]?.owner_email as string | null | undefined;
  return stored?.trim() || process.env.OWNER_EMAIL?.trim() || "";
}
export async function credentialVersion() {
  return (await ownerCredentials()).credential_version;
}
export type EntrySession = {
  id: string;
  kind: "owner" | "guest";
  guest_number: string;
  token_hash: string;
  display_name: string;
};
export async function verifyOwner(username: string, password: string) {
  const row = await ownerCredentials();
  const actual = (await promisify(scrypt)(password, row.password_salt, 64)) as Buffer;
  return (
    timingSafeEqual(actual, Buffer.from(row.password_hash, "hex")) &&
    username === row.username
  );
}
export async function readSession(
  token?: string,
): Promise<EntrySession | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const r = await database().query(
    "SELECT * FROM booking.entry_sessions WHERE token_hash=$1 AND expires_at>now() AND (kind='guest' OR credential_version=(SELECT credential_version::text FROM booking.owner_credentials WHERE id=1))",
    [digest(token)],
  );
  return r.rows[0] || null;
}
export function requestToken(request: Request) {
  if (process.env.BARAKA_EDGE === "true") {
    const bearer = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (bearer) return bearer;
  }
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${sessionCookie}=`))
    ?.slice(sessionCookie.length + 1);
}
export async function newSession(kind: "guest" | "owner", oldToken?: string) {
  const token = randomBytes(32).toString("hex");
  const currentVersion = kind === "owner" ? await credentialVersion() : null;
  const row = await transaction(async (c) => {
    await c.query(
      "SELECT id FROM booking.restaurant_config WHERE id=1 FOR UPDATE",
    );
    if (oldToken)
      await c.query("DELETE FROM booking.entry_sessions WHERE token_hash=$1", [
        digest(oldToken),
      ]);
    return (
      await c.query(
        "INSERT INTO booking.entry_sessions(token_hash,kind,expires_at,credential_version,guest_number) VALUES($1,$2,now()+interval '8 hours',$3,CASE WHEN $2='guest' THEN nextval('booking.entry_sessions_guest_number_seq') ELSE NULL END) RETURNING *",
        [digest(token), kind, currentVersion],
      )
    ).rows[0];
  });
  return { token, session: row as EntrySession };
}
/** Change the password from the authenticated owner profile after verifying
 * the current password. The current session is rebound to the new credential
 * version; all other owner sessions are invalidated by the version bump. */
export async function changeOwnerPasswordFromSession(sessionId: string, currentPassword: string, password: string) {
  return transaction(async (c) => {
    await c.query("SELECT id FROM booking.restaurant_config WHERE id=1 FOR UPDATE");
    const session = (await c.query(
      "SELECT id FROM booking.entry_sessions WHERE id=$1 AND kind='owner' AND expires_at>now() FOR UPDATE",
      [sessionId],
    )).rows[0];
    if (!session) throw new BookingError("UNAUTHORIZED", 401);
    const row = (await c.query(
      "SELECT password_salt,password_hash,credential_version::text FROM booking.owner_credentials WHERE id=1 FOR UPDATE",
    )).rows[0] as { password_salt: string; password_hash: string; credential_version: string } | undefined;
    if (!row) throw new BookingError("UNAVAILABLE", 503);
    const currentHash = (await promisify(scrypt)(currentPassword, row.password_salt, 64)) as Buffer;
    const expectedHash = Buffer.from(row.password_hash, "hex");
    if (currentHash.length !== expectedHash.length || !timingSafeEqual(currentHash, expectedHash))
      throw new BookingError("INVALID_LOGIN", 401);
    const salt = randomBytes(32).toString("hex");
    const hash = ((await promisify(scrypt)(password, salt, 64)) as Buffer).toString("hex");
    const updated = (await c.query(
      "UPDATE booking.owner_credentials SET password_salt=$1,password_hash=$2,credential_version=credential_version+1,updated_at=now() WHERE id=1 RETURNING credential_version::text",
      [salt, hash],
    )).rows[0] as { credential_version: string };
    await c.query("UPDATE booking.entry_sessions SET credential_version=$1 WHERE id=$2", [updated.credential_version, sessionId]);
    await c.query("INSERT INTO booking.audit_log(actor,action) VALUES($1,$2)", [sessionId, "owner password changed from profile"]);
    return updated;
  });
}

export async function updateOwnerProfileFromSession(input: {
  sessionId: string;
  username: string;
  name: string;
  phone: string;
}) {
  return transaction(async (c) => {
    await c.query("SELECT id FROM booking.restaurant_config WHERE id=1 FOR UPDATE");
    const session = (await c.query(
      "SELECT id FROM booking.entry_sessions WHERE id=$1 AND kind='owner' AND expires_at>now() FOR UPDATE",
      [input.sessionId],
    )).rows[0];
    if (!session) throw new BookingError("UNAUTHORIZED", 401);
    const updated = (await c.query(
      "UPDATE booking.owner_credentials SET username=$1,owner_name=$2,owner_phone=$3,credential_version=credential_version+1,updated_at=now() WHERE id=1 RETURNING username,owner_name,owner_phone,credential_version::text",
      [input.username, input.name, input.phone || null],
    )).rows[0] as { username: string; owner_name: string; owner_phone: string | null; credential_version: string } | undefined;
    if (!updated) throw new BookingError("UNAVAILABLE", 503);
    await c.query("UPDATE booking.entry_sessions SET credential_version=$1 WHERE id=$2", [updated.credential_version, input.sessionId]);
    await c.query("INSERT INTO booking.audit_log(actor,action) VALUES($1,$2)", [input.sessionId, "owner profile updated"]);
    return updated;
  });
}
export async function endSession(token?: string) {
  if (!token) return;
  await transaction(async (c) => {
    await c.query(
      "SELECT id FROM booking.restaurant_config WHERE id=1 FOR UPDATE",
    );
    await c.query("DELETE FROM booking.entry_sessions WHERE token_hash=$1", [
      digest(token),
    ]);
  });
}
