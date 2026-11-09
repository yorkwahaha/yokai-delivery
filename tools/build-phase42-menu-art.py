"""Build local, text-free Phase42 UI pieces from licensed project raster art.

This deliberately reconstructs distinct panel/button sprites in RGBA rather
than painting tinted rectangles behind an opaque RGB button. The dynamic
labels and clickable geometry remain in the Canvas UI.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"assets/img/ui/phase42"
OUT.mkdir(parents=True,exist_ok=True)

def save(image,name):
    target=OUT/name
    image.save(target,format="WEBP",quality=94,method=6,exact=True)
    image=Image.open(target)
    print(str(target.relative_to(ROOT)),image.size,image.mode,target.stat().st_size,
          "corner-alpha",image.getpixel((0,0))[3])

def mask_button(path,kind):
    art=Image.open(path).convert("RGBA")
    w,h=art.size
    # Mask matches the pointed wood-and-washi silhouette. The B13 source
    # originally baked a pale/brick RGB rectangle around the actual button.
    # Feathered RGBA edges leave NO background-color box in the game.
    factor=4
    mask=Image.new("L",(w*factor,h*factor),0)
    m=ImageDraw.Draw(mask)
    pts=[(18,h*.50),(106,21),(w-148,18),(w-24,h*.38),
         (w-9,h*.53),(w-67,h-17),(105,h-17)]
    m.polygon([(round(x*factor),round(y*factor)) for x,y in pts],fill=255)
    mask=mask.resize((w,h),Image.Resampling.LANCZOS)
    art.putalpha(mask)
    # Add authentic warm gold edge into the RASTER (not geometric Canvas
    # stand-ins). The source's painted shading and sakura remain visible.
    trim=Image.new("RGBA",(w*factor,h*factor),(0,0,0,0))
    t=ImageDraw.Draw(trim)
    path2=[(20,h*.5),(107,25),(w-152,23),(w-28,h*.40),
           (w-13,h*.53),(w-70,h-22),(107,h-22)]
    t.line([(int(x*factor),int(y*factor)) for x,y in path2+[path2[0]]],
           fill=(226,181,103,165),width=6*factor,joint="curve")
    trim=trim.resize((w,h),Image.Resampling.LANCZOS)
    art=Image.alpha_composite(art,trim)
    # Never allow trim to recreate the old rectangular bounds.
    art.putalpha(Image.fromarray(__import__("numpy").minimum(
        __import__("numpy").array(art.getchannel("A")),
        __import__("numpy").array(mask))).convert("L"))
    return art

for kind,src in [
    ("button_normal.webp","assets/img/ui/b13/menu_button.webp"),
    ("button_danger.webp","assets/img/ui/b13/menu_button_danger.webp")
]:
    save(mask_button(ROOT/src,kind),kind)

def nine_slice(image,outsize,source=(78,67,78,67),border=(82,25,82,25)):
    iw,ih=image.size;ow,oh=outsize
    sl,st,sr,sb=source;dl,dt,dr,db=border
    xs=[0,sl,iw-sr,iw];ys=[0,st,ih-sb,ih]
    tx=[0,dl,ow-dr,ow];ty=[0,dt,oh-db,oh]
    result=Image.new("RGBA",(ow,oh),(0,0,0,0))
    for i in range(3):
        for j in range(3):
            crop=image.crop((xs[j],ys[i],xs[j+1],ys[i+1]))
            ww,hh=tx[j+1]-tx[j],ty[i+1]-ty[i]
            result.alpha_composite(crop.resize((ww,hh),Image.Resampling.LANCZOS),(tx[j],ty[i]))
    return result

# Framed Sakura parchment for the lower skill details, close to the approved
# light-washi + gilded-corner plaque, without baked-in words.
paper=Image.open(ROOT/"assets/img/ui/illustrated/result_panel.webp").convert("RGBA")
save(nine_slice(paper,(1168,188),source=(92,56,92,56),border=(104,43,104,43)),"detail_board.webp")

# The B13 menu_board was a BACKGROUND, not a complete wood-framed board.
# Nine-slicing it at runtime cuts branches, footer woodwork and mountains.
# Instead reconstruct two complete one-piece boards from the originals that
# actually have a painted frame on all four sides. Only the BLANK horizontal
# paper strip is stretched; the carved corners and flowers are never cropped.
def complete_framed_board(source, output_size, empty_strip):
    art=Image.open(ROOT/source).convert("RGBA")
    ow,oh=output_size
    margin=max(16,round(min(ow,oh)*.025))
    inner_w,inner_h=ow-2*margin,oh-2*margin
    sw,sh=art.size
    # Retain the source's full height / top and bottom frame in proportion.
    scale=inner_h/sh
    left_cut,right_cut=empty_strip
    left_w=round(left_cut*scale)
    right_w=round((sw-right_cut)*scale)
    middle_w=inner_w-left_w-right_w
    if middle_w<1:
        raise ValueError(f"{source} cannot fit {output_size} without cutting decoration")
    result=Image.new("RGBA",(ow,oh),(0,0,0,0))
    for x0,x1,dx,dw in [
        (0,left_cut,margin,left_w),
        (left_cut,right_cut,margin+left_w,middle_w),
        (right_cut,sw,margin+left_w+middle_w,right_w),
    ]:
        strip=art.crop((x0,0,x1,sh)).resize((dw,inner_h),Image.Resampling.LANCZOS)
        result.alpha_composite(strip,(dx,margin))
    return result

# 399x434 Canvas portrait, 608x310 Canvas landscape (at 2x resolution).
# Preserve entire original frame and several transparent pixels beyond it so
# edge shadows do not touch the clipping boundary of the rendered rectangle.
save(complete_framed_board(
    "assets/img/ui/illustrated/pause_panel.webp",(840,914),(115,211)
),"pause_board.webp")
save(complete_framed_board(
    "assets/img/ui/illustrated/result_panel.webp",(1260,650),(200,392)
),"exit_board.webp")

# Heading is a real lacquered strip with a complete gold border and
# transparent corners. The text is drawn dynamically in HanWang YanKai.
title=Image.open(ROOT/"assets/img/ui/illustrated/button_primary.webp").convert("RGBA")
save(nine_slice(title,(900,180),source=(80,20,80,20),border=(104,22,104,22)),"title_plaque.webp")
