import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append(os.getcwd())

from app.api.v1.endpoints.calendar_events import _load_events
from app.api.v1.endpoints.people import get_availability

import asyncio

async def test():
    print("Testing _load_events...")
    evs = _load_events()
    print(f"Loaded {len(evs)} events")
    
    print("\nTesting get_availability...")
    # Mocking today or a specific date
    res = await get_availability("2026-05-15", "2026-05-15", "Back")
    print(f"Result: {res}")

asyncio.run(test())
