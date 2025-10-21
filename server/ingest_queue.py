"""Redis-backed queue used for deduplicating and streaming incidents."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import AsyncIterator, Dict, Iterable, Optional

from redis import asyncio as redis

from .models import Incident


class IngestQueue:
    """Manage deduplication, storage, and streaming for incidents."""

    def __init__(self, redis_url: str, retention_seconds: int) -> None:
        self.redis = redis.from_url(redis_url, decode_responses=True)
        self.retention_seconds = retention_seconds
        self.zset_key = "crimetrend:incidents"
        self.dedup_key_prefix = "crimetrend:dedup:"
        self.pubsub_channel = "crimetrend:stream"

    async def push(self, incident: Incident) -> bool:
        """Store an incident if it is new and publish it to listeners."""

        message = incident.to_message()
        dedup_key = f"{self.dedup_key_prefix}{incident.id}"
        added = await self.redis.set(dedup_key, 1, nx=True, ex=self.retention_seconds)
        if not added:
            return False

        score = message["timestamp"]
        score_value = datetime.fromisoformat(score.replace("Z", "+00:00")).timestamp()
        await self.redis.zadd(self.zset_key, {json.dumps(message): score_value})
        await self.redis.zremrangebyscore(
            self.zset_key, "-inf", score_value - float(self.retention_seconds)
        )
        await self.redis.publish(self.pubsub_channel, json.dumps(message))
        return True

    async def get_recent(self, since: Optional[datetime] = None) -> Iterable[Dict[str, str]]:
        """Return a list of recent incidents since the provided timestamp."""

        min_score = since.timestamp() if since else "-inf"
        entries = await self.redis.zrangebyscore(self.zset_key, min_score, "+inf")
        return [json.loads(entry) for entry in entries]

    async def stream(self) -> AsyncIterator[Dict[str, str]]:
        """Yield incidents published to the queue."""

        pubsub = self.redis.pubsub()
        await pubsub.subscribe(self.pubsub_channel)
        try:
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if not message:
                    await asyncio.sleep(0.1)
                    continue
                data = json.loads(message["data"])
                yield data
        finally:
            await pubsub.unsubscribe(self.pubsub_channel)
            await pubsub.close()

    async def close(self) -> None:
        await self.redis.close()
