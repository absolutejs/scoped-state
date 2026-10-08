import { Elysia, t } from 'elysia';
import type { Prettify } from 'elysia/types';
import type { ScopedStateConfig, ValueOnly } from './types';

export const SCOPED_STATE_COOKIE_NAME = 'absolute_scoped_state_id';

export const scopedState = <
	Setup extends Record<string, ScopedStateConfig<unknown>>
>(
	setup: Setup
) => {
	// Mapping every setup key to its value preserves exactly this mapped type.
	const initialState = Object.fromEntries(
		Object.entries(setup).map(([key, entry]) => [key, entry.value])
	);
 const matchesSetup = (values: Record<string, unknown>): values is Prettify<ValueOnly<Setup>> => Object.entries(setup).every(([key, entry]) => Object.hasOwn(values, key) && values[key] === entry.value);
 if (!matchesSetup(initialState)) throw new Error('Scoped state initialization does not match its setup');
	// Keep mutable session data outside Elysia's request-local state cloning.
	const sessions = new Map<string, Prettify<ValueOnly<Setup>>>();

	return new Elysia({ name: 'scoped-state' })
		.guard('global', {
			cookie: t.Cookie({
				absolute_scoped_state_id: t.Optional(t.String())
			}),
			schema: 'merge'
		})
		.derive(
			'global',
			({ cookie: { absolute_scoped_state_id }, status }) => {
				if (!absolute_scoped_state_id)
					return status('Bad Request', 'Cookies not set properly');
				let sessionId = absolute_scoped_state_id.value;
				if (typeof sessionId !== 'string' || !sessions.has(sessionId)) {
					sessionId = crypto.randomUUID();
					absolute_scoped_state_id.value = sessionId;
					sessions.set(sessionId, structuredClone(initialState));
				}
				const scopedStore = sessions.get(sessionId);
				if (!scopedStore)
					return status(
						'Internal Server Error',
						'Scoped store not found'
					);

				return {
					scopedStore,
					resetScopedStore: (ignorePreserve?: boolean) => {
						for (const key in setup) {
							const entry = setup[key];
							if (!entry || (!ignorePreserve && entry.preserve))
								continue;
							scopedStore[key] = structuredClone(entry.value);
						}
					}
				};
			}
		);
};
