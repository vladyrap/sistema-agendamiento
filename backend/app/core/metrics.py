"""Application-level Prometheus metrics."""
from prometheus_client import Counter, Histogram

appointments_created = Counter(
    "appointments_created_total",
    "Total number of appointments created",
    ["specialty"],
)

appointments_cancelled = Counter(
    "appointments_cancelled_total",
    "Total number of appointments cancelled",
    ["actor"],  # patient, doctor, admin
)

appointments_confirmed = Counter(
    "appointments_confirmed_total",
    "Total number of appointments confirmed",
)

appointments_completed = Counter(
    "appointments_completed_total",
    "Total number of appointments completed",
)

notifications_enqueued = Counter(
    "notifications_enqueued_total",
    "Notifications pushed to the worker queue",
    ["type"],
)

notifications_processed = Counter(
    "notifications_processed_total",
    "Notifications processed by the worker",
    ["type", "outcome"],  # outcome: sent, failed, skipped
)

slot_lookup_latency = Histogram(
    "slot_lookup_seconds",
    "Latency of available-slot calculation",
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0),
)
