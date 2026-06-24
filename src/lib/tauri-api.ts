import { invoke } from "@tauri-apps/api/core"

type OllamaGenerateInput = {
  baseUrl: string
  model: string
  prompt: string
  format: unknown
}

type OllamaGenerateOutput = {
  response?: string
  error?: string
}

export async function requestOllamaGenerate(input: OllamaGenerateInput) {
  return invoke<OllamaGenerateOutput>("request_ollama_generate", {
    input: {
      base_url: input.baseUrl,
      model: input.model,
      prompt: input.prompt,
      format: input.format,
    },
  })
}
