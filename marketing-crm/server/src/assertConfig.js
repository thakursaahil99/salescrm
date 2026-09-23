// Fail fast on a misconfigured secret instead of booting an app that anyone can
// forge admin tokens for. JWT_SECRET is what signs every session — if it's
// missing, still the code's own dev fallback, or too short to be a real
// random value, that's not a warning in production, it's a stop.
const PLACEHOLDERS = new Set(["dev-secret", "change-me", "change-this-to-a-long-random-string", "secret", "changeme"]);

export function assertConfig() {
  if (process.env.NODE_ENV !== "production") return;

  const secret = process.env.JWT_SECRET || "";
  const problems = [];

  if (!secret) problems.push("JWT_SECRET is not set.");
  else if (PLACEHOLDERS.has(secret.trim())) problems.push("JWT_SECRET is still a placeholder — generate a real one.");
  else if (secret.length < 32) problems.push(`JWT_SECRET is only ${secret.length} chars — use at least 32 (e.g. \`openssl rand -base64 48\`).`);

  if (!process.env.MONGODB_URI) problems.push("MONGODB_URI is not set.");

  if (problems.length) {
    const msg =
      "[config] Refusing to start:\n" +
      problems.map((p) => `  • ${p}`).join("\n") +
      "\n  Generate a secret with:  node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\"";
    throw new Error(msg);
  }
}
