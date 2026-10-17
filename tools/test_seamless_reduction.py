#!/usr/bin/env python3
"""
Test direct 1/3 rock reduction on user_ref using cv2.seamlessClone with pure dirt.
"""

import cv2
import numpy as np

img = cv2.imread(r'C:/Users/York/.gemini/antigravity/brain/fa1c8457-83da-4548-8d12-8cf54c19a2bc/.user_uploaded/media_1792128183978_6327dc38.jpg')
h, w, _ = img.shape

# Dirt patch 1 from Comp 1: pure sand dirt + fallen petals (y=60..170, x=240..390)
dirt1 = img[60:170, 240:390].copy()
dh1, dw1, _ = dirt1.shape

# Create a clean mask with a 6-pixel feathered boundary for seamlessClone
mask1 = np.ones((dh1, dw1), dtype=np.uint8) * 255
# In seamlessClone, mask must not touch the borders of src
mask1[0, :] = 0
mask1[-1, :] = 0
mask1[:, 0] = 0
mask1[:, -1] = 0

# Clone onto upper-right rock cluster (around x=670, y=140)
clone1 = cv2.seamlessClone(dirt1, img, mask1, (670, 140), cv2.NORMAL_CLONE)

# Dirt patch 2 from Comp 349: (y=590..700, x=690..830)
dirt2 = img[590:700, 690:830].copy()
dh2, dw2, _ = dirt2.shape
mask2 = np.ones((dh2, dw2), dtype=np.uint8) * 255
mask2[0, :] = 0
mask2[-1, :] = 0
mask2[:, 0] = 0
mask2[:, -1] = 0

# Clone onto lower-left rock cluster (around x=180, y=740)
clone2 = cv2.seamlessClone(dirt2, clone1, mask2, (180, 740), cv2.NORMAL_CLONE)

cv2.imwrite(r'C:\Users\York\.gemini\antigravity\brain\fa1c8457-83da-4548-8d12-8cf54c19a2bc\test_poisson_reduced.png', clone2)
print('Poisson reduction done!')
