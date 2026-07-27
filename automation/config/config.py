"""
Automation Configuration Management
"""
import os

class Config:
    # BASE_URL defaults to live GitHub Pages or local fallback
    BASE_URL = os.getenv("BASE_URL", "https://ashritha123-code.github.io/eco-share/").rstrip('/') + '/'
    DEFAULT_TIMEOUT = int(os.getenv("DEFAULT_TIMEOUT", "10"))
    HEADLESS = os.getenv("HEADLESS", "true").lower() == "true"
    WINDOW_SIZE = os.getenv("WINDOW_SIZE", "1280,900")
    SCREENSHOT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "screenshots")
    LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
    REPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports")

    @classmethod
    def ensure_directories(cls):
        for path in [cls.SCREENSHOT_DIR, cls.LOG_DIR, cls.REPORT_DIR]:
            os.makedirs(path, exist_ok=True)
