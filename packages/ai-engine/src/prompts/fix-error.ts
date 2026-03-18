export function buildFixErrorPrompt(originalCode: string, errors: string[]): string {
  let prompt = `The following code has errors that need to be fixed:\n\n`
  prompt += `${originalCode}\n\n`
  prompt += `Errors:\n${errors.map((e) => `- ${e}`).join('\n')}\n\n`
  prompt += `Fix all errors and output the corrected files.`
  return prompt
}
