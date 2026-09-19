"""Application logging setup."""

import logging
import sys

from backend.app.core.config import get_settings

settings = get_settings()


def setup_logging() -> None:
    """Configure structured logging for backend operations."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    # Silence overly verbose external loggers if in info mode
    logging.getLogger("uvicorn.access").setLevel(
        logging.WARNING if not settings.DEBUG else logging.INFO
    )
