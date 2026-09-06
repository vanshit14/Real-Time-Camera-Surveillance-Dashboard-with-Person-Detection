import type { AuthUser } from "./auth";

export type AppEnv = {
  Variables: {
    user: AuthUser;
  };
};
