import { createTRPCRouter } from "./init";
import { collectionsRouter } from "./routers/collections";
import { environmentsRouter } from "./routers/environments";
import { historyRouter } from "./routers/history";
import { settingsRouter } from "./routers/settings";
import { userRouter } from "./routers/user";

export const appRouter = createTRPCRouter({
  user: userRouter,
  history: historyRouter,
  settings: settingsRouter,
  collections: collectionsRouter,
  environments: environmentsRouter,
});

export type AppRouter = typeof appRouter;
