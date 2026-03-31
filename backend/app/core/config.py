from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Jira Server / Data Center
    jira_base_url: str
    jira_pat: str           # Personal Access Token
    jira_project_key: str

    # App
    app_env: str = "development"
    app_port: int = 8000
    cors_origins: str = "http://localhost:5173"
    gemini_api_key: str | None = None
    google_credentials_json: str | None = None

    # Cache TTL en segundos
    cache_ttl: int = 300
    
    # Confluence
    confluence_base_url: str
    confluence_pat: str
    confluence_page_id: str

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"
        env_file_encoding = "utf-8"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
