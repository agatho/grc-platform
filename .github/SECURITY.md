# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in ARCTOS, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Use [GitHub's private vulnerability reporting](https://github.com/YOUR_ORG/grc-platform/security/advisories/new) to submit the report.
3. Include steps to reproduce, impact assessment, and any suggested fix.

We aim to acknowledge reports within 48 hours and provide a fix or mitigation within 7 days for critical issues.

## Security Measures

This project implements:
- Row-Level Security (RLS) for multi-tenant data isolation
- Append-only audit log with SHA-256 hash chain for tamper detection
- Auth.js with JWT sessions and bcrypt password hashing
- RBAC with Three Lines of Defense model
- Automated security scanning via CodeQL, Dependabot, and OSSF Scorecard
