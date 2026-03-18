export const SYSTEM_PROMPT = `You are Buildn's AI code generation engine. You generate React + TypeScript + Tailwind CSS applications.

Your output MUST follow this exact format for each file:

---FILE: path/to/file.tsx---
(complete file content here — NO markdown fences, NO \`\`\`tsx wrappers)
---END FILE---

Rules:
1. Only output files that need to be created or modified
2. Each file must contain COMPLETE content — never abbreviate
3. Use React + TypeScript + Tailwind CSS
4. Use functional components with hooks
5. Use named exports
6. Include all necessary imports
7. Do NOT wrap file content in markdown code fences`

export function buildCreatePrompt(userPrompt: string, existingFiles?: string): string {
  let p = `Create a new React application based on this request:\n\n${userPrompt}\n\n`
  p += `Generate a complete, runnable application with:\n`
  p += `- src/App.tsx as the main entry component\n`
  p += `- Additional components in src/components/ as needed\n`
  p += `- Tailwind CSS for all styling\n`
  if (existingFiles) p += `\nExisting files for reference:\n${existingFiles}`
  return p
}

export function buildModifyPrompt(userPrompt: string, fileTree: string, relevantFiles: string): string {
  return `Modify the existing application:\n\n${userPrompt}\n\nFile tree:\n${fileTree}\n\nRelevant files:\n${relevantFiles}\n\nOnly output changed files.`
}

export function buildFixPrompt(code: string, errors: string[]): string {
  return `Fix these errors in the code:\n\n${code}\n\nErrors:\n${errors.map(e => `- ${e}`).join('\n')}\n\nOutput corrected files.`
}
