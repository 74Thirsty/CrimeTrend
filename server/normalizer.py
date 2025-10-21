"""Utilities that normalise raw feed payloads into canonical incidents."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
from typing import Any, Callable, Mapping, Optional

from .models import Incident


def _parse_iso(value: str) -> datetime:
    """Parse ISO-8601 timestamps with graceful fallback."""

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return datetime.now(tz=timezone.utc)


@dataclass(slots=True)
class IncidentNormalizer:
    """Convert records from a variety of feeds into :class:`Incident` objects."""

    handlers: Mapping[str, Callable[[Mapping[str, Any]], Incident]]

    @classmethod
    def default(cls) -> "IncidentNormalizer":
        return cls(
            handlers={
                "seattle": _socrata_handler,
                "pulsepoint": _pulsepoint_handler,
                "openmhz": _openmhz_handler,
                "noaa": _noaa_handler,
                "fema": _fema_handler,
                "lexisnexis": _lexisnexis_handler,
                "twitter": _twitter_handler,
            }
        )

    def normalize(self, source: str, record: Mapping[str, Any], audio_url: Optional[str] = None) -> Incident:
        if source not in self.handlers:
            raise KeyError(f"No normaliser registered for source '{source}'")
        incident = self.handlers[source](record)
        if audio_url:
            incident.audio_url = audio_url
        return incident


# Handlers -----------------------------------------------------------------

def _build_incident(
    *,
    source: str,
    record_id: str,
    timestamp: str,
    category: str,
    agency: str,
    address: str,
    lat: float,
    lon: float,
    status: str,
    audio_url: Optional[str] = None,
) -> Incident:
    """Helper to construct incidents with consistent hashing."""

    digest = hashlib.sha256(f"{source}:{record_id}:{timestamp}".encode()).hexdigest()
    return Incident(
        id=digest,
        timestamp=_parse_iso(timestamp),
        type=category,
        agency=agency,
        address=address,
        lat=float(lat),
        lon=float(lon),
        status=status,
        source=source,
        audio_url=audio_url,
    )


def _socrata_handler(record: Mapping[str, Any]) -> Incident:
    return _build_incident(
        source="seattle",
        record_id=str(record.get("cad_cdw_id") or record.get("incident_number", "")),
        timestamp=str(record.get("event_clearance_date") or record.get("datetime", datetime.now(tz=timezone.utc).isoformat())),
        category=str(record.get("event_clearance_description") or record.get("type", "Unknown")),
        agency="Seattle PD",
        address=str(record.get("incident_location") or record.get("address", "Unknown")),
        lat=float(record.get("latitude", 0.0)),
        lon=float(record.get("longitude", 0.0)),
        status=str(record.get("status", "dispatched")),
    )


def _pulsepoint_handler(record: Mapping[str, Any]) -> Incident:
    location = record.get("location", {})
    return _build_incident(
        source="pulsepoint",
        record_id=str(record.get("id")),
        timestamp=str(record.get("lastUpdate") or record.get("timestamp", datetime.now(tz=timezone.utc).isoformat())),
        category=str(record.get("type", "Unknown")),
        agency=str(record.get("agency", "PulsePoint")),
        address=str(location.get("address", "Unknown")),
        lat=float(location.get("latitude", 0.0)),
        lon=float(location.get("longitude", 0.0)),
        status=str(record.get("status", "active")),
    )


def _openmhz_handler(record: Mapping[str, Any]) -> Incident:
    meta = record.get("meta", {})
    return _build_incident(
        source="openmhz",
        record_id=str(record.get("id")),
        timestamp=str(record.get("time") or record.get("timestamp", datetime.now(tz=timezone.utc).isoformat())),
        category=str(meta.get("talkgroup", "Radio Call")),
        agency=str(meta.get("system", "OpenMHz")),
        address=str(meta.get("tag", "Unknown Location")),
        lat=float(meta.get("latitude", 0.0)),
        lon=float(meta.get("longitude", 0.0)),
        status="recorded",
        audio_url=record.get("audio", {}).get("url"),
    )


def _noaa_handler(record: Mapping[str, Any]) -> Incident:
    geometry = record.get("geometry", {})
    coords = geometry.get("coordinates", [0.0, 0.0])
    props = record.get("properties", {})
    timestamp = props.get("effective") or props.get("sent", datetime.now(tz=timezone.utc).isoformat())
    return _build_incident(
        source="noaa",
        record_id=str(record.get("id")),
        timestamp=str(timestamp),
        category=str(props.get("event", "Weather Alert")),
        agency="NOAA",
        address=str(props.get("areaDesc", "Weather Zone")),
        lat=float(coords[1] if len(coords) > 1 else 0.0),
        lon=float(coords[0] if coords else 0.0),
        status=str(props.get("status", "issued")),
    )


def _fema_handler(record: Mapping[str, Any]) -> Incident:
    return _build_incident(
        source="fema",
        record_id=str(record.get("disasterNumber")),
        timestamp=str(record.get("declarationDate", datetime.now(tz=timezone.utc).isoformat())),
        category=str(record.get("incidentType", "Disaster")),
        agency="FEMA",
        address=f"{record.get('state')}, {record.get('declaredCountyArea', 'Unknown County')}",
        lat=float(record.get("lat", 0.0)),
        lon=float(record.get("lng", 0.0)),
        status=str(record.get("incidentBeginDate", "active")),
    )


def _lexisnexis_handler(record: Mapping[str, Any]) -> Incident:
    timestamp = record.get("occured_on") or record.get("report_date", datetime.now(tz=timezone.utc).isoformat())
    return _build_incident(
        source="lexisnexis",
        record_id=str(record.get("case_number", record.get("id", ""))),
        timestamp=str(timestamp),
        category=str(record.get("offense", "Crime")),
        agency=str(record.get("agency", "Unknown Agency")),
        address=str(record.get("address", "Unknown")),
        lat=float(record.get("latitude", 0.0)),
        lon=float(record.get("longitude", 0.0)),
        status=str(record.get("status", "reported")),
    )


def _twitter_handler(record: Mapping[str, Any]) -> Incident:
    coordinates = record.get("data", {}).get("geo", {}).get("coordinates", {}).get("coordinates", [0.0, 0.0])
    created_at = record.get("data", {}).get("created_at", datetime.now(tz=timezone.utc).isoformat())
    return _build_incident(
        source="twitter",
        record_id=str(record.get("data", {}).get("id")),
        timestamp=str(created_at),
        category="Social Alert",
        agency=str(record.get("includes", {}).get("users", [{}])[0].get("username", "Twitter")),
        address=str(record.get("matching_rules", [{}])[0].get("tag", "Twitter Stream")),
        lat=float(coordinates[1] if len(coordinates) > 1 else 0.0),
        lon=float(coordinates[0] if coordinates else 0.0),
        status="posted",
    )
