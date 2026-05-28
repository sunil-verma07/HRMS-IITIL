# Audit Module Contract

Feature boundary for audit trails, login history, failed login attempts, IP addresses, device metadata, and session activity.

Authentication writes audit events directly for security-critical flows. Other modules should record auditable mutations through a reusable audit service.
