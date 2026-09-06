import { zValidator } from "@hono/zod-validator";
import { hash, verify } from "@node-rs/argon2";
import { Hono } from "hono";
import { authSchema, signToken } from "../auth";
import { createUser, findUserByUsername } from "../repositories/user-repository";

export const authRoutes = new Hono();

authRoutes.post("/signup", zValidator("json", authSchema), async (c) => {
  const body = c.req.valid("json");
  const passwordHash = await hash(body.password);
  try {
    const user = await createUser(body.username, passwordHash);
    return c.json({ token: await signToken(user), user }, 201);
  } catch (error: any) {
    if (error?.code === "23505") return c.json({ error: "Username already exists" }, 409);
    throw error;
  }
});

authRoutes.post("/login", zValidator("json", authSchema), async (c) => {
  const body = c.req.valid("json");
  const user = await findUserByUsername(body.username);
  if (!user || !(await verify(user.password_hash, body.password))) return c.json({ error: "Invalid username or password" }, 401);
  return c.json({ token: await signToken({ id: user.id, username: user.username }), user: { id: user.id, username: user.username } });
});
