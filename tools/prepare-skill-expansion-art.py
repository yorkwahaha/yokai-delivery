"""Generate isolated skill candidates on this machine's already-running ComfyUI."""
import hashlib
import io
import json
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from PIL import Image, ImageChops, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "art" / "skill-expansion-10-13"
SERVER = "http://127.0.0.1:8188"
MODEL = "reedIllustrationIL_v80IL_s30c5e.safetensors"
STYLE = (
    "Japanese Edo ukiyo-e woodblock print crossed with sumi-e ink painting, "
    "strong hand-drawn black ink outlines, stippled sumi shadows, visible dry brush, "
    "handmade fibrous washi printing texture, limited hand-pulled pigments, compact "
    "slightly chibi game proportions, original yokai courier game spell, boldly legible silhouette"
)
NEGATIVE = (
    "letters, kanji, signature, watermark, legend, caption, card frame, borders, game UI, "
    "logo, 3d render, photorealism, plastic, gradients, screenshot, anime girl, person, busy scenery"
)
CARDS = {
    "hamaya": {
        "main": "ceremonial curved Japanese yumi spirit bow and one gold-white fletched arrow, diagonal from lower left, folded white paper streamers",
        "distance": "very long gold arrow crossing distant mist and three ink mountain silhouettes toward a small target of light",
        "armor": "gold-white sacred arrow cracking a heavy iron and black lacquer armor plate in one bright strike",
        "twin": "two distinctly separated gold arrows following the same route, a thick leader and its thinner echo",
        "quick": "taut white bowstring with a golden arrow released in one short explosive flash, cropped close-up of the grip",
    },
    "spider_silk": {
        "main": "three clearly separated crimson and pearl-pink silk strands suspended from three spider-silk knots, intersecting into a ritual triangular web",
        "bind": "scarlet and pearl-pink spider silk winding around the ankles of two small ink shadow yokai, sticky fiber at the knots",
        "range": "long ruby-red and pearl-pink spider silk stretched between two widely separated knots, visibly taut across the page",
        "blade": "oblique crimson spider silk slices a dark leaf and a shadow mask, glowing white edge with broken ink",
        "return": "snapped silky strands recoil inward into a bright vermilion scissor-shaped cut, central ink-spatter",
    },
    "ice_ball": {
        "main": "single round blue-white ice crystal orb with thick facets and an arcing zig-zag bounce trail, powdery icy chips",
        "chain": "one clear cyan-blue crystal orb skipping between three small numbered-free points of light in a zigzag",
        "weight": "dense heavy sapphire ice sphere hitting and cracking gray stone with a short cyan impact plume",
        "shards": "crystalline snow orb bursting radially into distinct long cyan and white shards at its final impact",
        "speed": "round icy sapphire orb with sharp curved cyan motion trails and wind streaks suggesting a sharp change of direction",
    },
    "wind_hole": {
        "main": "low broad spiral of dark ink and blue teal wind, an open pale center through which the floor is visible, few washi scraps and leaves",
        "range": "very wide flattened spreading blue-green streamer spiral curling toward a clear center from the edges",
        "linger": "sustained teal blue ink vortex with three loosely stacked spiral turns and drifting washi scraps in midair",
        "burst": "compressed teal wind spirals snapping outward into broken sumi rings and very sharp cyan wind pressure marks",
        "twin": "large blue-green wind vortex opening into one smaller pale sibling vortex, two visibly open centers and ink foliage",
    },
}
EFFECTS = {
    "hamaya": {
        "draw": "floating golden Japanese yumi bow with luminous taut white string and a bright point along the bow grip",
        "arrow": "one single long slim sacred fletched golden arrow pointing perfectly to the right, horizontal, short luminous wisps trailing on the left",
        "awaken": "one massive very wide arrowhead and heavy golden-white spiritual projectile with gold brush wake, pointing perfectly to the right, strictly horizontal",
        "impact": "compact gold-white sacred arrow impact flash with just a few isolated ink-brushed gold flecks",
        "heavy": "large fractured gold-white circular impact with jagged ink-lined lightning and flying paper seals with no writing",
    },
    "spider_silk": {
        "thread": "single continuous narrow perfectly horizontal ribbon of pink-white glowing spider silk across the middle, twisted vermilion fiber, no objects or web junctions",
        "bind": "compact bright vermilion and pearl-pink spider silk knot, three tightly wound scarlet strands and a few delicate fibers",
        "cut": "small horizontal red-pink silk cut spark with three hair-thin white fibers, sharp bright center",
        "collapse": "sweeping wide red-pink triangular spider web contracting inward into crossed cutting strands, very open negative space",
    },
    "ice_ball": {
        "ball": "single isolated bright ice blue crystal ball, round solid faceted orb, white rim and cyan translucent inner facets, minimal surrounding dust",
        "cast": "short icy cyan launch puff and a tight arc of white crystal chips, compact and clean",
        "impact": "small ice-blue radial crystal impact splash, brief cyan burst and coarse pale shards",
        "shard": "single horizontal cyan-white shard pointing precisely right, short steel-blue wake and sharp tip",
        "shatter": "large radial array of distinct icy cyan-white crystal fragments from an exploded sphere, clear open center and short ink streaks",
    },
    "wind_hole": {
        "field": "top-down perfectly circular wispy teal dark-ink vortex, very transparent-looking open black center, no solid disc, painted spiraling gusts and sparse bright blue-green contours",
        "compress": "top-down tightening teal-white spiral rings pulled forcefully inward, open black middle, thin blue-green rims in dry brush",
        "burst": "top-down explosion of teal ink air pressure in a sparse shattered streaked circular ring, mostly open black center, small washi bits",
    },
}


