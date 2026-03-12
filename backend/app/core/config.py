from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_ENV: str = "development"
    DATABASE_URL: str = "sqlite:///./inventory.db"
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h
    AUTO_CREATE_TABLES: bool = True
    ENABLE_API_DOCS: bool = True
    ALLOWED_ORIGINS: str = "http://localhost:8081,http://localhost:19006,https://inventory-app-olive-seven.vercel.app"

    # 이메일 설정 (선택사항, 미설정 시 이메일 발송 비활성화)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_TLS: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
