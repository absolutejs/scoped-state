# @absolutejs/scoped-state

## Elysia Scoped State is a plugin that provides per-user-session server-side state management in Elysia, letting you store and retrieve data tied to individual users. It’s especially useful for powering stateful HTMX interactions, but can be used for any server-side data you need to persist across requests.

## Installation

```bash
# Bun
bun add @absolutejs/scoped-state

# npm
npm install @absolutejs/scoped-state

# pnpm
pnpm add @absolutejs/scoped-state

# Yarn
yarn add @absolutejs/scoped-state
```

---

## Key Features

- **Per-user scoped store**  
  Each request is mapped to its own slice of the shared `.state.scoped` object, keyed by a secure `user_session_id` cookie set automatically on first visit.

---

## API

| Function / Property                          | Description                                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `scopedState(setup)`                         | Creates the plugin. `setup` is an object where keys are pieces of state and values are `{ value: T; preserve?: boolean }`. |
| `scopedStore`                                | Derived context property containing the state you defined. Access any value via `scopedStore.<yourKey>`.                   |
| `resetScopedStore(ignorePreserve?: boolean)` | Available in derived context; resets the caller’s store (pass `true` to ignore all `preserve` flags).                      |

---

## Example

```ts
import { Elysia } from 'elysia';
import { scopedState } from '@absolutejs/scoped-state';

export const server = new Elysia()
	.use(
		scopedState({
			count: { value: 0 },
			userData: { value: {}, preserve: true }
		})
	)
	.get('/', () => Bun.file('./build/pages/example.html'))
	.post('/api/reset?force', ({ resetScopedStore, query: { force } }) =>
		resetScopedStore(
			force !== undefined && force !== 'false' && force !== '0'
		)
	)
	.get('/api/count', ({ scopedStore }) => scopedStore.count)
	.post('/api/increment', ({ scopedStore }) => ++scopedStore.count)
	.listen({ port: 3000 }, () => {
		console.log('Server is running on http://localhost:3000');
	});
```

---

## License

MIT – see [`LICENSE`](./LICENSE) for details.
