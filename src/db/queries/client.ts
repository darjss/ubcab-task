import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "~/db/schema";

export type QueryClient = NodePgDatabase<typeof schema>;
