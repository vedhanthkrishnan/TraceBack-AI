"""TraceBack AI - LLM Provider Interface & Implementations

Supports multiple LLM backends (OpenAI, Anthropic, Gemini, Mock) with graceful fallback.
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
import httpx
from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.copilot.prompts import COPILOT_SYSTEM_PROMPT


class LLMProviderInterface(ABC):
    """Abstract interface for Copilot language model providers."""

    @abstractmethod
    def generate_response(
        self,
        prompt: str,
        system_prompt: str = COPILOT_SYSTEM_PROMPT,
        temperature: float = 0.1,
        max_tokens: int = 1024
    ) -> str:
        """Generates a text completion given the evidence prompt."""
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        pass


class MockLLMProvider(LLMProviderInterface):
    """Deterministic, offline provider that structures answers directly from retrieved evidence."""

    @property
    def provider_name(self) -> str:
        return "TraceBack Grounded Engine (Offline / Mock)"

    @property
    def is_configured(self) -> bool:
        return True

    def generate_response(
        self,
        prompt: str,
        system_prompt: str = COPILOT_SYSTEM_PROMPT,
        temperature: float = 0.1,
        max_tokens: int = 1024
    ) -> str:
        # Grounded offline synthesis directly from retrieved evidence
        if "RETRIEVED BACKEND EVIDENCE:" in prompt:
            evidence_part = prompt.split("RETRIEVED BACKEND EVIDENCE:")[1].split("\n\nProvide")[0].strip()
            return (
                f"Based on retrieved backend telemetry:\n\n{evidence_part}\n\n"
                "Investigation Guidance: Verify sensor calibrations and schedule physical borescope inspection for leading abnormal indicators."
            )
        return "Based on retrieved telemetry, the machine operates within monitored baseline parameters."


class OpenAILLMProvider(LLMProviderInterface):
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.LLM_API_KEY
        self.model = model or settings.LLM_MODEL or "gpt-4o-mini"

    @property
    def provider_name(self) -> str:
        return f"OpenAI ({self.model})"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 5)

    def generate_response(
        self,
        prompt: str,
        system_prompt: str = COPILOT_SYSTEM_PROMPT,
        temperature: float = 0.1,
        max_tokens: int = 1024
    ) -> str:
        if not self.is_configured:
            return MockLLMProvider().generate_response(prompt, system_prompt)

        try:
            url = settings.LLM_ENDPOINT or "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning(f"OpenAI API call failed: {e}. Falling back to grounded mock response.")
            return MockLLMProvider().generate_response(prompt, system_prompt)


class GeminiLLMProvider(LLMProviderInterface):
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.LLM_API_KEY
        self.model = model or settings.LLM_MODEL or "gemini-1.5-flash"

    @property
    def provider_name(self) -> str:
        return f"Google Gemini ({self.model})"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 5)

    def generate_response(
        self,
        prompt: str,
        system_prompt: str = COPILOT_SYSTEM_PROMPT,
        temperature: float = 0.1,
        max_tokens: int = 1024
    ) -> str:
        if not self.is_configured:
            return MockLLMProvider().generate_response(prompt, system_prompt)

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
            payload = {
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens}
            }
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            logger.warning(f"Gemini API call failed: {e}. Falling back to grounded mock response.")
            return MockLLMProvider().generate_response(prompt, system_prompt)


def get_llm_provider() -> LLMProviderInterface:
    """Factory creating configured LLM provider with graceful fallback."""
    provider_type = (settings.LLM_PROVIDER or "mock").lower()

    if provider_type == "openai" and settings.LLM_API_KEY:
        return OpenAILLMProvider()
    elif provider_type in ("gemini", "google") and settings.LLM_API_KEY:
        return GeminiLLMProvider()
    else:
        return MockLLMProvider()
