import { describe, it, expect } from 'vitest'
import { classifyIntent } from '../src/classifier'

describe('classifyIntent', () => {
  it('classifies creation requests', () => {
    expect(classifyIntent('Create a todo app', false)).toBe('create')
    expect(classifyIntent('帮我做一个计数器', false)).toBe('create')
  })
  it('classifies modification when project exists', () => {
    expect(classifyIntent('Add a dark theme', true)).toBe('modify')
    expect(classifyIntent('把按钮改成红色', true)).toBe('modify')
  })
  it('classifies questions', () => {
    expect(classifyIntent('What does this code do?', true)).toBe('question')
    expect(classifyIntent('这段代码是什么意思？', true)).toBe('question')
  })
  it('classifies deploy requests', () => {
    expect(classifyIntent('Deploy this project', true)).toBe('deploy')
    expect(classifyIntent('发布上线', true)).toBe('deploy')
  })
  it('defaults to create when no project', () => {
    expect(classifyIntent('Add a button', false)).toBe('create')
  })
})
