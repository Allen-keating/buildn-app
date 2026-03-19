# Buildn V2 P5: Visual Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to click elements in the preview iframe to select them, then modify them via AI chat — bridging the visual preview with the code generation pipeline.

**Architecture:** A small selector script is injected into the WebContainer's generated app at boot time. When the user enables "visual edit" mode, clicks in the iframe send postMessage events to the parent with element metadata (tag, text, classes, bounding rect, and a CSS selector path). The parent stores the selection in a Zustand store. The chat input auto-prepends context about the selected element, so the AI modifies the right component. A highlight overlay shows which element is selected.

**Tech Stack:** postMessage API, CSS selector generation, Zustand, @buildn/sandbox (file injection)

---

## File Structure

```
packages/sandbox/src/
├── selector-script.ts                 # The JS to inject into generated apps
└── inject.ts                          # Writes selector script into WebContainer

apps/web/
├── lib/
│   └── stores/
│       └── visual-store.ts            # Selected element state
├── components/
│   └── preview/
│       ├── preview-panel.tsx           # Modify: add visual edit toggle + postMessage listener
│       └── selection-overlay.tsx       # Highlight box over selected element
├── components/
│   └── chat/
│       ├── chat-panel.tsx             # Modify: prepend selection context to prompt
│       └── chat-input.tsx             # Modify: show selected element badge
└── components/dashboard/
    └── workspace-shell.tsx             # Modify: inject selector on sandbox boot
```

---

## Task 1: Selector Script

**Files:**
- Create: `packages/sandbox/src/selector-script.ts`
- Create: `packages/sandbox/src/inject.ts`
- Modify: `packages/sandbox/src/index.ts`

The selector script runs inside the user's app (in the iframe). It must be vanilla JS — no TypeScript, no imports.

- [ ] **Step 1: Create selector-script.ts**

This exports the script as a string constant.

```typescript
// packages/sandbox/src/selector-script.ts

// This script is injected into the user's generated app inside WebContainer.
// It listens for clicks when visual-edit mode is active and sends element info
// to the parent frame via postMessage.

export const SELECTOR_SCRIPT = `
(function() {
  let enabled = false;
  let highlightEl = null;

  // Listen for enable/disable from parent
  window.addEventListener('message', function(e) {
    if (e.data?.type === 'buildn:visual-edit') {
      enabled = e.data.enabled;
      if (!enabled && highlightEl) {
        highlightEl.remove();
        highlightEl = null;
      }
      document.body.style.cursor = enabled ? 'crosshair' : '';
    }
  });

  // Build a CSS selector path for an element
  function getSelectorPath(el) {
    const parts = [];
    while (el && el !== document.body) {
      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector += '#' + el.id;
        parts.unshift(selector);
        break;
      }
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.trim().split(/\\s+/).slice(0, 3).join('.');
        if (classes) selector += '.' + classes;
      }
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(el) + 1;
          selector += ':nth-of-type(' + index + ')';
        }
      }
      parts.unshift(selector);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }

  // Show highlight overlay
  function showHighlight(rect) {
    if (!highlightEl) {
      highlightEl = document.createElement('div');
      highlightEl.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);z-index:99999;transition:all 0.1s ease;';
      document.body.appendChild(highlightEl);
    }
    highlightEl.style.top = rect.top + 'px';
    highlightEl.style.left = rect.left + 'px';
    highlightEl.style.width = rect.width + 'px';
    highlightEl.style.height = rect.height + 'px';
  }

  // Hover highlight
  document.addEventListener('mousemove', function(e) {
    if (!enabled) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el !== document.body && el !== document.documentElement) {
      showHighlight(el.getBoundingClientRect());
    }
  });

  // Click to select
  document.addEventListener('click', function(e) {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === document.body || el === document.documentElement) return;

    const rect = el.getBoundingClientRect();
    showHighlight(rect);

    window.parent.postMessage({
      type: 'buildn:element-selected',
      payload: {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().slice(0, 100),
        classes: el.className || '',
        selector: getSelectorPath(el),
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      }
    }, '*');
  }, true);
})();
`
```

