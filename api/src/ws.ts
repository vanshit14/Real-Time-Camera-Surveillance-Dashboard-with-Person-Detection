import { createBunWebSocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import { verifyToken, AuthUser } from "./auth";

export const { upgradeWebSocket, websocket } = createBunWebSocket();

const clients = new Map<string, Set<WSContext>>();

export function wsHandler() {
  return upgradeWebSocket((c) => {
    const token = c.req.query("token");
    let user: AuthUser | null = null;
    return {
      async onOpen(_, ws) {
        try {
          if (!token) throw new Error("Missing token");
          user = await verifyToken(token);
          const bucket = clients.get(user.id) ?? new Set<WSContext>();
          bucket.add(ws);
          clients.set(user.id, bucket);
          ws.send(JSON.stringify({ type: "connected", payload: { userId: user.id } }));
        } catch {
          ws.close(1008, "Unauthorized");
        }
      },
      onClose(_, ws) {
        if (user) clients.get(user.id)?.delete(ws);
      },
      onError(_, ws) {
        if (user) clients.get(user.id)?.delete(ws);
      }
    };
  });
}

export function broadcast(userId: string, type: string, payload: unknown) {
  const message = JSON.stringify({ type, payload });
  for (const ws of clients.get(userId) ?? []) {
    ws.send(message);
  }
}
