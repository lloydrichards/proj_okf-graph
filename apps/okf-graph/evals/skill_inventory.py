"""Preflight the skill catalog for a fresh Codex CLI eval session."""

import json
from pathlib import Path
import subprocess
from threading import Timer


def skill_inventory(work, env, overrides):
    """Read the local catalog through a short-lived app-server stdio session."""
    with subprocess.Popen(
        ["codex", "app-server", "--stdio", *overrides], cwd=work, env=env,
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        text=True,
    ) as server:
        deadline = Timer(30, server.kill)
        deadline.start()
        try:
            def send(message):
                server.stdin.write(json.dumps(message) + "\n")
                server.stdin.flush()

            def request(number, method, params):
                send({"id": number, "method": method, "params": params})
                for line in server.stdout:
                    response = json.loads(line)
                    if response.get("id") == number:
                        if "error" in response:
                            raise RuntimeError(f"{method}: {response['error']}")
                        return response["result"]
                raise RuntimeError(f"Codex skill preflight closed or timed out during {method}")

            request(1, "initialize", {"clientInfo": {"name": "okf-eval", "version": "1"}})
            send({"method": "initialized", "params": {}})
            result = request(2, "skills/list", {"cwds": [str(work)], "forceReload": True})
            entry, = result["data"]
            if entry.get("errors"):
                raise RuntimeError(f"Codex skill catalog reported errors: {entry['errors']}")
            return entry["skills"]
        finally:
            deadline.cancel()
            server.kill()
            server.wait()


def isolated_skills(work, env, allowed_paths):
    """Return per-process CLI overrides and evidence for the matching enabled catalog."""
    allowed = {str(Path(path).resolve()) for path in allowed_paths}
    discovered = skill_inventory(work, env, [])
    blocked = []
    for entry in discovered:
        path = entry.get("path")
        if path and str(Path(path).resolve()) in allowed:
            continue
        selector = ("path", path) if path else ("name", entry["name"])
        blocked.append("{%s=%s,enabled=false}" % (selector[0], json.dumps(selector[1])))
    overrides = [
        "-c", "skills.bundled.enabled=false",
        "-c", "skills.config=[" + ",".join(blocked) + "]",
    ]
    enabled = [e for e in skill_inventory(work, env, overrides) if e["enabled"]]
    actual = {str(Path(e["path"]).resolve()) for e in enabled if e.get("path")}
    if actual != allowed or len(enabled) != len(allowed) or any(e["scope"] != "repo" for e in enabled):
        raise RuntimeError(f"Expected only fixture skills, got {[(e['name'], e.get('path')) for e in enabled]}")
    return overrides, {
        "enabled_names": sorted(e["name"] for e in enabled),
        "disabled_count": sum(e["enabled"] for e in discovered) - len(enabled),
    }
