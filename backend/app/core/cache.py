"""Utilidades de cache — importar desde jira_client"""
from app.core.jira_client import _cache

def clear_cache():
    _cache.clear()
    return {"cleared": True}
