export function buildCreatePrompt(userPrompt: string, existingFiles?: string): string {
  let prompt = `Create a new React application based on this request:\n\n${userPrompt}\n\n`
  prompt += `Generate a complete, runnable application with:\n`
  prompt += `- src/App.tsx as the main entry component\n`
  prompt += `- Additional component files as needed in src/components/\n`
  prompt += `- Proper TypeScript types\n`
  prompt += `- Tailwind CSS for styling\n`

  if (existingFiles) {
    prompt += `\nExisting project files for reference:\n${existingFiles}`
  }

  return prompt
}
