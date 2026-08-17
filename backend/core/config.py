import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")


class Settings:
    MONGO_URL: str = os.environ["MONGO_URL"]
    DB_NAME: str = os.environ["DB_NAME"]
    JWT_SECRET: str = os.environ["JWT_SECRET"]
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = int(os.environ.get("ACCESS_TOKEN_MINUTES", "60"))
    REFRESH_TOKEN_DAYS: int = int(os.environ.get("REFRESH_TOKEN_DAYS", "7"))
    ADMIN_EMAIL: str = os.environ["ADMIN_EMAIL"]
    ADMIN_PASSWORD: str = os.environ["ADMIN_PASSWORD"]
    ADMIN_NAME: str = os.environ.get("ADMIN_NAME", "Administrador")
    MAX_LOGIN_ATTEMPTS: int = int(os.environ.get("MAX_LOGIN_ATTEMPTS", "5"))
    LOCKOUT_MINUTES: int = int(os.environ.get("LOCKOUT_MINUTES", "15"))
    FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    UPLOAD_DIR: Path = ROOT_DIR / "uploads"


settings = Settings()
settings.UPLOAD_DIR.mkdir(exist_ok=True)
