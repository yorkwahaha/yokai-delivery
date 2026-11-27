#!/usr/bin/env python3
"""Two extra Stage3 candidate variants to correct overly modern icon semantics."""
import generate_sakura_revised_icons as g
g.OUT=g.ROOT/"art/delivery-icons/sakura-pass/refined-20261116"
g.ITEMS={
 "ふえ": ("ONE authentic slender Japanese shinobue transverse bamboo flute, straight light bamboo tube placed horizontally at a slight angle, visible 7 small round dark finger holes AND one small side blowing opening on top, no large mouthpiece, no beaked recorder tip, no Western recorder, no extra instruments, no musical notes", "笛子"),
 "くすり": ("ONE old-fashioned Japanese medicinal packet: small open origami folded unprinted washi paper pouch containing three dark round herbal maruyaku pills and a tiny scattering of dried herb leaves, historical Japanese traditional medicine, simple clear inventory-object silhouette, no markings, no red cross, no modern pills or colorful pharmaceutical packaging", "藥")
}
if __name__=='__main__':g.run()
