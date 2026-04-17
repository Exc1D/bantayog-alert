# Coding Style Rules

Based on Google TypeScript Style Guide and industry best practices.

## TypeScript/JavaScript

### File Basics

- Files use UTF-8 encoding
- Use `.ts` for TypeScript, `.tsx` for React TypeScript files
- One component per file (React)
- Use kebab-case or camelCase for file names (match project convention)

### Formatting

- 2 spaces for indentation (no tabs)
- Column limit: 80 characters (soft limit: 100 for JSX)
- Use `clang-format` or project formatter
- Trailing commas in multi-line literals

### Braces (K&R Style)

```ts
// No line break before opening brace
if (condition) {
  doSomething()
}

// Empty blocks may be concise
if (condition) {
} else {
}
```

### Whitespace

- One blank line between imports and implementation
- Single blank line between consecutive methods in classes
- No trailing whitespace
- Space after (not before) commas and semicolons
- Space before opening brace

### Variables

- Use `const` by default, `let` only when reassignment needed
- Never use `var`
- One variable per declaration
- Declare variables close to first use

### Naming

- Classes/Interfaces/Types/Enums: `UpperCamelCase`
- Functions/Methods/Variables: `lowerCamelCase`
- Constants: `UPPER_SNAKE_CASE`
- React Components: `UpperCamelCase` (file: `UserProfile.tsx`)
- Hooks: `camelCase` starting with `use` (e.g., `useAuthState`)
- Private members: prefix with underscore or use `private` keyword
- File names: kebab-case (e.g., `user-profile.tsx`, `api-utils.ts`)

### Imports

- Use named exports, avoid default exports
- Use `import type` for type-only imports
- Group imports: external → internal → relative
- Use namespace imports (`import * as`) sparingly
- Sort imports alphabetically within groups

## TypeScript

### Type Safety

- Use strict TypeScript (`strict: true` in tsconfig)
- Never use `any` — use `unknown` instead
- Prefer `type` over `interface` for simple type aliases
- Use `interface` for object shapes that may be extended
- Use explicit return types for public functions

### Example

```typescript
// CORRECT: Explicit types
function processUser(user: User): Result<User> {
  // ...
}

// AVOID: any
function processUser(user: any): any {
  // NEVER
  // ...
}

// Use unknown for truly unknown data
async function parseResponse(response: unknown): Promise<ParsedData> {
  // validate before using
}
```

### Type Assertion

```typescript
// CORRECT: Safe assertion with validation
const data = result as KnownType

// CORRECT: Use unknown for API responses
async function fetchUser(id: string): Promise<unknown> {
  const response = await fetch(`/api/users/${id}`)
  return response.json()
}

// NEVER: Blind casting
const user = (response as any).data.user
```

## React Components

### Component Structure

```typescript
// 1. Imports (external, then internal)
// 2. Types/Interfaces
// 3. Component function
// 4. Helper functions (if not exported)

interface Props {
  userId: string;
}

export function UserProfile({ userId }: Props) {
  // 1. Hooks first
  const { data, loading } = useUser(userId);

  // 2. Early returns
  if (loading) return <Skeleton />;
  if (!data) return <NotFound />;

  // 3. Render
  return (
    <div>
      <h1>{data.name}</h1>
    </div>
  );
}
```

### Hooks Rules

- Call hooks at top level only (no conditionals)
- Custom hooks must start with `use`
- Extract complex logic to custom hooks
- Keep hooks focused (split large hooks)

### State Management

- Prefer local state (`useState`) for component-specific state
- Use React Context for shared state
- Use Zustand/Redux for complex global state
- Co-locate state with its usage

### Performance

- Memoize expensive computations: `useMemo`
- Memoize callbacks passed to children: `useCallback`
- Use `React.lazy` for code splitting
- Avoid inline object/array literals in JSX props

```typescript
// CORRECT: Stable callback reference
const handleClick = useCallback(() => {
  onAction(id);
}, [id, onAction]);

// AVOID: New function each render
<Button onClick={() => onAction(id)} />
```

## Async/Await

### Rules

- Always handle errors in async functions
- Use `try/catch` for error handling
- Avoid async in useEffect (handle cleanup)
- Use `Promise.all` for parallel operations

### Example

```typescript
// CORRECT: Proper async handling
async function fetchData(): Promise<Data> {
  try {
    const response = await api.getData()
    return response.data
  } catch (error) {
    console.error('Failed to fetch:', error)
    throw new DataFetchError('Failed to fetch data')
  }
}

// CORRECT: Parallel requests
const [users, posts] = await Promise.all([fetchUsers(), fetchPosts()])

// CORRECT: Async useEffect with cleanup
useEffect(() => {
  let cancelled = false

  async function load() {
    const data = await fetchData()
    if (!cancelled) setData(data)
  }

  load()

  return () => {
    cancelled = true
  }
}, [])
```

## Error Handling

### Rules

- Use typed errors where possible
- Never swallow errors silently
- Create custom error classes for domain errors
- Handle errors at component boundaries

### Custom Errors

```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`)
    this.name = 'NotFoundError'
  }
}
```

## CSS/Styling

### Rules

- Use CSS Modules, Tailwind, or styled-components (pick one)
- Follow existing project's styling approach
- Use CSS custom properties for theme values
- Avoid inline styles except for dynamic values
- Keep styles co-located with components

### Naming (CSS Modules)

```css
/* ComponentName.module.css */
.container {
}
.headerTitle {
}
.contentHidden {
}
```

## Accessibility (a11y)

### Requirements

- All interactive elements must be keyboard accessible
- Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- Provide alt text for images
- Ensure color contrast ratio ≥ 4.5:1
- Use `aria-label` when text is insufficient
- Focus management for modals/dialogs

### Examples

```tsx
// CORRECT: Accessible button
<button onClick={handleSubmit} disabled={isLoading}>
  {isLoading ? 'Submitting...' : 'Submit'}
</button>

// CORRECT: Image alt text
<img src={user.avatar} alt={`${user.name}'s profile picture`} />

// CORRECT: Form labels
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// CORRECT: Icon button accessibility
<button
  aria-label="Close dialog"
  onClick={onClose}
>
  <Icon name="close" />
</button>
```

## File Organization

### Project Structure

```
src/
├── domains/           # Feature domains
│   └── {feature}/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       └── types/
├── shared/            # Shared code
│   ├── components/    # Reusable UI components
│   ├── hooks/         # Shared hooks
│   ├── utils/         # Utilities
│   └── types/         # Shared types
├── app/               # App shell, routing
└── main.tsx           # Entry point
```

### Barrel Exports (index.ts)

```typescript
// Use barrel exports for public API
export { UserProfile } from './UserProfile'
export { useUser } from './hooks/useUser'
export type { User, UserRole } from './types'

// AVOID: Re-export everything
export * from './everything'
```
