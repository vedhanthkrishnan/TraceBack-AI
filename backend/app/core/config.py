"""TraceBack AI - Core Configuration

Handles environment variables and system settings with Pydantic validation.
"""
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Exasol Connection Settings
    EXASOL_DSN: str = Field(default="localhost:8563", description="Exasol DSN host:port")
    EXASOL_USER: str = Field(default="sys", description="Database username")
    EXASOL_PASSWORD: str = Field(default="exasol", description="Database password")
    EXASOL_SCHEMA: str = Field(default="TRACEBACK_AI", description="Schema name")
    EXASOL_ENCRYPTION: bool = Field(default=False, description="Enable TLS/SSL encryption for Exasol")
    EXASOL_CONNECTION_TIMEOUT: int = Field(default=10, description="Connection timeout in seconds")
    EXASOL_QUERY_TIMEOUT: int = Field(default=30, description="Query timeout in seconds")

    # Local Mock Mode (Isolated fallback when Exasol server is offline)
    MOCK_EXASOL: bool = Field(default=False, description="Use isolated mock engine if Exasol is unavailable")

    # LLM / AI Copilot Provider Settings
    LLM_PROVIDER: str = Field(default="mock", description="LLM provider: mock, openai, anthropic, gemini, custom")
    LLM_API_KEY: Optional[str] = Field(default=None, description="API Key for the chosen LLM provider")
    LLM_MODEL: str = Field(default="gpt-4o-mini", description="Model identifier")
    LLM_ENDPOINT: Optional[str] = Field(default=None, description="Custom API endpoint URL if applicable")
    LLM_TEMPERATURE: float = Field(default=0.1, description="Sampling temperature")
    LLM_MAX_TOKENS: int = Field(default=1024, description="Max response tokens")

    # FastAPI Server Settings
    API_HOST: str = Field(default="127.0.0.1", description="Server bind host")
    API_PORT: int = Field(default=8000, description="Server bind port")
    CORS_ORIGINS: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
        description="Comma-separated allowed origins"
    )
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")

    # Predictive Maintenance Parameters
    BASELINE_WINDOW: int = Field(default=30, description="Initial healthy observation window in cycles")
    DRIFT_WINDOW: int = Field(default=15, description="Rolling window size for smoothed drift calculation")
    WATCH_THRESHOLD: float = Field(default=45.0, description="Risk score threshold for WATCH category (0-100)")
    CRITICAL_THRESHOLD: float = Field(default=75.0, description="Risk score threshold for CRITICAL category (0-100)")
    DEMO_MODE: bool = Field(default=False, description="Demo mode active flag")

    @property
    def cors_origin_list(self) -> List[str]:
        if not self.CORS_ORIGINS:
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
