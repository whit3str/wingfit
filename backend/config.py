import secrets

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ASSETS_FOLDER: str = "storage/assets"
    FRONTEND_FOLDER: str = "frontend"
    SQLITE_FILE: str = "storage/wingfit.sqlite"

    OPENAI_API_KEY: str = ""
    OPEN_AI_HOST: str = ""

    AUTH_METHOD: str = "local"
    SECRET_KEY: str = secrets.token_hex(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 1440

    OIDC_CLIENT_ID: str = ""
    OIDC_CLIENT_SECRET: str = ""
    OIDC_AUTH_URL: str = ""
    OIDC_TOKEN_URL: str = ""
    OIDC_USERINFO_URL: str = ""
    OIDC_REDIRECT_URI: str = ""

    class Config:
        env_file = "storage/config.yml"


settings = Settings()
