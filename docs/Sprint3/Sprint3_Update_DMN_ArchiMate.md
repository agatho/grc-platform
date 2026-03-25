## Sprint 3 Update: Add DMN and ArchiMate to process_notation enum

Two additional notations need to be registered in the database and code. They are NOT active in Sprint 3 UI — only BPMN is usable. The enum values are added now for Phase 2 readiness so no future ALTER TYPE migration is needed.

### 1. Database Migration

Create a new migration `056_add_notation_enum_values.sql`:

```sql
ALTER TYPE process_notation ADD VALUE IF NOT EXISTS 'dmn';
ALTER TYPE process_notation ADD VALUE IF NOT EXISTS 'archimate';
```

### 2. Drizzle Schema

In `packages/db/src/schema/process.ts`, update the enum:

```typescript
// before:
export const processNotationEnum = pgEnum('process_notation', [
  'bpmn', 'value_chain', 'epc'
]);

// after:
export const processNotationEnum = pgEnum('process_notation', [
  'bpmn', 'value_chain', 'epc', 'dmn', 'archimate'
]);
```

### 3. Zod Schema

In `packages/shared/src/schemas/process.ts`, update:

```typescript
// before:
export const processNotation = z.enum(['bpmn', 'value_chain', 'epc']);

// after:
export const processNotation = z.enum(['bpmn', 'value_chain', 'epc', 'dmn', 'archimate']);
```

### 4. i18n

Add to `messages/de/process.json` inside `process.fields` or as new `process.notations` block:

```json
"notations": {
  "bpmn": "BPMN 2.0",
  "value_chain": "Wertkettendiagramm (Phase 2)",
  "epc": "EPK — Ereignisgesteuerte Prozesskette (Phase 2)",
  "dmn": "DMN — Decision Model and Notation (Phase 2)",
  "archimate": "ArchiMate — Enterprise Architecture (Phase 2)"
}
```

Same for `messages/en/process.json`:

```json
"notations": {
  "bpmn": "BPMN 2.0",
  "value_chain": "Value Chain Diagram (Phase 2)",
  "epc": "EPC — Event-driven Process Chain (Phase 2)",
  "dmn": "DMN — Decision Model and Notation (Phase 2)",
  "archimate": "ArchiMate — Enterprise Architecture (Phase 2)"
}
```

### 5. UI — Notation Dropdown on Create/Edit Process Form

The notation select/dropdown should show all 5 values. Only `bpmn` is selectable. The other 4 are shown but disabled with a lock icon and "(Phase 2)" suffix. Tooltip on disabled items: "Available in a future release."

### That's it

No other changes. No new routes, no new components, no new tests beyond verifying the migration runs. The existing `createProcessSchema` already defaults notation to `'bpmn'` so all current processes are unaffected.
