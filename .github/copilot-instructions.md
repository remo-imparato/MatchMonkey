# Copilot Instructions

## Purpose
These instructions define how Copilot should generate and modify code for my projects. They apply to **all code suggestions** across backend, frontend, SQL, tests, and architecture. Copilot should follow these preferences by default but may offer alternatives when appropriate.

---

## Development Stack & Technologies
- Database: **SQLite**,
- JavaScript: **vanilla JS only** unless I request otherwise  
- HTML, CSS for UI  
- Use **modern, industry-standard coding practices** for all languages

---

## Coding Style & Preferences

### General Formatting
- Prefer clean, readable, maintainable code.  
- Avoid unnecessary abstraction or over‑engineering.  
- Keep comments minimal unless necessary.

### JavaScript Guidelines
- Prefer **vanilla JavaScript**—no frameworks unless I request them.  
- Keep JS simple, modular, and readable.  
- Avoid unnecessary dependencies.  
- When using MM5 async DB APIs, prefer `await` with `executeQueryAsync()` for CREATE/INSERT/UPDATE/DELETE and `await` with `getQueryResultAsync()` for SELECT calls.

### Function Naming
- No fallback compatibility protections are needed for renamed MatchMonkey module functions; use only the finalized function names.

---

## Code Editing Rules
- Make minimal, targeted changes, not full rewrites.  
- Do not delete large sections of code unless instructed.

---

## Behavior Expectations
- Follow my preferences **by default**, but you may:
  - Suggest flexible alternatives if there is a clear benefit  
  - Provide optional modern patterns  
  - Explain differences when offering alternative approaches  

- Always prioritize clarity, maintainability, and correctness.

---

## Summary
Copilot should generate code that reflects:
- My preferred tech stack  
- My formatting and architecture preferences  
- My desire for simplicity and maintainability  
- Modern industry standards  
- Flexibility when justified  



