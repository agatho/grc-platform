/// <reference types="vite/client" />

// Needed so that `import.meta.glob<T>(...)` resolves in our test files.
// Vitest reuses Vite's import-meta extensions for module discovery — the
// type definition ships under `vite/client`, which is otherwise not in the
// Next.js project's reference graph.
