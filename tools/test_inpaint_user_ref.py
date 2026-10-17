#!/usr/bin/env python3
"""
Test inpainting stones from user_ref to create 100% pure authentic trampled dirt.
"""

import cv2
import numpy as np

src_path = r'C:/Users/York/.gemini/antigravity/brain/fa1c8457-83da-4548-8d12-8cf54c19a2bc/.user_uploaded/media_1792128183978_6327dc38.jpg'
img = cv2.imread(src_path)

# Let's detect flowers and stones
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
red1 = cv2.inRange(hsv, np.array([0, 70, 40]), np.array([14, 255, 255]))
red2 = cv2.inRange(hsv, np.array([165, 70, 40]), np.array([180, 255, 255]))
flowers = cv2.bitwise_or(red1, red2)

diff_rg = np.abs(img[:,:,2].astype(float) - img[:,:,1].astype(float))
diff_gb = np.abs(img[:,:,1].astype(float) - img[:,:,0].astype(float))
stone_mask = (diff_rg < 25) & (diff_gb < 25) & (img[:,:,2] < 160)

non_dirt = (flowers > 0) | stone_mask
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
mask_to_inpaint = cv2.dilate(non_dirt.astype(np.uint8), kernel)

print('Mask to inpaint %:', np.mean(mask_to_inpaint > 0) * 100)
inpainted = cv2.inpaint(img, mask_to_inpaint * 255, 7, cv2.INPAINT_TELEA)
cv2.imwrite(r'C:\Users\York\.gemini\antigravity\brain\fa1c8457-83da-4548-8d12-8cf54c19a2bc\test_inpainted_dirt.png', inpainted)
print('Inpainting done!')
