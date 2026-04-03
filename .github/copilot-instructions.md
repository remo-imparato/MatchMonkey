# Copilot Instructions

## Purpose
These instructions define how Copilot should generate and modify code for my projects. They apply to **all code suggestions** across backend, frontend, SQL, tests, and architecture. Copilot should follow these preferences by default but may offer alternatives when appropriate.

---

## Development Stack & Technologies
- Primary backend: **C# / .NET 8 / .NET Framework 4.7.2 (ASP.NET MVC)**  
- Database: **MSSQL**, with strong preference for **stored procedures**  
- JavaScript: **vanilla JS only** unless I request otherwise  
- Testing: **MSTest**  
- HTML, CSS for UI  
- Use **modern, industry-standard coding practices** for all languages

---

## Coding Style & Preferences

### General Formatting
- Prefer clean, readable, maintainable code.  
- Avoid unnecessary abstraction or over‑engineering.  
- Keep comments minimal unless necessary.

### C# / .NET Guidelines
- Avoid **LINQ** unless I specifically ask for it.  
- Prefer explicit loops and conditionals instead of complex LINQ chains.  
- Follow MVC conventions and keep code organized by standard project structure.  
- Use async/await correctly and consistently.  
- Favor dependency injection and SOLID principles (flexibly).  
- When modifying files, make **minimal, targeted changes** and preserve existing structure.

### JavaScript Guidelines
- Prefer **vanilla JavaScript**—no frameworks unless I request them.  
- Keep JS simple, modular, and readable.  
- Avoid unnecessary dependencies.

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
- My SQL and EF rules  
- My desire for simplicity and maintainability  
- Modern industry standards  
- Flexibility when justified  


