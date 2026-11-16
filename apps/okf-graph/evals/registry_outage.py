"""Prepare a usable stale npm cache, then shut down its registry before the trial."""

from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.error import URLError
from urllib.request import Request, urlopen

PUBLIC_REGISTRY = "https://registry.npmjs.org"
STALE_VERSION = "0.2.0"


class StaleRegistry(BaseHTTPRequestHandler):
    def do_GET(self):
        # Forward public package data only. Override the tag and visible versions for okf-graph.
        request = Request(PUBLIC_REGISTRY + self.path, headers={"Accept": self.headers.get("Accept", "*/*")})
        try:
            with urlopen(request, timeout=30) as response:
                data = response.read()
                content_type = response.headers["Content-Type"]
        except (URLError, TimeoutError) as error:
            self.send_error(502, str(error))
            return
        if self.path == "/okf-graph":
            package = json.loads(data)
            if package["dist-tags"]["latest"] == STALE_VERSION:
                self.send_error(500, "The outage fixture needs an older release")
                return
            package["dist-tags"]["latest"] = STALE_VERSION
            package["versions"] = {STALE_VERSION: package["versions"][STALE_VERSION]}
            data = json.dumps(package).encode()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "public, max-age=0")
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, *args):
        pass


@contextmanager
def outage_seed(fixture, output):
    """Yield the stopped registry URL and its cache. Each agent receives a private copy."""
    with TemporaryDirectory(prefix="registry-seed-", dir=output.parent) as scratch:
        root = Path(scratch)
        work = root / "workspace"
        shutil.copytree(fixture, work)
        cache = root / "npm"
        checks = []
        with ThreadingHTTPServer(("127.0.0.1", 0), StaleRegistry) as server:
            registry = f"http://127.0.0.1:{server.server_port}"
            env = dict(os.environ, TMPDIR=scratch, npm_config_registry=registry,
                       npm_config_cache=str(cache), npm_config_fetch_retries="0",
                       npm_config_audit="false", npm_config_fund="false")

            def probe(args, expect_success=True):
                result = subprocess.run(args, cwd=work, env=env, capture_output=True, text=True, timeout=180)
                checks.append(dict(command=args, exit_code=result.returncode, stdout=result.stdout, stderr=result.stderr))
                (output / "outage-setup.json").write_text(json.dumps(
                    dict(registry=registry, stale_version=STALE_VERSION, checks=checks), indent=2) + "\n")
                if (result.returncode == 0) != expect_success:
                    raise RuntimeError(f"Unexpected exit {result.returncode} from {args}; see outage-setup.json")
                return result

            package = "okf-graph@latest"
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                probe(["npm", "view", package, "version"])
                probe(["npx", "--yes", package, "validate", "bundle", "--json"])
            finally:
                server.shutdown()
                thread.join()

        # Check the same tag, executable and bundle after shutdown, before copying the cache.
        cached = probe(["npm", "view", "--offline", package, "version"])
        executable = probe(["npx", "--offline", "--yes", package, "--version"])
        validation = probe(["npx", "--offline", "--yes", package, "validate", "bundle", "--json"])
        if (cached.stdout.strip() != STALE_VERSION or executable.stdout.strip() != f"okf-graph v{STALE_VERSION}"
                or json.loads(validation.stdout).get("valid") is not True):
            raise RuntimeError("The cached CLI did not pass its offline controls; see outage-setup.json")
        rejected = probe(["npm", "view", "--cache", str(root / "empty-cache"), package, "version"], False)
        if "ECONNREFUSED" not in rejected.stderr:
            raise RuntimeError("Fresh lookup did not observe registry refusal; see outage-setup.json")
        yield registry, cache