def endpoint(route, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    return urlopen(Request(SERVER + route, data=data, headers={"Content-Type": "application/json"}), timeout=20)


def generate(positive, negative, seed, width, height, key):
    def node(kind, **inputs):
        return {"class_type": kind, "inputs": inputs}

    workflow = {
        "1": node("CheckpointLoaderSimple", ckpt_name=MODEL),
        "2": node("CLIPTextEncode", text=positive, clip=["1", 1]),
        "3": node("CLIPTextEncode", text=negative, clip=["1", 1]),
        "4": node("EmptyLatentImage", width=width, height=height, batch_size=1),
        "5": node("KSampler", model=["1", 0], positive=["2", 0], negative=["3", 0], latent_image=["4", 0],
                  seed=seed, steps=16, cfg=5.2, sampler_name="dpmpp_2m", scheduler="karras", denoise=1.0),
        "6": node("VAEDecode", samples=["5", 0], vae=["1", 2]),
        "7": node("SaveImage", images=["6", 0], filename_prefix="yokai-skill-expansion/" + key),
    }
    with endpoint("/prompt", {"prompt": workflow}) as response:
        prompt_id = json.load(response)["prompt_id"]
    deadline = time.monotonic() + 210
    while time.monotonic() < deadline:
        with endpoint("/history/" + prompt_id) as response:
            record = json.load(response).get(prompt_id)
        if record:
            if record["status"]["status_str"] != "success":
                raise RuntimeError(json.dumps(record["status"], ensure_ascii=False))
            image = record["outputs"]["7"]["images"][0]
            with endpoint("/view?" + urlencode(image)) as response:
                return response.read()
        time.sleep(1)
    raise TimeoutError("ComfyUI result timed out for " + key + " (" + prompt_id + ")")


def transparent(source):
    red, green, blue = source.split()
    light = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    alpha = light.point(lambda v: 0 if v < 27 else min(255, round((v - 27) * 1.9)))
    # A dark subject edge can remain translucent. The black matte vanishes.
    if not alpha.getbbox():
        raise ValueError("VFX has no usable foreground")
    image = source.convert("RGBA")
    image.putalpha(alpha)
    bounds = alpha.point(lambda v: 255 if v >= 80 else 0).getbbox()
    if bounds:
        image = image.crop(bounds)
        image = ImageOps.expand(image, border=6)
    image.thumbnail((432, 432), Image.Resampling.LANCZOS)
    return image


def save_manifest(manifest):
    target = DEST / "manifest.json"
    temp = target.with_suffix(".tmp")
    temp.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temp.replace(target)


def main():
    for folder in ("raw", "cards", "icons", "vfx"):
        (DEST / folder).mkdir(parents=True, exist_ok=True)
    path = DEST / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {
        "status": "ART_CANDIDATE_USER_REVIEW_PENDING",
        "tool": "local ComfyUI",
        "model": MODEL,
        "license": "candidate review only; checkpoint distribution terms pending",
        "sampler": {"steps": 16, "cfg": 5.2, "sampler": "dpmpp_2m", "scheduler": "karras"},
        "assets": {},
    }
    save_manifest(manifest)
    jobs = [(id, "cards", "main", art["main"]) for id, art in CARDS.items()]
    jobs += [(id, "vfx", role, subject) for id, art in EFFECTS.items() for role, subject in art.items()]
    jobs += [(id, "cards", role, subject) for id, art in CARDS.items() for role, subject in art.items() if role != "main"]
    for id, folder, role, subject in jobs:
        skill = id.replace("_", "-")
        key = (id if role == "main" else "mut_" + id + "_" + role) if folder == "cards" else id + ":" + role
        stem = skill + "__" + ("art" if folder == "cards" else role)
        if folder == "cards" and role != "main":
            stem += "__" + role
        out = DEST / folder / (stem + ".webp")
        raw = DEST / "raw" / (stem + ".png")
        if key in manifest["assets"] and out.is_file():
            continue
        vfx = folder == "vfx"
        wide = vfx and role in {"thread", "arrow", "awaken", "shard", "cut"}
        dims = (704, 352) if wide else (576, 576) if vfx else (672, 864)
        layout = ("isolated centered game VFX sprite fully inside the image, no floor and no shadow, "
                  "pure flat pitch black RGB 0 background for alpha matting, high-contrast bright edges") if vfx else (
                  "portrait illustration, central focal silhouette with generous margins, rustic cream washi background, no title")
        positive = f"{subject}, {STYLE}, {layout}"
        seed = int.from_bytes(hashlib.sha256(key.encode()).digest()[:4], "big")
        if not raw.is_file():
            raw.write_bytes(generate(positive, NEGATIVE, seed, *dims, stem))
        source = Image.open(io.BytesIO(raw.read_bytes())).convert("RGB")
        image = transparent(source) if vfx else ImageOps.fit(source, (416, 544), method=Image.Resampling.LANCZOS)
        image.save(out, quality=86, method=6)
        info = {"path": out.relative_to(ROOT).as_posix(), "raw": raw.relative_to(ROOT).as_posix(),
                "seed": seed, "prompt": positive, "negative": NEGATIVE, "size": image.size,
                "sha256": hashlib.sha256(out.read_bytes()).hexdigest(), "alpha": vfx, "labUse": False}
        manifest["assets"][key] = info
        if folder == "cards" and role == "main":
            icon = DEST / "icons" / (skill + "__icon.webp")
            ImageOps.fit(source, (96, 96), method=Image.Resampling.LANCZOS).save(icon, quality=87, method=6)
            manifest["assets"][id + ":icon"] = {
                "path": icon.relative_to(ROOT).as_posix(), "derivedFrom": info["raw"],
                "size": [96, 96], "sha256": hashlib.sha256(icon.read_bytes()).hexdigest(),
                "alpha": False, "labUse": False,
            }
        save_manifest(manifest)
        print(f"{key}: {image.size[0]} × {image.size[1]}", flush=True)


if __name__ == "__main__":
    main()
