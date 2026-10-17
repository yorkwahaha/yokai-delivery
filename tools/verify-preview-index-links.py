import os
import re
import sys

def verify_preview_links():
    index_path = os.path.join("art", "Preview_index.html")
    if not os.path.exists(index_path):
        print(f"[FAIL] {index_path} does not exist!")
        sys.exit(1)

    with open(index_path, "r", encoding="utf-8") as f:
        html = f.read()

    # Match all image references in src, href, and openLightboxDirect calls
    patterns = [
        r'src=["\']([^"\']+\.(?:png|webp|jpg|jpeg))["\']',
        r'href=["\']([^"\']+\.(?:png|webp|jpg|jpeg))["\']',
        r'openLightboxDirect\(["\']([^"\']+\.(?:png|webp|jpg|jpeg))["\']',
    ]

    found_refs = set()
    for p in patterns:
        for match in re.findall(p, html):
            # Exclude external http/https urls
            if not match.startswith("http://") and not match.startswith("https://"):
                found_refs.add(match)

    print(f"Auditing {len(found_refs)} unique image links in art/Preview_index.html...")

    missing = []
    valid = []
    for ref in sorted(found_refs):
        # Resolve relative to art/
        disk_path = os.path.join("art", ref.replace("/", os.sep))
        if os.path.exists(disk_path):
            valid.append((ref, disk_path, os.path.getsize(disk_path)))
        else:
            missing.append((ref, disk_path))

    print(f"Valid links on disk: {len(valid)} / {len(found_refs)}")
    if missing:
        print(f"[FAIL] Found {len(missing)} broken link(s):")
        for ref, dp in missing:
            print(f"  - Link: {ref} -> Missing on disk: {dp}")
        sys.exit(1)
    else:
        print("[SUCCESS] 100% of image links in art/Preview_index.html exist and are valid!")
        return 0

if __name__ == "__main__":
    verify_preview_links()
