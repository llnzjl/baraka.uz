import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

if (!process.stdin.isTTY)
  throw new Error("Run this command in an interactive terminal.");
let hidden = false;
const output = new Writable({
  write(chunk, encoding, done) {
    if (!hidden) process.stdout.write(chunk, encoding);
    done();
  },
});
const input = createInterface({ input: process.stdin, output, terminal: true });
try {
  const username = (await input.question("Owner username: ")).trim();
  if (!/^[a-zA-Z0-9_.-]{3,100}$/.test(username))
    throw new Error(
      "Use 3–100 letters, numbers, dots, underscores or hyphens.",
    );
  process.stdout.write("Owner password (hidden): ");
  hidden = true;
  const password = await input.question("");
  process.stdout.write("\nRepeat password (hidden): ");
  const confirmation = await input.question("");
  hidden = false;
  process.stdout.write("\n");
  if (password.length < 7 || password.length > 256 || password !== confirmation)
    throw new Error("Passwords must match and contain 7–256 characters.");
  const salt = randomBytes(32).toString("hex");
  const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  const path = ".env.local";
  let contents = existsSync(path) ? readFileSync(path, "utf8") : "";
  for (const [key, value] of Object.entries({
    OWNER_USERNAME: username,
    OWNER_PASSWORD_HASH: hash,
  })) {
    const pattern = new RegExp(`^${key}=.*$`, "m");
    contents = pattern.test(contents)
      ? contents.replace(pattern, `${key}=${value}`)
      : `${contents}\n${key}=${value}\n`;
  }
  writeFileSync(path, contents, { mode: 0o600 });
  console.log(
    "Owner credentials saved as a salted hash in .env.local. Restart the server to apply.",
  );
} finally {
  input.close();
}
