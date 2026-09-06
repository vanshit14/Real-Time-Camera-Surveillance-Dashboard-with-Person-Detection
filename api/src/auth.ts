import { Context, MiddlewareHandler } from "hono";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { config } from "./config";

const secret = new TextEncoder().encode(config.jwtSecret);

export type AuthUser = {
  id: string;
  username: string;
};

export const authSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(6).max(256)
});

export async function signToken(user: AuthUser) {
  return new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<AuthUser> {
  const verified = await jwtVerify(token, secret);
  const id = verified.payload.sub;
  const username = verified.payload.username;
  if (!id || typeof username !== "string") throw new Error("Invalid token");
  return { id, username };
}

export const authMiddleware: MiddlewareHandler<{ Variables: { user: AuthUser } }> = async (c, next) => {
  const header = c.req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) return c.json({ error: "Missing bearer token" }, 401);
  try {
    c.set("user", await verifyToken(token));
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
};

export function getUser(c: Context<{ Variables: { user: AuthUser } }>) {
  return c.get("user");
}
