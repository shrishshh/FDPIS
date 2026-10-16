"""Layer 5 - recommendation engine and crew duty alerts.

Rules are data (rules/*.json, each with a source citation and a verified flag);
engine.py evaluates them against Layer 4 propagation output; crew.py projects
crew duty with an explicit rotation proxy; feed.py builds the day-wide crew
alert feed; notify.py is a SIMULATED notification outbox.
"""
