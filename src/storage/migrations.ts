// Migration functions. Each migrates from (version - 1) to `version`.
// V1: no migrations yet. Future migrations must be pure and tested.

import type { PersistedState } from './schema';

export function migrate(state: PersistedState): PersistedState {
  // For V1 this is a no-op; the shape is already current.
  // Future:
  //   if (state.schemaVersion === 0) return migrateV0toV1(state);
  //   if (state.schemaVersion === 1) return migrateV1toV2(state);
  //   ...
  //   throw new Error(`Unsupported schemaVersion ${state.schemaVersion}`);
  return state;
}
