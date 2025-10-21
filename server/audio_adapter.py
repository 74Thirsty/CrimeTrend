"""Optional Broadcastify integration helpers."""
from __future__ import annotations

import aiohttp
from typing import Optional


class BroadcastifyError(RuntimeError):
    """Raised when the Broadcastify API returns an error."""


class AudioAdapter:
    """Validate Broadcastify API keys and resolve feed URLs."""

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    async def validate_key(self, api_key: str) -> bool:
        """Verify that the provided key can access the Broadcastify API."""

        params = {"a": "feeds", "type": "json", "key": api_key}
        async with aiohttp.ClientSession() as session:
            async with session.get(self.base_url, params=params, timeout=10) as response:
                if response.status == 401:
                    return False
                if response.status >= 400:
                    raise BroadcastifyError(f"Broadcastify API error {response.status}")
                payload = await response.json()
        return bool(payload.get("feeds"))

    async def resolve_audio(self, api_key: str, county_id: str) -> Optional[str]:
        """Fetch the audio URL for a feed if available."""

        params = {"a": "feeds", "type": "json", "key": api_key, "countyId": county_id}
        async with aiohttp.ClientSession() as session:
            async with session.get(self.base_url, params=params, timeout=10) as response:
                if response.status == 401:
                    return None
                if response.status >= 400:
                    raise BroadcastifyError(f"Broadcastify API error {response.status}")
                payload = await response.json()
        feeds = payload.get("feeds", [])
        if not feeds:
            return None
        return feeds[0].get("listen_url")
