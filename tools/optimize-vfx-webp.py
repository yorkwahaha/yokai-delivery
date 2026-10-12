"""Convert currently used VFX PNGs into quality-preserving alpha WebP assets."""
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
SRC=ROOT/'assets'/'img'/'vfx'
ASSET=ROOT/'js'/'assets.js'
USED={
    'purification_array_vfx','purification_array_lv5_vfx',
    'ofuda_projectile','ofuda_hit_burst','ofuda_max_burst',
    'thunder_cloud_vfx','thunder_sigil_vfx',
    'thunder_strike_vfx','thunder_strike_lv5_vfx',
}

def main():
    updated={}
    original=converted=0
    for stem in sorted(USED):
        png=SRC/(stem+'.png')
        webp=SRC/(stem+'.webp')
        if not png.exists():
            continue
        if webp.exists():
            with Image.open(png) as source, Image.open(webp) as encoded:
                silhouette=source.convert('RGBA').getchannel('A').getbbox()
                safe=(source.size==encoded.size
                      and silhouette==encoded.convert('RGBA').getchannel('A').getbbox()
                      and webp.stat().st_size<png.stat().st_size*.95)
            if safe:
                updated[png.name]=webp.name
                original+=png.stat().st_size
                converted+=webp.stat().st_size
                print('REUSE',webp.name)
            continue
        with Image.open(png) as source:
            image=source.convert('RGBA')
            size=image.size
            silhouette=image.getchannel('A').getbbox()
            image.save(webp,'WEBP',quality=92,method=6,exact=True)
        try:
            with Image.open(webp) as encoded:
                if encoded.size!=size or encoded.convert('RGBA').getchannel('A').getbbox()!=silhouette:
                    raise ValueError('alpha silhouette or dimensions changed')
            before=png.stat().st_size
            after=webp.stat().st_size
            if after>=before*.95:
                webp.unlink()
                print('SKIP, insufficient savings',png.name,before,after)
                continue
            original+=before
            converted+=after
            updated[png.name]=webp.name
            print('WEBP',png.name,before,'->',after)
        except BaseException:
            webp.unlink(missing_ok=True)
            raise
    if updated:
        for file in [ASSET,*sorted((ROOT/'tests').glob('*raster*.test.cjs'))]:
            if not file.exists(): continue
            old=file.read_text(encoding='utf8')
            new=old
            for png,webp in updated.items():
                new=new.replace(png,webp)
            if new!=old:
                file.write_text(new,encoding='utf8')
    print(f'TOTAL {len(updated)} images, {original} -> {converted} bytes, saved {original-converted} bytes')

if __name__=='__main__':
    main()
