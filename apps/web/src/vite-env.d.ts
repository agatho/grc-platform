/// <reference types="vite/client" />

// Needed so that `import.meta.glob(...)` resolves in our test files.
// Vitest reuses Vite's import-meta extensions for module discovery — the
// type definition ships under `vite/client`, which is otherwise not in the
// Next.js project's reference graph.
//
// [ARCTOS-FULL-2026-08-31 · OP-167] Der Kommentar nannte bis hierher die Form
// `import.meta.glob<T>(...)`. Sie ist seit Next 16.3 nicht mehr benutzbar:
// Next bringt eine eigene Deklaration von `import.meta.glob` mit, die KEIN
// Typargument nimmt, und die beiden Deklarationen stehen nebeneinander. Wer
// eines übergibt, bekommt `TS2558: Expected 0 type arguments, but got 1`.
// Die drei Aufrufstellen im Baum benutzen deshalb die typargumentfreie Form
// mit anschliessender Zusicherung; sie ist unter beiden Deklarationen gültig.
