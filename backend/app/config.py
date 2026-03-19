from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AI_TEAMS_")

    database_url: str = "sqlite+aiosqlite:///./ai_teams.db"
    host: str = "0.0.0.0"
    port: int = 17070


settings = Settings()
