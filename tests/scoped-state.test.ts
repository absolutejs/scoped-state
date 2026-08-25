import { describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { SCOPED_STATE_COOKIE_NAME, scopedState } from '../src';

const AUTH_COOKIE_NAME = 'user_session_id';
const AUTH_SESSION_ID = 'auth-session-that-must-not-be-reused';

const createApp = () =>
	new Elysia()
		.use(scopedState({ count: { value: 0 } }))
		.get('/count', ({ scopedStore }) => scopedStore.count)
		.post('/increment', ({ scopedStore }) => ++scopedStore.count);

describe('scopedState', () => {
	test('uses a dedicated cookie and preserves state beside an auth session', async () => {
		const app = createApp();
		const firstResponse = await app.handle(
			new Request('http://localhost/count', {
				headers: { cookie: `${AUTH_COOKIE_NAME}=${AUTH_SESSION_ID}` }
			})
		);

		expect(await firstResponse.text()).toBe('0');

		const setCookie = firstResponse.headers.get('set-cookie');
		expect(setCookie).toContain(`${SCOPED_STATE_COOKIE_NAME}=`);
		expect(setCookie).not.toContain(`${AUTH_COOKIE_NAME}=`);

		const scopedSessionId = setCookie?.match(
			new RegExp(`${SCOPED_STATE_COOKIE_NAME}=([^;]+)`)
		)?.[1];
		expect(scopedSessionId).toBeDefined();

		const cookie = `${AUTH_COOKIE_NAME}=${AUTH_SESSION_ID}; ${SCOPED_STATE_COOKIE_NAME}=${scopedSessionId}`;
		const incrementResponse = await app.handle(
			new Request('http://localhost/increment', {
				headers: { cookie },
				method: 'POST'
			})
		);
		expect(await incrementResponse.text()).toBe('1');

		const countResponse = await app.handle(
			new Request('http://localhost/count', { headers: { cookie } })
		);
		expect(await countResponse.text()).toBe('1');
	});
});
