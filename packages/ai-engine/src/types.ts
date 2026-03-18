export interface LLMChunk {
  type: 'text'
  text: string
}

export interface LLMDone {
  type: 'done'
  fullText: string
}

export type LLMEvent = LLMChunk | LLMDone
