import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { initialState, type State } from '../src/model.ts';
import { appState } from './schema.ts';

type Update = (state: State) => void;
export type Store = {
  read(): Promise<State>;
  update(change: Update): Promise<void>;
};

export function createStore(databaseUrl?: string, file?: string): Store {
  if (databaseUrl) {
    const db = drizzle(databaseUrl);
    return {
      async read() {
        const [row] = await db.select().from(appState).where(eq(appState.key, 'demo'));
        return row?.data ?? initialState();
      },
      async update(change) {
        await db.transaction(async tx => {
          await tx.insert(appState).values({ key: 'demo', data: initialState() }).onConflictDoNothing();
          const [row] = await tx.select().from(appState).where(eq(appState.key, 'demo')).for('update');
          change(row.data);
          await tx.update(appState).set({ data: row.data }).where(eq(appState.key, 'demo'));
        });
      },
    };
  }

  let state = initialState();
  const ready = file ? readFile(file, 'utf8').then(contents => {
    state = JSON.parse(contents) as State;
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  }) : Promise.resolve();
  let pending = ready;

  return {
    async read() {
      await pending;
      await ready;
      return structuredClone(state);
    },
    update(change) {
      const operation = pending.then(async () => {
        await ready;
        const next = structuredClone(state);
        change(next);
        if (file) {
          await mkdir(dirname(file), { recursive: true });
          const temporary = file + '.' + randomUUID() + '.tmp';
          await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
          await rename(temporary, file);
        }
        state = next;
      });
      pending = operation.catch(() => {});
      return operation;
    },
  };
}
