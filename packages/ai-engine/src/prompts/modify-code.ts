export function buildModifyPrompt(
  userPrompt: string,
  fileTree: string,
  relevantFiles: string,
): string {
  let prompt = `Modify the existing application based on this request:\n\n${userPrompt}\n\n`
  prompt += `Current file tree:\n${fileTree}\n\n`
  prompt += `Relevant file contents:\n${relevantFiles}\n\n`
  prompt += `Only output files that need to be changed. Do not output unchanged files.`
  return prompt
}
