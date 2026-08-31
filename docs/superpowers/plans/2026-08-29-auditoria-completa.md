# Auditoría Completa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the static multilingual audit into a complete local audit with dependency scanners, infrastructure rules, configurable statuses, exportable reports and CI automation.

**Architecture:** Extend the existing audit engine with isolated adapters for local dependency commands, infrastructure rules and report rendering. Keep the MCP tool backward-compatible while adding optional configuration, output format and status persistence. All external commands are local, bounded by timeout, and optional.

**Tech Stack:** TypeScript, Node.js child_process/fs, Vitest, GitHub Actions, existing MCP stdio server.

---

### Task 1: Configuration and finding statuses
- Add `.mcp-audit.json` parsing with safe defaults and validation.
- Extend finding status to `cumple`, `no cumple`, `no aplica`, `pendiente`.
- Add tests for valid/invalid configuration and status handling.

### Task 2: Dependency vulnerability adapters
- Create `src/dependencies.ts` with bounded adapters for npm, pip-audit, cargo audit, dotnet and osv-scanner.
- Detect applicable manifests, run only available commands, redact command output, parse structured results where possible and emit warnings when unavailable.
- Add mocked command tests without executing arbitrary project scripts.

### Task 3: Infrastructure and CI/CD rules
- Add rules for Docker, GitHub Actions, Terraform, ports, root users, floating images, public resources, missing encryption and exposed secrets.
- Add fixtures and tests for each infrastructure family.

### Task 4: Report generation
- Create `src/reports.ts` for JSON, Markdown and HTML rendering plus optional PDF-compatible HTML output.
- Include executive summary, risk level, findings, references, controls, skipped checks and dependency scanner status.
- Add deterministic renderer tests.

### Task 5: MCP integration
- Extend `auditar_repositorio` with optional config, format and dependency-scan controls while preserving existing calls.
- Add tool contract and end-to-end stdio tests.

### Task 6: GitHub Actions and documentation
- Add `.github/workflows/repository-audit.yml` with pull-request/manual triggers, artifact upload and high/critical gate.
- Document configuration, commands, reports, scanner requirements and limitations.
- Run all tests, build, MCP smoke test and commit the complete implementation.
