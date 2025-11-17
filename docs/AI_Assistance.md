# AI Assistance Notes

This project was developed with heavy AI support.  
This document explains how each AI tool was used so future developers can continue the workflow.

--

# 🧠 Tools Used

### **ChatGPT**
Used for:
- Brainstorming architectures
- Explaining React/Supabase concepts
- Debugging tricky logic
- Quick code fixes

Strengths:
- Fast iteration
- Great for small or medium context windows

---

### **Claude**
Used for:
- Long-form documentation
- Multi-file reasoning
- Reviewing large migration diffs

Strengths:
- Excellent contextual reasoning
- Good for large codebase refactors

---

### **Google Gemini (Large Context Window)**
Used for:
- Inspecting large file sets
- Reviewing deeply nested component structures

Strengths:
- Extremely large context window
- Handles many files at once

---

### **Cursor**
Used for:
- Applying automated refactors
- Making changes across the codebase
- File-by-file code edits

Strengths:
- Best for multi-file code transformations

--

### **Lovable**
Used for:
- Generating entire front-end page designs
- Creating UI architecture
- Hosting environment for previews
- Some integration wiring

Strengths:
- One-click component generation
- AI-driven UI flows

---

# Notes For the Next Developer

- Don’t rely on one AI; different models excel at different tasks.
- Use ChatGPT for *thinking* and Cursor for *applying changes*.
- Keep all database reasoning centralized in `docs/supabase.md`.
- When in doubt, ask an AI to summarize OR rewrite existing code before modifying it.