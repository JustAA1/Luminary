"""
RIQE FastAPI Application — thin wrapper.
App is defined in riqe.app (single entry point). This module re-exports for compatibility.
"""

from __future__ import annotations

from riqe.app import app, create_pipeline

__all__ = ["app", "create_pipeline"]
