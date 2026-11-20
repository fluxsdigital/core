export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("Configure JWT_SECRET com pelo menos 32 bytes.");
  }
  return secret;
}

export function appOrigin() {
  const url = new URL(process.env.APP_ORIGIN ?? "http://127.0.0.1:3000");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("APP_ORIGIN precisa usar HTTPS em produção.");
  }
  return url.origin;
}
