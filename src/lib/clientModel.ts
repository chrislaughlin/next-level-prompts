import type { TextGenerationPipeline } from '@huggingface/transformers'
import { pipeline, env } from '@huggingface/transformers'

const MODEL_ID =
  (typeof import.meta !== 'undefined' &&
    // @ts-expect-error vite env
    import.meta.env?.VITE_TRANSFORMERS_MODEL_ID) ||
  'HuggingFaceTB/SmolLM-135M-Instruct'

let generatorPromise: Promise<TextGenerationPipeline> | null = null
let lastBackend: 'webgpu' | 'wasm' | null = null

const CACHE_KEY = 'transformers-cache'

const MODEL_SIZE_MB = 70

let browserCacheEnabled = true

async function checkBrowserCacheAvailable(): Promise<boolean> {
  if (typeof caches === 'undefined') return false
  try {
    const testCache = await caches.open('cache-test-' + Date.now())
    await testCache.put('/test', new Response('test'))
    await testCache.delete('/test')
    await testCache.delete('/')
    return true
  } catch {
    return false
  }
}

async function initCacheSettings() {
  if (typeof window === 'undefined') return

  const available = await checkBrowserCacheAvailable()
  browserCacheEnabled = available

  if (!available) {
    console.warn(
      `Model size (${MODEL_SIZE_MB.toFixed(0)}MB) exceeds browser cache quota. Caching disabled.`,
    )
  }

  env.useBrowserCache = available
  env.useFSCache = false
  if (available) {
    // @ts-ignore - cacheKey exists at runtime but not in types
    env.cacheKey = CACHE_KEY
  }
}

// Reduce noisy ONNX runtime warnings in the browser.
env.backends.onnx = { ...(env.backends.onnx ?? {}), logLevel: 'error' }

// Initialize cache settings before any model loading
initCacheSettings()

function silenceOnnxLogs() {
  const originalError = console.error
  const originalWarn = console.warn
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('onnxruntime')) return
    originalError(...args)
  }
  console.warn = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('onnxruntime')) return
    originalWarn(...args)
  }
  return () => {
    console.error = originalError
    console.warn = originalWarn
  }
}

function supportsWebGPU() {
  return typeof navigator !== 'undefined' && Boolean((navigator as any).gpu)
}

async function buildGenerator(forceBackend?: 'webgpu' | 'wasm') {
  const backend = forceBackend ?? (supportsWebGPU() ? 'webgpu' : 'wasm')
  lastBackend = backend

  const restoreLogs = silenceOnnxLogs()
  // Hint to the runtime about preferred backend; transformers.js will pick the best available.
  // We keep dtype light to reduce download size; q4 works for SmolLM in the browser.
  const pipe = (await pipeline('text-generation' as any, MODEL_ID, {
    device: backend,
    dtype: 'q4',
    max_new_tokens: 80,
  })) as TextGenerationPipeline
  restoreLogs()
  return pipe
}

async function checkCacheStatus(): Promise<boolean> {
  if (!browserCacheEnabled || typeof caches === 'undefined') return false
  try {
    const cache = await caches.open(CACHE_KEY)
    const cacheKeys = await cache.keys()
    return cacheKeys.length > 0
  } catch {
    return false
  }
}

let cachedCacheStatus: boolean | null = null

export async function prefetchModel() {
  if (typeof window === 'undefined') return null
  if (cachedCacheStatus === null) {
    cachedCacheStatus = await checkCacheStatus()
  }
  if (!generatorPromise) {
    generatorPromise = buildGenerator()
  }
  return generatorPromise
}

export async function isModelCached(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (cachedCacheStatus === null) {
    cachedCacheStatus = await checkCacheStatus()
  }
  return cachedCacheStatus
}

export async function generateClientText(prompt: string) {
  if (typeof window === 'undefined')
    throw new Error('Client model unavailable on server')
  const generator = await (generatorPromise ?? prefetchModel())
  if (!generator) throw new Error('Model not ready')

  const result = await generator(prompt, {
    max_new_tokens: 90,
    temperature: 0.6,
    top_p: 0.9,
  })

  const text = Array.isArray(result) ? (result[0]?.generated_text ?? '') : ''
  return text
}

export async function forceRefetchModel() {
  if (typeof window === 'undefined') return
  generatorPromise = null
  cachedCacheStatus = null
  if (browserCacheEnabled && typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_KEY)
      const cacheKeys = await cache.keys()
      await Promise.all(cacheKeys.map((req) => cache.delete(req)))
    } catch (err) {
      console.warn('Failed to clear model cache', err)
    }
  }
  return prefetchModel()
}

export function getLastBackend() {
  return lastBackend
}

export function isWebGPUPreferred() {
  return supportsWebGPU()
}
