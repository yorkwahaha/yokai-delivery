#!/usr/bin/env python3
"""Guarded serial batch wrapper for the M2 fusion art candidates.

The only paid path is tools/nanobanana_generate.py.  This tool adds:
  * a persistent exclusive lock, atomic JSON checkpoints, recoverable ledger;
  * a reservation written *before* every bridge call;
  * cache reuse, no-overwrite protection, pending/failed no-resend checks;
  * manifest/approval/budget gates;
  * an optional in-process wrapper around bridge.generate that sets SDK
    retries to one attempt and captures only response id + safe usage totals.

No API is called by --selftest, --init, --dry-run or --status.
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import re
import secrets
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BATCH_DIR = ROOT / "scratch" / "fusion-art-batch"
DEFAULT_MANIFEST = BATCH_DIR / "manifest_phase1.json"
DEFAULT_LEDGER = BATCH_DIR / "ledger.json"
LOCK_PATH = BATCH_DIR / ".lock"
BRIDGE = ROOT / "tools" / "nanobanana_generate.py"
VENV_PY = Path("I:/Tools/NanoBanana21/.venv/Scripts/python.exe")
MODEL = "gemini-nano-banana-2.1"
SIZE = "1K"
ASPECT = "3:2"
MIN_RESERVE = Decimal("0.0536")
BRIDGE_ESTIMATE = Decimal("0.0536")
HARD_INTERNAL = Decimal("2.40")
HARD_EXTERNAL = Decimal("3.00")
SKILL_RE = re.compile(r"^fusion_[a-z0-9_]+$")
OUTPUT_RE = re.compile(r"^(main|hit|ground|icon)_v\d{2,}\.png$")


class GuardError(Exception):
    def __init__(self, code: str, detail: str = "", exit_code: int = 2):
        super().__init__(code)
        self.code = code
        self.detail = detail
        self.exit_code = exit_code


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise GuardError("FILE_MISSING", str(path))
    except (OSError, json.JSONDecodeError) as exc:
        raise GuardError("JSON_INVALID", f"{path}: {type(exc).__name__}")


def atomic_write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent)
    )
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        with contextlib.suppress(OSError):
            tmp.unlink()
        raise


class BatchLock:
    """Exclusive lock that never removes a lock it does not own."""

    def __init__(self, path: Path = LOCK_PATH):
        self.path = path
        self.token: str | None = None

    def acquire(self) -> "BatchLock":
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            fd = os.open(str(self.path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            raise GuardError(
                "LOCK_HELD",
                f"{self.path} exists; another batch run or an unknown owner holds it. "
                "Do not delete an unknown lock.",
            )
        token = secrets.token_hex(16)
        payload = {"pid": os.getpid(), "token": token, "created_utc": now_utc()}
        try:
            os.write(fd, (json.dumps(payload) + "\n").encode("utf-8"))
            os.close(fd)
        except BaseException:
            with contextlib.suppress(OSError):
                os.close(fd)
            with contextlib.suppress(OSError):
                self.path.unlink()
            raise
        self.token = token
        return self

    def release(self) -> None:
        if self.token is None:
            return
        try:
            current = read_json(self.path)
        except GuardError:
            self.token = None
            return
        if current.get("token") != self.token:
            self.token = None
            raise GuardError("LOCK_UNKNOWN", "Lock owner changed; refusing to delete it.")
        with contextlib.suppress(FileNotFoundError):
            self.path.unlink()
        self.token = None

    def __enter__(self) -> "BatchLock":
        return self.acquire()

    def __exit__(self, exc_type, exc, tb) -> None:
        self.release()


def task_rel(task: dict, key: str) -> str:
    value = task.get(key)
    if not isinstance(value, str) or not value:
        raise GuardError("TASK_PATH_INVALID", f"{key} missing")
    return value.replace("\\", "/")


def task_path(task: dict, key: str, root: Path = ROOT) -> Path:
    p = (root / task_rel(task, key)).resolve()
    try:
        p.relative_to(root.resolve())
    except ValueError:
        raise GuardError("TASK_PATH_ESCAPE", str(p))
    return p


def manifest_of(task: dict, root: Path = ROOT) -> Path:
    return task_path(task, "output", root).with_suffix(".json")


def validate_task_paths(task: dict, root: Path = ROOT) -> None:
    skill = task.get("skill")
    phase = task.get("phase")
    if not isinstance(skill, str) or not SKILL_RE.fullmatch(skill):
        raise GuardError("TASK_SKILL_INVALID", str(skill))
    if phase not in ("main", "hit", "ground", "icon"):
        raise GuardError("TASK_PHASE_INVALID", str(phase))
    prompt = task_path(task, "prompt_file", root)
    output = task_path(task, "output", root)
    expected_prompt = (root / "art" / "fusion" / "requests").resolve()
    expected_output = (root / "art" / "fusion" / "candidates" / skill).resolve()
    if not prompt.is_relative_to(expected_prompt) or prompt.suffix != ".txt":
        raise GuardError("PROMPT_PATH_INVALID", str(prompt))
    if not output.is_relative_to(expected_output) or not OUTPUT_RE.fullmatch(output.name):
        raise GuardError("OUTPUT_PATH_INVALID", str(output))
    if not output.name.startswith(f"{phase}_"):
        raise GuardError("OUTPUT_PHASE_MISMATCH", str(output))
    if not prompt.is_file() or prompt.stat().st_size == 0:
        raise GuardError("PROMPT_MISSING", str(prompt))


def load_manifest(path: Path = DEFAULT_MANIFEST) -> dict:
    m = read_json(Path(path))
    if not isinstance(m, dict):
        raise GuardError("MANIFEST_INVALID", "root must be an object")
    if m.get("version") != 1:
        raise GuardError("MANIFEST_VERSION", str(m.get("version")))
    if m.get("model") != MODEL or m.get("size") != SIZE or m.get("aspect_ratio") != ASPECT:
        raise GuardError("MANIFEST_MODEL_SIZE_ASPECT", "must be the fixed bridge tuple")
    budget = m.get("budget")
    if not isinstance(budget, dict):
        raise GuardError("MANIFEST_BUDGET", "budget missing")
    try:
        external = Decimal(str(budget["external_limit_usd"]))
        internal = Decimal(str(budget["internal_stop_usd"]))
        per = Decimal(str(budget["per_image_reserve_usd"]))
        prior = Decimal(str(budget.get("prior_spend_usd", 0)))
        max_images = int(budget["max_images"])
    except (KeyError, ValueError, ArithmeticError):
        raise GuardError("MANIFEST_BUDGET", "numeric fields invalid")
    if external <= 0 or internal <= 0 or internal > external:
        raise GuardError("MANIFEST_BUDGET", "limits must satisfy 0 < internal <= external")
    if external > HARD_EXTERNAL or internal > HARD_INTERNAL:
        raise GuardError(
            "MANIFEST_LIMIT_EXCEEDS_HARD_CAP",
            f"internal<= {HARD_INTERNAL}, external<= {HARD_EXTERNAL} always",
        )
    if per < MIN_RESERVE:
        raise GuardError("MANIFEST_RESERVE_TOO_LOW", str(per))
    if prior < 0 or max_images < 1:
        raise GuardError("MANIFEST_BUDGET", "prior/max_images invalid")
    tasks = m.get("tasks")
    if not isinstance(tasks, list) or not tasks or len(tasks) > max_images:
        raise GuardError("MANIFEST_TASKS", "tasks must be 1..max_images")
    ids: set[str] = set()
    outputs: set[str] = set()
    for task in tasks:
        if not isinstance(task, dict) or not isinstance(task.get("task_id"), str):
            raise GuardError("MANIFEST_TASKS", "task_id missing")
        if task["task_id"] in ids:
            raise GuardError("MANIFEST_TASKS", f"duplicate task_id {task['task_id']}")
        ids.add(task["task_id"])
        validate_task_paths(task)
        out = task_rel(task, "output").lower()
        if out in outputs:
            raise GuardError("MANIFEST_TASKS", f"duplicate output {out}")
        outputs.add(out)
    return m


def reserve_for(manifest: dict) -> Decimal:
    return max(MIN_RESERVE, Decimal(str(manifest["budget"]["per_image_reserve_usd"])))


def new_entry(task: dict, manifest: dict, root: Path = ROOT) -> dict:
    validate_task_paths(task, root)
    prompt = task_path(task, "prompt_file", root)
    return {
        "taskid": task["task_id"],
        "skill": task["skill"],
        "phase": task["phase"],
        "model": manifest["model"],
        "size": manifest["size"],
        "aspect_ratio": manifest["aspect_ratio"],
        "prompt_file": task_rel(task, "prompt_file"),
        "prompt_sha256": sha256_file(prompt),
        "output": task_rel(task, "output"),
        "output_sha256": None,
        "manifest_path": str(manifest_of(task, root).relative_to(root)).replace("\\", "/"),
        "status": "planned",
        "reserved_usd": 0.0,
        "actual_billed_usd": None,
        "actual_billing_status": "unavailable",
        "actual_usage": None,
        "provider_response_id": None,
        "bridge_request_sha256": None,
        "error_code": None,
        "attempts": 0,
        "cache_hit": False,
        "created_utc": now_utc(),
        "updated_utc": now_utc(),
        "started_utc": None,
        "finished_utc": None,
    }


def new_ledger(manifest: dict, root: Path = ROOT) -> dict:
    entries = {t["task_id"]: new_entry(t, manifest, root) for t in manifest["tasks"]}
    return {
        "version": 1,
        "batch_id": manifest["batch_id"],
        "model": manifest["model"],
        "size": manifest["size"],
        "aspect_ratio": manifest["aspect_ratio"],
        "created_utc": now_utc(),
        "updated_utc": now_utc(),
        "reserved_total_usd": 0.0,
        "committed_total_usd": 0.0,
        "actual_billed_total_usd": None,
        "actual_billing_status": "unavailable",
        "tasks": entries,
    }


def entry_committed_usd(entry: dict) -> Decimal:
    """Unknown actual stays at the conservative reservation, never zero."""
    reserved = Decimal(str(entry.get("reserved_usd", 0) or 0))
    actual = entry.get("actual_billed_usd")
    if actual is None:
        return reserved
    try:
        return max(reserved, Decimal(str(actual)))
    except (ArithmeticError, ValueError):
        return reserved


def refresh_ledger(ledger: dict) -> None:
    reserved_total = Decimal("0")
    committed_total = Decimal("0")
    for entry in ledger["tasks"].values():
        reserved = Decimal(str(entry.get("reserved_usd", 0) or 0))
        reserved_total += reserved
        committed_total += entry_committed_usd(entry)
    ledger["reserved_total_usd"] = float(reserved_total)
    ledger["committed_total_usd"] = float(committed_total)
    ledger["updated_utc"] = now_utc()
    ledger["actual_billed_total_usd"] = None
    ledger["actual_billing_status"] = "unavailable"


def write_ledger(path: Path, ledger: dict) -> None:
    refresh_ledger(ledger)
    atomic_write_json(path, ledger)


def ensure_ledger(manifest: dict, path: Path, create: bool, root: Path = ROOT) -> dict:
    if not path.exists():
        if not create:
            return new_ledger(manifest, root)
        ledger = new_ledger(manifest, root)
        write_ledger(path, ledger)
        return ledger
    ledger = read_json(path)
    if ledger.get("batch_id") != manifest["batch_id"]:
        raise GuardError("LEDGER_BATCH_MISMATCH", str(ledger.get("batch_id")))
    tasks = ledger.get("tasks")
    if not isinstance(tasks, dict):
        raise GuardError("LEDGER_INVALID", "tasks missing")
    manifest_ids = {t["task_id"] for t in manifest["tasks"]}
    if set(tasks) - manifest_ids:
        raise GuardError("LEDGER_EXTRA_TASKS", "ledger has tasks outside manifest")
    for task in manifest["tasks"]:
        tid = task["task_id"]
        if tid not in tasks:
            if not create:
                raise GuardError("LEDGER_TASK_MISSING", tid)
            tasks[tid] = new_entry(task, manifest, root)
            continue
        entry = tasks[tid]
        if entry.get("prompt_sha256") != sha256_file(task_path(task, "prompt_file", root)):
            raise GuardError("PROMPT_CHANGED", f"{tid}: refusing to reuse stale ledger")
        if entry.get("output") != task_rel(task, "output"):
            raise GuardError("OUTPUT_CHANGED", tid)
        if entry.get("status") not in {
            "planned", "reserved", "pending", "succeeded", "failed", "cached"
        }:
            raise GuardError("LEDGER_STATUS", f"{tid}: {entry.get('status')}")
    if create:
        write_ledger(path, ledger)
    return ledger


def artifact_matches(task: dict, manifest: dict, root: Path = ROOT) -> dict | None:
    output = task_path(task, "output", root)
    meta_path = manifest_of(task, root)
    if not output.is_file() or not meta_path.is_file():
        return None
    try:
        meta = read_json(meta_path)
    except GuardError:
        return None
    if not isinstance(meta, dict):
        return None
    prompt = task_path(task, "prompt_file", root)
    if meta.get("model") != manifest["model"]:
        return None
    if meta.get("image_size") != manifest["size"] or meta.get("aspect_ratio") != manifest["aspect_ratio"]:
        return None
    if meta.get("prompt_sha256") != sha256_file(prompt):
        return None
    actual_image_sha = sha256_file(output)
    if meta.get("image_sha256") != actual_image_sha:
        return None
    if meta.get("status") not in (None, "ART_CANDIDATE"):
        return None
    return meta


def validate_task_for_new_call(task: dict, entry: dict, manifest: dict, root: Path = ROOT) -> None:
    validate_task_paths(task, root)
    if entry.get("prompt_sha256") != sha256_file(task_path(task, "prompt_file", root)):
        raise GuardError("PROMPT_CHANGED", task["task_id"])
    output = task_path(task, "output", root)
    meta = manifest_of(task, root)
    if output.exists() or meta.exists():
        raise GuardError(
            "OUTPUT_EXISTS",
            f"{output}: existing candidate/manifest is protected; choose a new vNN path",
        )


def budget_check(manifest: dict, ledger: dict, additional: Decimal) -> None:
    budget = manifest["budget"]
    internal = min(Decimal(str(budget["internal_stop_usd"])), HARD_INTERNAL)
    external = min(Decimal(str(budget["external_limit_usd"])), HARD_EXTERNAL)
    prior = Decimal(str(budget.get("prior_spend_usd", 0) or 0))
    committed_so_far = sum(
        (entry_committed_usd(e) for e in ledger["tasks"].values()),
        Decimal("0"),
    )
    committed = prior + committed_so_far + additional
    if committed > internal:
        raise GuardError(
            "BUDGET_STOP_INTERNAL",
            f"committed {committed} > internal stop {internal}; no API call",
        )
    if committed > external:
        raise GuardError(
            "BUDGET_STOP_EXTERNAL",
            f"committed {committed} > external limit {external}; no API call",
        )


def reconcile(manifest: dict, ledger: dict, root: Path = ROOT) -> bool:
    changed = False
    for task in manifest["tasks"]:
        entry = ledger["tasks"][task["task_id"]]
        if entry["status"] not in ("reserved", "pending"):
            continue
        meta = artifact_matches(task, manifest, root)
        if meta is not None:
            entry["status"] = "succeeded"
            entry["output_sha256"] = meta.get("image_sha256")
            entry["bridge_request_sha256"] = meta.get("request_sha256")
            entry["error_code"] = "RECOVERED_AFTER_CHECKPOINT"
            entry["finished_utc"] = entry.get("finished_utc") or now_utc()
        else:
            entry["status"] = "pending"
            entry["error_code"] = entry.get("error_code") or "INTERRUPTED_UNKNOWN"
        entry["updated_utc"] = now_utc()
        changed = True
    return changed


def build_plan(manifest: dict, ledger: dict, max_images: int = 0, root: Path = ROOT) -> tuple[list[dict], list[dict]]:
    planned: list[dict] = []
    cached: list[dict] = []
    for task in manifest["tasks"]:
        entry = ledger["tasks"][task["task_id"]]
        status = entry["status"]
        if status in ("succeeded", "cached"):
            meta = artifact_matches(task, manifest, root)
            if meta is None:
                raise GuardError("CACHED_ARTIFACT_MISSING", task["task_id"])
            if status == "cached":
                entry["cache_hit"] = True
            cached.append(task)
            continue
        if status in ("reserved", "pending", "failed"):
            raise GuardError(
                "RESUME_BLOCKED",
                f"{task['task_id']} is {status}; do not resend. Inspect ledger and root decision.",
            )
        meta = artifact_matches(task, manifest, root)
        if meta is not None:
            entry["status"] = "cached"
            entry["cache_hit"] = True
            entry["output_sha256"] = meta.get("image_sha256")
            entry["bridge_request_sha256"] = meta.get("request_sha256")
            entry["finished_utc"] = entry.get("finished_utc") or now_utc()
            entry["updated_utc"] = now_utc()
            cached.append(task)
            continue
        validate_task_for_new_call(task, entry, manifest, root)
        planned.append(task)
    if max_images > 0:
        planned = planned[:max_images]
    return planned, cached


def safe_usage(usage: Any) -> dict | None:
    if usage is None:
        return None
    data = None
    dump = getattr(usage, "model_dump", None)
    if callable(dump):
        with contextlib.suppress(Exception):
            data = dump(exclude_none=True)
    if not isinstance(data, dict):
        return None
    keys = (
        "total_input_tokens", "total_output_tokens", "total_tokens",
        "total_cached_tokens", "total_thought_tokens", "total_tool_use_tokens",
        "input_tokens_by_modality", "output_tokens_by_modality",
    )
    out: dict[str, Any] = {}
    for key in keys:
        if key not in data:
            continue
        value = data[key]
        if value is None or isinstance(value, (str, int, float, bool)):
            out[key] = value
        elif isinstance(value, list):
            safe_items = []
            for item in value[:16]:
                if isinstance(item, dict):
                    safe_items.append({
                        k: v for k, v in item.items()
                        if v is None or isinstance(v, (str, int, float, bool))
                    })
            out[key] = safe_items
    if "total_tokens" not in out and "total_input_tokens" not in out and "total_output_tokens" not in out:
        out["fields"] = sorted(str(k) for k in data.keys())[:24]
    return out or None


def usage_known(usage: Any) -> bool:
    return isinstance(usage, dict) and any(
        key in usage for key in ("total_tokens", "total_input_tokens", "total_output_tokens")
    )


def load_bridge():
    if not BRIDGE.is_file():
        raise GuardError("BRIDGE_MISSING", str(BRIDGE))
    spec = importlib.util.spec_from_file_location("_fusion_nanobanana_bridge", BRIDGE)
    if spec is None or spec.loader is None:
        raise GuardError("BRIDGE_IMPORT", "cannot load bridge module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_bridge(task: dict, manifest: dict, reserve: Decimal, root: Path = ROOT) -> dict:
    """Call bridge.generate once, with SDK retries fixed to one attempt."""
    bridge = load_bridge()
    from google import genai
    from google.genai import types

    if not hasattr(types, "HttpRetryOptions") or not hasattr(types, "HttpOptions"):
        raise GuardError("SDK_RETRY_UNAVAILABLE", "google-genai retry options not found")
    try:
        http_options = types.HttpOptions(
            retry_options=types.HttpRetryOptions(attempts=1)
        )
    except Exception as exc:
        raise GuardError("SDK_RETRY_UNAVAILABLE", type(exc).__name__)

    real_client_cls = genai.Client
    captured: dict[str, Any] = {}
    created: list[Any] = []

    class Interactions:
        def __init__(self, client: Any):
            self.client = client

        def create(self, *args: Any, **kwargs: Any) -> Any:
            try:
                response = self.client.interactions.create(*args, **kwargs)
            except Exception as exc:
                captured["exception_type"] = type(exc).__name__
                code = getattr(exc, "status_code", None)
                if isinstance(code, int):
                    captured["http_status"] = code
                raise
            captured["provider_response_id"] = getattr(response, "id", None)
            provider_model = getattr(response, "model", None)
            if isinstance(provider_model, str):
                captured["provider_model"] = provider_model
            outputs = getattr(response, "output_images", None)
            if isinstance(outputs, list):
                captured["output_image_count"] = len(outputs)
            captured["actual_usage"] = safe_usage(getattr(response, "usage", None))
            return response

    class Client:
        def __init__(self, api_key: str | None = None, **kwargs: Any):
            self.real = real_client_cls(api_key=api_key, http_options=http_options)
            self.interactions = Interactions(self.real)

        def close(self) -> None:
            close = getattr(self.real, "close", None)
            if callable(close):
                close()

    def factory(*args: Any, **kwargs: Any) -> Client:
        client = Client(*args, **kwargs)
        created.append(client)
        return client

    namespace = argparse.Namespace(
        prompt_file=task_rel(task, "prompt_file"),
        output=task_rel(task, "output"),
        reference=[],
        size=manifest["size"],
        aspect_ratio=manifest["aspect_ratio"],
        execute=True,
        max_cost_usd=float(reserve),
    )
    out, err = io.StringIO(), io.StringIO()
    original_client = genai.Client
    try:
        genai.Client = factory
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            rc = bridge.generate(namespace)
    finally:
        genai.Client = original_client

    provider_model = captured.get("provider_model")
    if provider_model is not None and provider_model != MODEL:
        return {
            "ok": False,
            "error_code": "PROVIDER_MODEL_MISMATCH",
            "captured": captured,
            "bridge_exit": rc,
        }
    if captured.get("output_image_count") not in (None, 1):
        return {
            "ok": False,
            "error_code": "UNEXPECTED_EXTRA_IMAGES",
            "captured": captured,
            "bridge_exit": rc,
        }
    meta = artifact_matches(task, manifest, root)
    if rc == 0 and meta is None:
        return {
            "ok": False,
            "error_code": "ARTIFACT_NOT_VERIFIED",
            "captured": captured,
            "bridge_exit": rc,
        }
    if rc != 0:
        code = "BRIDGE_FAILED"
        if captured.get("http_status") == 429:
            code = "HTTP_429"
        elif captured.get("http_status") == 400:
            code = "HTTP_400"
        return {
            "ok": False,
            "error_code": code,
            "captured": captured,
            "bridge_exit": rc,
        }
    # The image and manifest are already durable at this point.  If the
    # provider did not expose token usage or the output price basis is not the
    # known 0.0536 estimate, stop without starting another image.
    estimate = meta.get("estimated_usd_including_reserve")
    estimate_ok = False
    with contextlib.suppress(TypeError, ValueError):
        estimate_ok = abs(Decimal(str(estimate)) - BRIDGE_ESTIMATE) <= Decimal("0.0000001")
    if not usage_known(captured.get("actual_usage")) or not estimate_ok:
        return {
            "ok": False,
            "error_code": "STOP_BILLING_UNKNOWN",
            "captured": captured,
            "bridge_exit": 0,
            "meta": meta,
        }
    return {"ok": True, "captured": captured, "bridge_exit": 0, "meta": meta}


def require_execute_gates(manifest: dict) -> None:
    if manifest.get("approved_by_user") is not True:
        raise GuardError(
            "USER_APPROVAL_REQUIRED",
            "manifest.approved_by_user is false; root must approve this exact Phase1 batch",
        )
    if not str(manifest.get("approval_id", "")).strip():
        raise GuardError("APPROVAL_ID_REQUIRED", "manifest approval_id is empty")
    if os.environ.get("NANOBANANA_APPROVED") != "YES":
        raise GuardError("NANOBANANA_APPROVED_REQUIRED", "process env must be YES")
    if not os.environ.get("GEMINI_API_KEY"):
        raise GuardError("GEMINI_API_KEY_MISSING", "only read presence; value is never logged")
    if not VENV_PY.is_file():
        raise GuardError("VENV_PY_MISSING", str(VENV_PY))


def output_summary(manifest: dict, ledger: dict, planned: list[dict] | None = None) -> dict:
    entries = []
    for task in manifest["tasks"]:
        e = ledger["tasks"][task["task_id"]]
        entries.append({
            "taskid": e["taskid"],
            "skill": e["skill"],
            "status": e["status"],
            "output": e["output"],
            "reserved_usd": e["reserved_usd"],
            "cache_hit": e.get("cache_hit", False),
            "error_code": e.get("error_code"),
            "provider_response_id": e.get("provider_response_id"),
            "actual_billed_usd": e.get("actual_billed_usd"),
            "actual_usage": e.get("actual_usage"),
        })
    return {
        "batch_id": manifest["batch_id"],
        "approved_by_user": manifest.get("approved_by_user"),
        "approval_id": manifest.get("approval_id", ""),
        "model": manifest["model"],
        "size": manifest["size"],
        "aspect_ratio": manifest["aspect_ratio"],
        "tasks": entries,
        "planned_now": [t["task_id"] for t in (planned or [])],
        "reserved_total_usd": ledger.get("reserved_total_usd", 0.0),
        "committed_total_usd": ledger.get("committed_total_usd", 0.0),
        "actual_billed_total_usd": None,
        "actual_billing_status": "unavailable",
        "budget": manifest["budget"],
        "note": "Estimates/reservations are not a provider hard billing cap.",
    }


def cmd_init(args: argparse.Namespace) -> int:
    manifest = load_manifest(args.manifest)
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    with BatchLock(Path(args.lock)):
        path = Path(args.ledger)
        existed = path.exists()
        ledger = ensure_ledger(manifest, path, create=True)
        print(json.dumps({
            "status": "LEDGER_READY" if not existed else "LEDGER_EXISTING",
            "ledger": str(path),
            "manifest": str(args.manifest),
            "tasks": output_summary(manifest, ledger)["tasks"],
        }, ensure_ascii=False, indent=2))
    return 0


def cmd_dry_run(args: argparse.Namespace) -> int:
    manifest = load_manifest(args.manifest)
    if args.max_images > int(manifest["budget"]["max_images"]):
        raise GuardError("MAX_IMAGES_EXCEEDED", str(args.max_images))
    path = Path(args.ledger)
    ledger = ensure_ledger(manifest, path, create=False)
    planned, cached = build_plan(manifest, ledger, args.max_images)
    reserve = reserve_for(manifest)
    budget_check(manifest, ledger, reserve * len(planned))
    summary = output_summary(manifest, ledger, planned)
    prior = Decimal(str(manifest["budget"].get("prior_spend_usd", 0) or 0))
    summary.update({
        "status": "DRY_RUN_ONLY_NO_API_CALL",
        "cache_reused": [t["task_id"] for t in cached],
        "would_reserve_usd": float(reserve * len(planned)),
        "projected_committed_usd": float(
            prior + Decimal(str(ledger.get("committed_total_usd", 0)))
            + reserve * len(planned)
        ),
        "all_reservations_kept": True,
    })
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    manifest = load_manifest(args.manifest)
    ledger = ensure_ledger(manifest, Path(args.ledger), create=False)
    print(json.dumps(output_summary(manifest, ledger), ensure_ascii=False, indent=2))
    return 0


def cmd_execute(args: argparse.Namespace) -> int:
    manifest = load_manifest(args.manifest)
    require_execute_gates(manifest)
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    path = Path(args.ledger)
    with BatchLock(Path(args.lock)):
        ledger = ensure_ledger(manifest, path, create=True)
        if args.max_images > int(manifest["budget"]["max_images"]):
            raise GuardError("MAX_IMAGES_EXCEEDED", str(args.max_images))
        if reconcile(manifest, ledger):
            write_ledger(path, ledger)
        planned, cached = build_plan(manifest, ledger, args.max_images)
        write_ledger(path, ledger)
        reserve = reserve_for(manifest)
        budget_check(manifest, ledger, reserve * len(planned))
        if not planned:
            print(json.dumps({
                "status": "NOTHING_TO_DO",
                "ledger": str(path),
                "cache_reused": [t["task_id"] for t in cached],
            }, ensure_ascii=False, indent=2))
            return 0
        results = []
        for task in planned:
            entry = ledger["tasks"][task["task_id"]]
            entry["status"] = "reserved"
            entry["reserved_usd"] = float(reserve)
            entry["attempts"] = int(entry.get("attempts", 0)) + 1
            entry["started_utc"] = now_utc()
            entry["error_code"] = None
            write_ledger(path, ledger)  # durable reservation before any API call
            try:
                result = run_bridge(task, manifest, reserve)
            except Exception as exc:
                entry["status"] = "failed"
                entry["error_code"] = exc.code if isinstance(exc, GuardError) else "BRIDGE_UNEXPECTED"
                entry["bridge_error_type"] = type(exc).__name__
                http_status = getattr(exc, "status_code", None)
                if isinstance(http_status, int):
                    entry["bridge_http_status"] = http_status
                entry["actual_billed_usd"] = None
                entry["actual_billing_status"] = "unavailable"
                entry["finished_utc"] = now_utc()
                try:
                    meta = artifact_matches(task, manifest)
                    if meta is not None:
                        entry["output_sha256"] = meta.get("image_sha256")
                        entry["bridge_request_sha256"] = meta.get("request_sha256")
                except Exception:
                    pass
                write_ledger(path, ledger)
                print(json.dumps({
                    "status": "STOPPED_ON_FAILURE_NO_RETRY",
                    "ledger": str(path),
                    "taskid": task["task_id"],
                    "error_code": entry["error_code"],
                    "error_type": entry["bridge_error_type"],
                    "http_status": entry.get("bridge_http_status"),
                    "reserved_total_usd": ledger["reserved_total_usd"],
                    "committed_total_usd": ledger["committed_total_usd"],
                    "actual_billed_total_usd": None,
                    "actual_billing_status": "unavailable",
                    "note": "Unexpected bridge exception; reservation retained and no retry.",
                }, ensure_ascii=False, indent=2))
                return 3
            captured = result.get("captured", {})
            entry["actual_billed_usd"] = None
            entry["actual_billing_status"] = "unavailable"
            entry["provider_response_id"] = captured.get("provider_response_id")
            entry["actual_usage"] = captured.get("actual_usage")
            entry["finished_utc"] = now_utc()
            meta = result.get("meta")
            if meta is None:
                meta = artifact_matches(task, manifest)
            if meta is not None:
                entry["output_sha256"] = meta.get("image_sha256")
                entry["bridge_request_sha256"] = meta.get("request_sha256")
            if result["ok"]:
                entry["status"] = "succeeded"
                entry["error_code"] = None
                write_ledger(path, ledger)
                results.append({"taskid": task["task_id"], "status": "succeeded"})
                continue
            entry["status"] = "failed"
            entry["error_code"] = result.get("error_code", "BRIDGE_FAILED")
            write_ledger(path, ledger)
            results.append({
                "taskid": task["task_id"],
                "status": "failed",
                "error_code": entry["error_code"],
                "provider_response_id": entry["provider_response_id"],
                "actual_usage": entry["actual_usage"],
            })
            print(json.dumps({
                "status": "STOPPED_ON_FAILURE_NO_RETRY",
                "ledger": str(path),
                "results": results,
                "reserved_total_usd": ledger["reserved_total_usd"],
                "committed_total_usd": ledger["committed_total_usd"],
                "actual_billed_total_usd": None,
                "actual_billing_status": "unavailable",
                "note": "Reservation is retained; pending/failed tasks must not be resent automatically.",
            }, ensure_ascii=False, indent=2))
            return 3
        print(json.dumps({
            "status": "BATCH_DONE",
            "ledger": str(path),
            "results": results,
            "cache_reused": [t["task_id"] for t in cached],
            "reserved_total_usd": ledger["reserved_total_usd"],
            "committed_total_usd": ledger["committed_total_usd"],
            "actual_billed_total_usd": None,
            "actual_billing_status": "unavailable",
            "note": "Estimates/reservations are not a provider hard billing cap.",
        }, ensure_ascii=False, indent=2))
    return 0


def selftest() -> int:
    checks: list[str] = []
    tmp = Path(tempfile.mkdtemp(prefix="fusion-art-selftest-", dir=str(BATCH_DIR)))
    try:
        (tmp / "art/fusion/requests").mkdir(parents=True)
        (tmp / "art/fusion/candidates/fusion_selftest").mkdir(parents=True)
        prompt = tmp / "art/fusion/requests/fusion_selftest_main_v01.txt"
        prompt.write_text("selftest prompt\n", encoding="utf-8")
        base_task = {
            "task_id": "selftest-1",
            "skill": "fusion_selftest",
            "phase": "main",
            "prompt_file": "art/fusion/requests/fusion_selftest_main_v01.txt",
            "output": "art/fusion/candidates/fusion_selftest/main_v01.png",
        }
        manifest = {
            "version": 1, "batch_id": "selftest",
            "approved_by_user": False, "model": MODEL, "size": SIZE,
            "aspect_ratio": ASPECT,
            "budget": {
                "external_limit_usd": 3.0, "internal_stop_usd": 2.4,
                "max_images": 4, "per_image_reserve_usd": 0.0536,
                "prior_spend_usd": 0.0,
            },
            "tasks": [base_task],
        }
        lock_path = tmp / ".lock"
        lock1 = BatchLock(lock_path).acquire()
        try:
            BatchLock(lock_path).acquire()
            raise AssertionError("second lock acquired")
        except GuardError as exc:
            if exc.code != "LOCK_HELD":
                raise
        lock1.release()
        checks.append("exclusive-lock")
        lock_path.write_text('{"token":"unknown-owner"}\n', encoding="utf-8")
        try:
            BatchLock(lock_path).acquire()
            raise AssertionError("unknown lock acquired")
        except GuardError as exc:
            if exc.code != "LOCK_HELD":
                raise
        if "unknown-owner" not in lock_path.read_text(encoding="utf-8"):
            raise AssertionError("unknown lock modified")
        lock_path.unlink()
        checks.append("unknown-lock-not-stolen")

        ledger = new_ledger(manifest, tmp)
        budget_check(manifest, ledger, MIN_RESERVE)
        checks.append("budget-accept")
        tight = json.loads(json.dumps(manifest))
        tight["budget"]["internal_stop_usd"] = 0.05
        try:
            budget_check(tight, ledger, MIN_RESERVE)
            raise AssertionError("budget overrun accepted")
        except GuardError as exc:
            if exc.code != "BUDGET_STOP_INTERNAL":
                raise
        checks.append("budget-reject")

        actual_ledger = new_ledger(manifest, tmp)
        actual_entry = actual_ledger["tasks"]["selftest-1"]
        actual_entry["reserved_usd"] = 0.0536
        actual_entry["actual_billed_usd"] = 0.0600
        if entry_committed_usd(actual_entry) != Decimal("0.0600"):
            raise AssertionError("known actual not used in committed cost")
        tight_actual = json.loads(json.dumps(manifest))
        tight_actual["budget"]["internal_stop_usd"] = 0.055
        try:
            budget_check(tight_actual, actual_ledger, Decimal("0"))
            raise AssertionError("known actual overrun accepted")
        except GuardError as exc:
            if exc.code != "BUDGET_STOP_INTERNAL":
                raise
        checks.append("known-actual-cost-guard")

        entry = ledger["tasks"]["selftest-1"]
        entry["status"] = "reserved"
        entry["reserved_usd"] = 0.0536
        ledger_path = tmp / "ledger.json"
        write_ledger(ledger_path, ledger)
        loaded = read_json(ledger_path)
        if loaded["tasks"]["selftest-1"]["reserved_usd"] != 0.0536:
            raise AssertionError("reservation lost")
        if any(p.name.endswith(".tmp") for p in tmp.iterdir()):
            raise AssertionError("temporary file left behind")
        checks.append("atomic-persist-and-reservation")

        loaded["tasks"]["selftest-1"]["status"] = "failed"
        loaded["tasks"]["selftest-1"]["error_code"] = "SELFTEST_FAIL"
        write_ledger(ledger_path, loaded)
        try:
            build_plan(manifest, read_json(ledger_path), 0, tmp)
            raise AssertionError("failed task resent")
        except GuardError as exc:
            if exc.code != "RESUME_BLOCKED":
                raise
        if read_json(ledger_path)["tasks"]["selftest-1"]["reserved_usd"] != 0.0536:
            raise AssertionError("failed reservation was cleared")
        checks.append("failed-reservation-retained-no-resend")

        loaded = read_json(ledger_path)
        loaded["tasks"]["selftest-1"]["status"] = "pending"
        loaded["tasks"]["selftest-1"]["error_code"] = "INTERRUPTED_UNKNOWN"
        write_ledger(ledger_path, loaded)
        try:
            build_plan(manifest, read_json(ledger_path), 0, tmp)
            raise AssertionError("pending task resent")
        except GuardError as exc:
            if exc.code != "RESUME_BLOCKED":
                raise
        checks.append("pending-no-resend")

        output = tmp / base_task["output"]
        output.write_bytes(b"selftest-image")
        meta = {
            "model": MODEL, "prompt_sha256": sha256_file(prompt),
            "request_sha256": "req-selftest", "image_size": SIZE,
            "aspect_ratio": ASPECT, "image_sha256": sha256_file(output),
            "status": "ART_CANDIDATE",
        }
        manifest_of(base_task, tmp).write_text(json.dumps(meta), encoding="utf-8")
        ledger = new_ledger(manifest, tmp)
        planned, cached = build_plan(manifest, ledger, 0, tmp)
        if planned or len(cached) != 1 or ledger["tasks"]["selftest-1"]["status"] != "cached":
            raise AssertionError("cache not reused")
        if ledger["tasks"]["selftest-1"]["reserved_usd"] != 0.0:
            raise AssertionError("cache reserved again")
        checks.append("cache-reuse")

        task2 = dict(base_task)
        task2["task_id"] = "selftest-2"
        task2["output"] = "art/fusion/candidates/fusion_selftest/main_v02.png"
        task2["prompt_file"] = base_task["prompt_file"]
        manifest2 = json.loads(json.dumps(manifest))
        manifest2["tasks"] = [task2]
        ledger2 = new_ledger(manifest2, tmp)
        (tmp / task2["output"]).write_bytes(b"unrelated-existing-art")
        try:
            build_plan(manifest2, ledger2, 0, tmp)
            raise AssertionError("existing unverified file accepted")
        except GuardError as exc:
            if exc.code != "OUTPUT_EXISTS":
                raise
        checks.append("existing-file-no-overwrite")

        print(json.dumps({
            "status": "SELFTEST_PASS",
            "checks": checks,
            "api_calls": 0,
            "note": "Offline primitives only; no key or bridge call.",
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        print(json.dumps({
            "status": "SELFTEST_FAIL",
            "checks": checks,
            "error": f"{type(exc).__name__}: {exc}",
        }, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def require_canonical_batch_paths(args: argparse.Namespace) -> None:
    for label, value, expected in (
        ("manifest", args.manifest, DEFAULT_MANIFEST),
        ("ledger", args.ledger, DEFAULT_LEDGER),
        ("lock", args.lock, LOCK_PATH),
    ):
        if Path(value).resolve() != expected.resolve():
            raise GuardError(
                "NONCANONICAL_BATCH_PATH",
                f"{label} must be {expected}; one total batch ledger/lock only",
            )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--ledger", default=str(DEFAULT_LEDGER))
    parser.add_argument("--lock", default=str(LOCK_PATH))
    parser.add_argument("--max-images", type=int, default=0,
                        help="0 means all remaining tasks, capped by manifest max_images")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--init", action="store_true")
    group.add_argument("--dry-run", action="store_true")
    group.add_argument("--execute", action="store_true")
    group.add_argument("--status", action="store_true")
    group.add_argument("--selftest", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.selftest:
            return selftest()
        require_canonical_batch_paths(args)
        if args.init:
            return cmd_init(args)
        if args.dry_run:
            return cmd_dry_run(args)
        if args.status:
            return cmd_status(args)
        return cmd_execute(args)
    except GuardError as exc:
        print(json.dumps({
            "status": "STOP",
            "code": exc.code,
            "detail": exc.detail,
            "api_calls": 0,
        }, ensure_ascii=False, indent=2), file=sys.stderr)
        return exc.exit_code


if __name__ == "__main__":
    raise SystemExit(main())
