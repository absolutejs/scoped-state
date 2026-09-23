import { describe, expect, test } from 'bun:test';
import { Elysia, t } from 'elysia';
import { SCOPED_STATE_COOKIE_NAME, scopedState } from '../src';

const AUTH_COOKIE_NAME = 'user_session_id';
const AUTH_SESSION_ID = 'auth-session-that-must-not-be-reused';

const createApp = () =>
	new Elysia()
		.guard({
			cookie: t.Cookie({
				user_session_id: t.Optional(t.String())
			}),
			schema: 'merge'
		})
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

test('nested reset values remain isolated between sessions', async () => {
	const app = new Elysia()
		.use([scopedState({ nested: { value: { count: 0 } } })])
		.get('/', ({ scopedStore }) => scopedStore.nested.count)
		.post('/increment', ({ scopedStore }) => ++scopedStore.nested.count)
		.post('/reset', ({ resetScopedStore }) => {
			resetScopedStore();

			return { ok: true };
		});
	const first = await app.handle(new Request('http://localhost/'));
	const second = await app.handle(new Request('http://localhost/'));
	const cookieA = first.headers.get('set-cookie')?.split(';')[0] ?? '';
	const cookieB = second.headers.get('set-cookie')?.split(';')[0] ?? '';
	expect(cookieA).not.toBe(cookieB);
	const request = (path: string, cookie: string, method = 'GET') =>
		app.handle(
			new Request(`http://localhost${  path}`, {
				headers: { cookie }, method
			})
		);
	await request('/increment', cookieA, 'POST');
	expect(await (await request('/', cookieB)).text()).toBe('0');
	await request('/reset', cookieA, 'POST');
	await request('/reset', cookieB, 'POST');
	await request('/increment', cookieA, 'POST');
	expect(await (await request('/', cookieB)).text()).toBe('0');
	expect(await (await request('/', cookieA)).text()).toBe('1');
});
