"""Generate local DEV audio with the existing ComfyUI API and master it with FFmpeg."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import time
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "art/audio/stage58"
API = "http://127.0.0.1:8188"


def request(path, data=None, binary=False):
    headers = {"Content-Type": "application/json"} if data is not None else {}
    try:
        with urlopen(Request(API + path, data, headers), timeout=60) as response:
            return response.read() if binary else json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}: {error.read().decode(errors='replace')}") from error


def graph(row, seed):
    nodes = {}

    def add(kind, output=0, **inputs):
        key = str(len(nodes) + 1)
        nodes[key] = {"class_type": kind, "inputs": inputs}
        return [key, output]

    seconds = row["seconds"]
    if row["kind"] == "music":
        model = add("UNETLoader", unet_name="acestep_v1.5_xl_turbo_bf16.safetensors", weight_dtype="default")
        model = add("ModelSamplingAuraFlow", model=model, shift=3.0)
        vae = add("VAELoader", vae_name="ace_1.5_vae.safetensors")
        clip = add("DualCLIPLoader", clip_name1="qwen_0.6b_ace15.safetensors",
                   clip_name2="qwen_4b_ace15.safetensors", type="ace")
        positive = add("TextEncodeAceStepAudio1.5", clip=clip, tags=row["prompt"],
                       lyrics="[Instrumental]", seed=seed, bpm=row["bpm"], duration=seconds,
                       timesignature=row.get("meter", "4"), language="unknown",
                       keyscale=row["key"], generate_audio_codes=True, cfg_scale=2.0,
                       temperature=.85, top_p=.9, top_k=0, min_p=0.0)
        negative = add("ConditioningZeroOut", conditioning=positive)
        latent = add("EmptyAceStep1.5LatentAudio", seconds=seconds, batch_size=1)
        sampler = "euler"
    else:
        model = add("CheckpointLoaderSimple", ckpt_name="stable_audio_3_medium.safetensors")
        vae = [model[0], 2]
        clip = add("CLIPLoader", clip_name="t5gemma_b_b_ul2.safetensors", type="stable_audio", device="default")
        positive = add("CLIPTextEncode", clip=clip, text=row["prompt"])
        negative = add("CLIPTextEncode", clip=clip, text="")
        latent = add("EmptyLatentAudio", seconds=max(1, seconds), batch_size=1)
        sampler = "lcm"

    samples = add("KSampler", model=model, positive=positive, negative=negative, latent_image=latent,
                  seed=seed, steps=8, cfg=1.0, sampler_name=sampler, scheduler="simple", denoise=1.0)
    audio = add("VAEDecodeAudio", samples=samples, vae=vae)
    add("SaveAudio", audio=audio, filename_prefix=f"audio/yokai-stage58/{row['id']}-{seed}")
    return nodes


def render(row, seed):
    raw = WORK / "raw" / f"{row['id']}-{seed}.flac"
    raw.parent.mkdir(parents=True, exist_ok=True)
    if raw.exists():
        return raw
    waveform = graph(row, seed)
    raw.with_suffix(".json").write_text(json.dumps(waveform, indent=2), encoding="utf-8")
    response = request("/prompt", json.dumps({"prompt": waveform}).encode())
    prompt_id = response["prompt_id"]
    print(f"queued {row['id']} seed {seed}: {prompt_id}", flush=True)
    deadline = time.monotonic() + 1200
    while time.monotonic() < deadline:
        time.sleep(2)
        result = request(f"/history/{prompt_id}").get(prompt_id)
        if not result:
            continue
        for output in result["outputs"].values():
            for entry in output.get("audio", []):
                raw.write_bytes(request("/view?" + urlencode(entry), binary=True))
                return raw
        raise RuntimeError(result.get("status"))
    raise TimeoutError(prompt_id)


def ffmpeg(*args):
    command = ["ffmpeg", "-hide_banner", "-nostats", "-nostdin", *map(str, args)]
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode:
        raise RuntimeError(f"FFmpeg {result.returncode}: {result.stderr[-1400:]}")
    return result.stderr


def duration(file):
    return float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(file)
    ], text=True).strip())


def levels(file, threshold, minimum, filters="anull"):
    log = ffmpeg("-i", file, "-af", f"{filters},silencedetect=n={threshold}dB:d={minimum},volumedetect", "-f", "null", "-")
    starts = [float(number) for number in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(number) for number in re.findall(r"silence_end: ([\d.]+)", log)]
    peak = float(re.search(r"max_volume: (-?[\d.]+) dB", log)[1])
    mean = float(re.search(r"mean_volume: (-?[\d.]+) dB", log)[1])
    return peak, mean, list(zip(starts, ends))


def window(row, raw):
    length = duration(raw)
    bed = row["kind"] != "effect"
    threshold = -49 if row["kind"] == "ambience" else -39
    peak, mean, gaps = levels(raw, threshold, .35 if bed else .035)
    start, end = 0, length
    if gaps and gaps[0][0] < .008:
        start = max(0, gaps[0][1] - (.045 if bed else .006))
    if gaps and gaps[-1][1] >= length - .04:
        end = min(length, gaps[-1][0] + (.12 if bed else .07))
    if not bed:
        end = min(end, start + row["seconds"])
    interior = max((b - a for a, b in gaps if start + .14 < a and b < end - .14), default=0)
    minimum = (.78 * row["seconds"] if bed else .17)
    if peak <= -56 or mean <= -64 or end - start < minimum or (bed and interior > 3):
        raise ValueError(f"weak candidate: peak {peak} dBFS, usable {end-start:.2f}s, largest internal gap {interior:.2f}s")
    # Prefer a good-length bed and favor a prompt transient with headroom for one-shots.
    score = min(1, (end - start) / row["seconds"]) - min(.4, interior * .1) - min(.45, start * .3)
    return score, start, end


def master(row, seed_offsets):
    target = ROOT / row["path"]
    if target.is_file():
        return None
    usable = []
    for offset in seed_offsets:
        seed = row["seed"] + offset
        raw = WORK / "raw" / f"{row['id']}-{seed}.flac"
        if not raw.is_file():
            continue
        try:
            score, start, end = window(row, raw)
            usable.append((score, -offset, start, end, raw))
        except ValueError as error:
            print(f"skip {raw.name}: {error}", flush=True)
    if not usable:
        raise ValueError("No raw take passed the audio checks")
    _, offset, start, end, raw = max(usable)
    length = end - start
    mono = row["kind"] == "effect"
    trim = f"atrim=start={start:.6f}:end={end:.6f},asetpts=PTS-STARTPTS"
    remix = ",pan=mono|c0=0.5*c0+0.5*c1" if mono else ""
    peak, mean, _ = levels(raw, -60, .2, trim + remix)
    target_mean = -20 if row["kind"] == "music" else -25 if not mono else -23 if row["priority"] == "P0" else -28
    gain = min(target_mean - mean, -2.3 - peak, 14)
    chain = f"[0:a]{trim}{remix},volume={gain:.2f}dB,aresample=44100"
    join = 0
    if row.get("loop"):
        join = .85 if row["kind"] == "ambience" else .09
        chain += (f",asplit=3[a][b][c];[a]atrim=start={join}:end={length-join:.6f},asetpts=PTS-STARTPTS[body];"
                  f"[b]atrim=start={length-join:.6f},asetpts=PTS-STARTPTS[tail];"
                  f"[c]atrim=end={join},asetpts=PTS-STARTPTS[head];"
                  f"[tail][head]acrossfade=d={join}:c1=tri:c2=tri[seam];[body][seam]concat=n=2:v=0:a=1[out]")
    else:
        fade = min(.36 if not mono else .065, length / 4)
        chain += f",afade=d={.012 if not mono else .002},afade=t=out:st={length-fade:.6f}:d={fade}[out]"
    target.parent.mkdir(parents=True, exist_ok=True)
    working = target.with_suffix(".part.mp3")
    ffmpeg("-y", "-i", raw, "-filter_complex", chain, "-map", "[out]", "-codec:a", "libmp3lame",
           "-map_metadata", "-1", "-b:a", "96k" if mono else "160k" if row["kind"] == "music" else "128k", working)
    out_length = duration(working)
    out_peak, out_mean, gaps = levels(working, -58, .2)
    if out_peak >= -.5 or out_mean < -56:
        raise ValueError(f"Encoded track failed level check: peak {out_peak}, mean {out_mean}")
    working.replace(target)
    return {"seed": row["seed"] - offset, "duration": round(out_length, 3),
            "raw": raw.name, "trim": [round(start, 3), round(end, 3)], "seamSeconds": join,
            "peakDbfs": out_peak, "meanDbfs": out_mean, "gainDb": round(gain, 2),
            "silenceIntervals": gaps, "bytes": target.stat().st_size,
            "model": "ACE-Step 1.5 XL Turbo" if row["kind"] == "music" else "Stable Audio 3 Medium"}


def verify(row):
    target = ROOT / row["path"]
    if not target.is_file():
        raise ValueError("Missing runtime MP3")
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "a:0",
        "-show_entries", "stream=sample_rate,channels,codec_name:format=duration", "-of", "json", target
    ], text=True))
    stream = probe["streams"][0]
    channels = 1 if row["kind"] == "effect" else 2
    if (stream["codec_name"], stream["sample_rate"], stream["channels"]) != ("mp3", "44100", channels):
        raise ValueError(f"Unexpected decoded format {stream}")
    log = ffmpeg("-xerror", "-i", target, "-af", "ebur128=peak=true", "-f", "null", "-")
    true_peaks = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", log)
    if not true_peaks or float(true_peaks[-1]) >= -1:
        raise ValueError("True peak exceeds -1 dBTP or measurable PCM was absent")
    peak, mean, gaps = levels(target, -58, .2)
    longest = max((end - start for start, end in gaps), default=0)
    if mean < -56 or longest > (3 if row["kind"] != "effect" else .65):
        raise ValueError(f"Signal level {mean} dBFS or silence span {longest:.2f}s out of range")
    result = {"duration": float(probe["format"]["duration"]), "channels": channels,
              "sampleRate": 44100, "truePeakDbtp": float(true_peaks[-1]), "meanDbfs": mean,
              "peakDbfs": peak, "maxSilenceSeconds": round(longest, 4),
              "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}
    if row["loop"]:
        pcm_format = ["-c:a", "pcm_s16le", "-f", "s16le", "-"]
        extract = ["ffmpeg", "-v", "error", "-xerror", "-nostdin"]
        head = subprocess.check_output([*extract, "-i", target, "-t", "0.08", *pcm_format])
        tail = subprocess.check_output([*extract, "-sseof", "-0.08", "-i", target, *pcm_format])
        first = struct.unpack_from("<" + "h" * channels, head)
        last = struct.unpack_from("<" + "h" * channels, tail, len(tail) - channels * 2)
        result["loopBoundaryStep"] = round(max(abs(a-b) for a, b in zip(first, last)) / 32768, 5)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ids", nargs="*")
    parser.add_argument("--seed-offset", type=int, default=0)
    parser.add_argument("--sample", action="store_true", help="Render 35 seconds of music for evaluation")
    parser.add_argument("--render-seconds", type=float, help="Override the ComfyUI latent duration for a new take")
    parser.add_argument("--master", action="store_true", help="Postprocess existing raw renders")
    parser.add_argument("--verify", type=Path, metavar="REPORT", help="Decode all selected final MP3s and write a QA report")
    parser.add_argument("--alternate-offset", type=int, action="append", default=[])
    args = parser.parse_args()
    rows = json.loads(subprocess.check_output(
        ["node", "-p", "JSON.stringify(require('./js/stage58-audio.js').entries)"], cwd=ROOT, encoding="utf-8"))
    if set(args.ids) - {row["id"] for row in rows}:
        parser.error("Unknown audio event")
    failures = []
    manifest = WORK / "production.json"
    results = json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else {}
    verified = {}
    for row in rows:
        if args.ids and row["id"] not in args.ids:
            continue
        row = dict(row)
        if args.render_seconds is not None and not args.master:
            row["seconds"] = args.render_seconds
        elif args.sample and row["kind"] == "music":
            row["seconds"] = 35
        try:
            if args.verify:
                verified[row["path"]] = verify(row)
            elif args.master:
                result = master(row, [args.seed_offset, *args.alternate_offset])
                if result:
                    results[row["path"]] = result
                    working = manifest.with_suffix(".tmp")
                    working.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
                    working.replace(manifest)
                    print(f"mastered {row['id']}: {result['duration']}s, {result['peakDbfs']} dBFS peak", flush=True)
            else:
                render(row, row["seed"] + args.seed_offset)
        except Exception as error:
            failures.append(row["id"])
            print(f"{row['id']}: {error}", flush=True)
    if args.verify:
        args.verify.parent.mkdir(parents=True, exist_ok=True)
        args.verify.write_text(json.dumps({"files": verified, "failed": failures}, indent=2) + "\n", encoding="utf-8")
        print(f"Decoded and validated {len(verified)} files, {len(failures)} failed", flush=True)
    if failures:
        raise SystemExit(f"Failed: {', '.join(failures)}")


if __name__ == "__main__":
    main()