- [ ] **Step 2: Create inject.ts**

```typescript
// packages/sandbox/src/inject.ts
import type { WebContainer } from '@webcontainer/api'
import { SELECTOR_SCRIPT } from './selector-script'

const INJECT_PATH = 'public/buildn-selector.js'

export async function injectSelectorScript(wc: WebContainer): Promise<void> {
  await wc.fs.mkdir('public', { recursive: true })
  await wc.fs.writeFile(INJECT_PATH, SELECTOR_SCRIPT)
}
```

Note: The generated app's `index.html` needs a `<script src="/buildn-selector.js"></script>` tag. This will be handled in Task 5 when we inject it during sandbox boot.

- [ ] **Step 3: Update index.ts**

Add to `packages/sandbox/src/index.ts`:
```typescript
export { injectSelectorScript } from './inject'
export { SELECTOR_SCRIPT } from './selector-script'
```

- [ ] **Step 4: Typecheck and commit**

```bash
cd packages/sandbox && pnpm typecheck
git add packages/sandbox/
git commit -m "feat(sandbox): add visual selector script and injection"
```

---

## Task 2: Visual Store

**Files:**
- Create: `apps/web/lib/stores/visual-store.ts`

- [ ] **Step 1: Create visual-store.ts**

```typescript
'use client'

import { create } from 'zustand'

export interface SelectedElement {
  tag: string
  text: string
  classes: string
  selector: string
  rect: { top: number; left: number; width: number; height: number }
}

interface VisualStore {
  isVisualEditMode: boolean
  selectedElement: SelectedElement | null

  toggleVisualEdit: () => void
  setVisualEdit: (enabled: boolean) => void
  selectElement: (element: SelectedElement) => void
  clearSelection: () => void
}

export const useVisualStore = create<VisualStore>((set) => ({
  isVisualEditMode: false,
  selectedElement: null,

  toggleVisualEdit: () =>
    set((s) => ({
      isVisualEditMode: !s.isVisualEditMode,
      selectedElement: s.isVisualEditMode ? null : s.selectedElement,
    })),

  setVisualEdit: (enabled) =>
    set({ isVisualEditMode: enabled, ...(!enabled ? { selectedElement: null } : {}) }),

  selectElement: (element) => set({ selectedElement: element }),
  clearSelection: () => set({ selectedElement: null }),
}))
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/stores/visual-store.ts
git commit -m "feat(web): add visual editor Zustand store"
```

---

## Task 3: Selection Overlay

**Files:**
- Create: `apps/web/components/preview/selection-overlay.tsx`

- [ ] **Step 1: Create selection-overlay.tsx**

This shows a label badge near the selected element's position (relative to the preview panel, not the iframe internal coordinates — we'll offset based on iframe position).

```tsx
'use client'

import { useVisualStore } from '@/lib/stores/visual-store'

export function SelectionOverlay() {
  const { selectedElement, isVisualEditMode } = useVisualStore()

  if (!isVisualEditMode || !selectedElement) return null

  return (
    <div className="pointer-events-none absolute left-2 top-12 z-20">
      <div className="pointer-events-auto rounded-md bg-blue-600 px-2 py-1 text-xs text-white shadow-lg">
        <span className="font-mono">&lt;{selectedElement.tag}&gt;</span>
        {selectedElement.text && (
          <span className="ml-1 text-blue-200">
            &ldquo;{selectedElement.text.slice(0, 30)}
            {selectedElement.text.length > 30 ? '...' : ''}&rdquo;
          </span>
        )}
        <button
          onClick={() => useVisualStore.getState().clearSelection()}
          className="ml-2 text-blue-300 hover:text-white"
        >
          &times;
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/preview/selection-overlay.tsx
git commit -m "feat(web): add selection overlay badge"
```

---

## Task 4: Update Preview Panel

**Files:**
- Modify: `apps/web/components/preview/preview-panel.tsx`

Add:
1. Visual edit toggle button in the device frame bar
2. postMessage listener for `buildn:element-selected`
3. Send `buildn:visual-edit` enable/disable to iframe
4. SelectionOverlay component
5. Ref on iframe to send messages

