import { defineManifest } from '@absolutejs/manifest';
import { Type } from '@sinclair/typebox';
import type { ScopedStateConfig } from './types';

/* The setup object IS the package's whole config and it is plain JSON
 * (initial values + preserve flags), so settings are drift-checked against
 * it directly. No tools: the store lives inside each visitor's session —
 * there is no cross-session instance an AI tool could honestly query. */
export const manifest = defineManifest<
	Record<string, ScopedStateConfig<unknown>>
>()({
	contract: 2,
	identity: {
		accent: '#14b8a6',
		category: 'infrastructure',
		description:
			'Per-visitor server-side state for Elysia: each request gets its own slice of `.state.scoped`, keyed by a secure session cookie set on first visit. Ideal for stateful HTMX interactions or any server data that should persist across a visitor’s requests. `preserve` flags survive store resets.',
		docsUrl: 'https://github.com/absolutejs/scoped-state',
		name: '@absolutejs/scoped-state',
		tagline: 'Remember things for each visitor between page loads.'
	},
	requires: {
		peers: [{ name: 'elysia', range: '>=1.3', reason: 'plugin host' }]
	},
	settings: Type.Record(
		Type.String(),
		Type.Object(
			{
				preserve: Type.Optional(
					Type.Boolean({
						description:
							'Keep this value when the store is reset (unless the reset forces everything).',
						title: 'Survive resets'
					})
				),
				value: Type.Unknown({
					description: 'The starting value each new visitor gets.',
					title: 'Initial value'
				})
			},
			{ title: 'State piece' }
		),
		{
			description:
				'The pieces of per-visitor state, each with an initial value.',
			title: 'State pieces'
		}
	),
	wiring: [
		{
			description:
				'Mount the plugin; read and write per-visitor values via the `scopedStore` context property, and reset with `resetScopedStore()`.',
			id: 'default',
			server: {
				code: '.use(scopedState(${settings}))',
				imports: [
					{ from: '@absolutejs/scoped-state', names: ['scopedState'] }
				],
				placement: 'server-plugin'
			},
			title: 'Add per-visitor state'
		}
	]
});
