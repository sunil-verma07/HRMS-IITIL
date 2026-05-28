# Notifications Module Contract

Feature boundary for in-app and email notification templates, dispatch, unread counts, and notification preferences.

Domain modules should emit events; notification delivery should subscribe without becoming a dependency of HRMS or ATS services.
