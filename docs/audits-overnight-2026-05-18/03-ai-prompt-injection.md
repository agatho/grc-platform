# AI Prompt Injection Audit

Stand: 2026-05-18 overnight session.

## What this audit looked for

Every prompt builder in `packages/ai/src/prompts/` that interpolates a variable into the **system** message (which the model treats as authoritative instruction) or into a **user** message via a raw template string (rather than via `JSON.stringify`, which provides clear delimitation).

Raw interpolation into the system prompt is the highest-risk pattern: an attacker who controls one of those variables can attempt to override the instruction (`Ignore previous instructions, do X instead`).

Lower-risk but still worth flagging: untrusted strings inserted as user content without JSON delimitation.

## System-prompt interpolations: 11

| File       | Variables                                                         | Treatment             |
| ---------- | ----------------------------------------------------------------- | --------------------- |
| `audit.ts` | `locale === "de" ? "Antworte auf Deutsch." : "Reply in English."` | raw template — REVIEW |
| `audit.ts` | `locale === "de" ? "Antworte auf Deutsch." : "Reply in English."` | raw template — REVIEW |
| `audit.ts` | `locale === "de" ? "Antworte auf Deutsch." : "Reply in English."` | raw template — REVIEW |
| `bpm.ts`   | `locale === "de" ? "Antworte auf Deutsch." : "Reply in English."` | raw template — REVIEW |
| `bpm.ts`   | `locale === "de" ? "Antworte auf Deutsch." : "Reply in English."` | raw template — REVIEW |
| `bpm.ts`   | `locale === "de" ? "Antworte auf Deutsch." : "Reply in English."` | raw template — REVIEW |
| `bpm.ts`   | `locale === "de" ? "Antworte auf Deutsch." : "Reply in English."` | raw template — REVIEW |
| `dpms.ts`  | `locale === "de" ? "Antworte auf Deutsch." : "Reply in English."` | raw template — REVIEW |
| `dpms.ts`  | `locale === "de" ? "Antworte auf Deutsch." : "Reply in English."` | raw template — REVIEW |
| `tprm.ts`  | `locale === "de" ? "Antworte auf Deutsch." : "Reply in English."` | raw template — REVIEW |
| `tprm.ts`  | `locale === "de" ? "Antworte auf Deutsch." : "Reply in English."` | raw template — REVIEW |

## User-prompt raw interpolations: 1

| File     | Snippet                 |
| -------- | ----------------------- |
| `bpm.ts` | ``${userInstruction...` |