- [ ] **Step 1: Replace preview-panel.tsx**

```tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSandboxStore, type SandboxStatus } from '@/lib/stores/sandbox-store'
import { useVisualStore, type SelectedElement } from '@/lib/stores/visual-store'
import { DeviceFrame, SIZES, type DeviceType } from './device-frame'
import { SelectionOverlay } from './selection-overlay'

const STATUS_MESSAGES: Record<SandboxStatus, string> = {
  idle: 'Waiting...',
  booting: 'Starting sandbox...',
  installing: 'Installing dependencies...',
  running: '',
  error: 'Something went wrong',
}

export function PreviewPanel() {
  const { status, previewUrl, error } = useSandboxStore()
  const { isVisualEditMode, toggleVisualEdit, selectElement } = useVisualStore()
  const [device, setDevice] = useState<DeviceType>('desktop')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Send visual-edit mode toggle to iframe
  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: 'buildn:visual-edit', enabled: isVisualEditMode },
        '*',
      )
    }
  }, [isVisualEditMode])

  // Listen for element selection from iframe
  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (e.data?.type === 'buildn:element-selected') {
        selectElement(e.data.payload as SelectedElement)
      }
    },
    [selectElement],
  )

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  // Re-send visual edit state when iframe loads
  const handleIframeLoad = useCallback(() => {
    if (isVisualEditMode && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'buildn:visual-edit', enabled: true },
        '*',
      )
    }
  }, [isVisualEditMode])

  return (
    <div className="relative flex h-full flex-col bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-1.5">
        <DeviceFrame device={device} onDeviceChange={setDevice} />
        <button
          onClick={toggleVisualEdit}
          className={`rounded px-2 py-0.5 text-xs ${
            isVisualEditMode
              ? 'bg-blue-600 text-white'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
          title="Visual Edit Mode"
        >
          {isVisualEditMode ? '✎ Editing' : '✎ Edit'}
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-2">
        {status === 'running' && previewUrl ? (
          <>
            <iframe
              ref={iframeRef}
              src={previewUrl}
              title="Preview"
              className="rounded border border-neutral-700 bg-white"
              style={{ width: SIZES[device].width, height: '100%', maxWidth: '100%' }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onLoad={handleIframeLoad}
            />
            <SelectionOverlay />
          </>
        ) : (
          <div className="text-center">
            {(status === 'booting' || status === 'installing') && (
              <div className="mb-2 mx-auto h-5 w-5 animate-spin rounded-full border-2 border-neutral-600 border-t-blue-500" />
            )}
            <p className="text-sm text-neutral-500">{error || STATUS_MESSAGES[status]}</p>
            {status === 'idle' && (
              <p className="mt-1 text-xs text-neutral-600">Send a message to generate code and see the preview</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-red-900 bg-red-950/90 px-4 py-2">
          <p className="text-xs text-red-400">{error}</p>
          <button onClick={() => useSandboxStore.getState().setError(null)} className="mt-1 text-xs text-red-500 hover:text-red-300">Dismiss</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update device-frame.tsx layout**

The DeviceFrame now needs to be inline (not full width) since the toggle sits next to it. Update `apps/web/components/preview/device-frame.tsx` — wrap buttons in a `<div>` with no border (the parent handles the border now):

```tsx
'use client'

export type DeviceType = 'desktop' | 'tablet' | 'phone'

const SIZES: Record<DeviceType, { width: string; label: string }> = {
  desktop: { width: '100%', label: 'Desktop' },
  tablet: { width: '768px', label: 'Tablet' },
  phone: { width: '375px', label: 'Phone' },
}

interface DeviceFrameProps {
  device: DeviceType
  onDeviceChange: (d: DeviceType) => void
}

export function DeviceFrame({ device, onDeviceChange }: DeviceFrameProps) {
  return (
    <div className="flex gap-1">
      {(Object.keys(SIZES) as DeviceType[]).map((d) => (
        <button
          key={d}
          onClick={() => onDeviceChange(d)}
          className={`rounded px-2 py-0.5 text-xs ${
            d === device
              ? 'bg-neutral-700 text-white'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          {SIZES[d].label}
        </button>
      ))}
    </div>
  )
}

export { SIZES }
```

- [ ] **Step 3: Typecheck and commit**

```bash
cd apps/web && pnpm typecheck
git add apps/web/components/preview/
git commit -m "feat(web): add visual edit mode to preview panel with postMessage listener"
```

---

## Task 5: Update Workspace to Inject Selector + Context in Chat

**Files:**
- Modify: `apps/web/components/dashboard/workspace-shell.tsx`
- Modify: `apps/web/components/chat/chat-panel.tsx`
- Modify: `apps/web/components/chat/chat-input.tsx`

- [ ] **Step 1: Inject selector script on sandbox boot**

In `workspace-shell.tsx`, after `bootSandbox(initialFiles)` and before `installDeps`, inject the selector script:

Add import: `import { injectSelectorScript } from '@buildn/sandbox'`

In the boot function, add after `const wc = await bootSandbox(initialFiles)`:
```typescript
await injectSelectorScript(wc)
```

- [ ] **Step 2: Update chat-input.tsx to show selection badge**

Add to `ChatInput` props: `selectedElement?: { tag: string; text: string } | null` and `onClearSelection?: () => void`

Show a badge above the input when an element is selected:

```tsx
'use client'

import { useState, useRef, type KeyboardEvent } from 'react'

interface ChatInputProps {
  onSubmit: (text: string) => void
  disabled: boolean
  selectedElement?: { tag: string; text: string } | null
  onClearSelection?: () => void
}

export function ChatInput({ onSubmit, disabled, selectedElement, onClearSelection }: ChatInputProps) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setText('')
    ref.current?.focus()
  }

  return (
    <div className="border-t border-neutral-800 p-3">
      {selectedElement && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-blue-600/10 border border-blue-600/30 px-3 py-1.5">
          <span className="text-xs text-blue-400">
            Editing: <span className="font-mono">&lt;{selectedElement.tag}&gt;</span>
            {selectedElement.text && (
              <span className="ml-1 text-blue-300">&ldquo;{selectedElement.text.slice(0, 30)}&rdquo;</span>
            )}
          </span>
          <button onClick={onClearSelection} className="ml-auto text-xs text-blue-400 hover:text-white">&times;</button>
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={selectedElement ? `Describe how to change this ${selectedElement.tag}...` : 'Describe what you want to build...'}
          rows={2}
          className="flex-1 resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className="self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update chat-panel.tsx to prepend selection context**

Add import: `import { useVisualStore } from '@/lib/stores/visual-store'`

In `ChatPanel`, read the selected element. When sending a message, if an element is selected, prepend context to the prompt:

```typescript
const { selectedElement, clearSelection } = useVisualStore()

// In handleSend, before calling streamChat:
let finalPrompt = prompt
if (selectedElement) {
  finalPrompt = `[User selected element: <${selectedElement.tag}> with text "${selectedElement.text}" and classes "${selectedElement.classes}", CSS selector: "${selectedElement.selector}"]\n\nModify this specific element: ${prompt}`
  clearSelection()
}
```

Also pass `selectedElement` and `onClearSelection` to `<ChatInput>`:
```tsx
<ChatInput
  onSubmit={handleSend}
  disabled={isGenerating}
  selectedElement={selectedElement ? { tag: selectedElement.tag, text: selectedElement.text } : null}
  onClearSelection={clearSelection}
/>
```

- [ ] **Step 4: Typecheck and commit**

```bash
cd apps/web && pnpm typecheck
git add apps/web/ packages/sandbox/
git commit -m "feat: wire visual editor — selector injection, selection context in chat, input badge"
```

---

## Task 6: Build Verification & Push

- [ ] **Step 1: Full typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 2: Build**

```bash
pnpm build
```

- [ ] **Step 3: Commit and push**

```bash
git add -A && git diff --cached --quiet || git commit -m "chore: P5 final verification"
git push origin main
```
