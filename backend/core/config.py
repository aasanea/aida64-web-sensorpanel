"""Configuration settings for AIDA64 Dashboard Backend."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable override support."""

    host: str = "0.0.0.0"
    port: int = 8088
    poll_interval_ms: int = 500
    ping_interval_s: int = 30
    log_level: str = "INFO"
    fallback_registry: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
