use crate::messages::service_error;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

#[derive(Debug, Deserialize)]
pub struct OllamaGenerateInput {
    pub base_url: String,
    pub model: String,
    pub prompt: String,
    pub format: Value,
}

#[derive(Debug, Serialize)]
pub struct OllamaGenerateOutput {
    pub response: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
struct OllamaGenerateRequest {
    model: String,
    prompt: String,
    stream: bool,
    format: Value,
    options: OllamaOptions,
}

#[derive(Debug, Serialize)]
struct OllamaOptions {
    temperature: u8,
}

#[derive(Debug, Deserialize)]
struct OllamaGenerateResponse {
    response: Option<String>,
    error: Option<String>,
}

#[tauri::command]
pub async fn request_ollama_generate(
    input: OllamaGenerateInput,
) -> Result<OllamaGenerateOutput, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|error| service_error("Не удалось подготовить HTTP-клиент Ollama", error))?;

    let endpoint = format!("{}/api/generate", normalize_base_url(&input.base_url));
    let payload = OllamaGenerateRequest {
        model: input.model,
        prompt: input.prompt,
        stream: false,
        format: input.format,
        options: OllamaOptions { temperature: 0 },
    };

    let response = client
        .post(endpoint)
        .json(&payload)
        .send()
        .await
        .map_err(|error| service_error("Не удалось связаться с Ollama", error))?;

    if !response.status().is_success() {
        let status = response.status();
        let details = response.text().await.unwrap_or_default();
        let message = if details.trim().is_empty() {
            format!("Ollama вернула HTTP {status}")
        } else {
            details
        };
        return Err(message);
    }

    let data: OllamaGenerateResponse = response
        .json()
        .await
        .map_err(|error| service_error("Не удалось прочитать ответ Ollama", error))?;

    Ok(OllamaGenerateOutput {
        response: data.response,
        error: data.error,
    })
}

fn normalize_base_url(value: &str) -> String {
    let trimmed = value.trim();
    let with_protocol = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("http://{trimmed}")
    };

    with_protocol.trim_end_matches('/').to_string()
}
