"""Small, additive provenance contract shared by REST and WebSocket consumers."""
import time


def source_meta(source, observed_at, max_age, *, cached=False, available=True):
    age = max(0, time.time() - observed_at) if observed_at else None
    status = "unavailable" if not available or age is None else "stale" if age > max_age else "cached" if cached else "live"
    return {"source": source, "observed_at": observed_at or None, "max_age_seconds": max_age, "status": status}


def field_meta(source, unit="", kind="measured", inputs=None):
    result = {"source": source, "unit": unit, "kind": kind}
    if inputs:
        result["inputs"] = inputs
    return result
