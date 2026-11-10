import { jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import type { State } from '../src/model.ts';

export const appState = pgTable('star_sms_state', {
  key: text().primaryKey(),
  data: jsonb().$type<State>().notNull(),
});
