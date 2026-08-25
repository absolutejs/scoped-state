import { Elysia, t } from 'elysia';
import { Prettify } from 'elysia/types';
import { ScopedRecord, ScopedStateConfig, ValueOnly } from './types';

export const SCOPED_STATE_COOKIE_NAME = 'absolute_scoped_state_id';

export const scopedState = <
	Setup extends Record<string, ScopedStateConfig<unknown>>
>(
	setup: Setup
) => {
	const initialState = Object.fromEntries(
		Object.entries(setup).map(([key, entry]) => [key, entry.value])
	);

	const initialRecord: ScopedRecord<Prettify<ValueOnly<Setup>>> = {};

	return new Elysia({ name: 'scoped-state' })
		.state({ scoped: initialRecord })
		.guard({
			cookie: t.Cookie({
				absolute_scoped_state_id: t.Optional(t.String())
			}),
			schema: 'merge'
		})
		.derive(
			({
				store: { scoped },
				cookie: { absolute_scoped_state_id },
				status
			}) => {
				if (absolute_scoped_state_id === undefined) {
					return status('Bad Request', 'Cookies not set properly');
				}

				// The user session doesnt exist yet, so we create it.
				// Clone `initialState` per session — without this, every
				// new session is assigned the SAME `initialState`
				// reference, so one user's mutations to `scopedStore.x`
				// are visible to every other session that hasn't
				// already created its own object yet. Reads from a
				// freshly-cookied user return whatever the previous
				// active session last wrote.
				const cookieValue = absolute_scoped_state_id.value;
				let sessionId: string;
				if (typeof cookieValue !== 'string') {
					sessionId = crypto.randomUUID();
					absolute_scoped_state_id.value = sessionId;
					// @ts-expect-error - Object.entries loses type inference because of the `unknown` type
					scoped[sessionId] = structuredClone(initialState);
				} else sessionId = cookieValue;

				// The server got reset but the user session cookie still exists, so we reset the scoped state
				if (scoped[sessionId] === undefined) {
					// @ts-expect-error - Object.entries loses type inference because of the `unknown` type
					scoped[sessionId] = structuredClone(initialState);
				}

				const scopedStore = scoped[sessionId];

				if (scopedStore === undefined)
					return status(
						'Internal Server Error',
						'Scoped store not found'
					);

				return {
					scopedStore,
					resetScopedStore: (ignorePreserve?: boolean) => {
						for (const key in setup) {
							const entry = setup[key];
							if (entry === undefined) {
								throw new Error(
									`Scoped setup is missing for key "${key}".`
								);
							}
							if (!ignorePreserve && entry.preserve) continue;
							scopedStore[key] = entry.value;
						}
					}
				};
			}
		)
		.as('global');
};
