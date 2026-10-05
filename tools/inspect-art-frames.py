"""Read-only alpha/atlas inspection. Outputs metadata; never edits image pixels."""
import json
from pathlib import Path
from PIL import Image

base = ['player', 'player_walk1', 'player_walk2', 'ghost', 'runner', 'boss', 'mis', 'tank', 'shooter']
new = ['player_dash_v1', 'player_win_v1', 'player_kneel_v1']
atlases = [name + '_motion_v1' for name in base[3:]] + ['map_night_town_v1', 'map_rain_port_v1']
result = {}
for name in base + new + atlases:
    path = Path('assets/img') / (name + ('.webp' if name in base else '.png'))
    image = Image.open(path).convert('RGBA')
    columns = 2 if name in atlases else 1
    cell = image.width // columns
    frames = []
    for i in range(columns):
        alpha = image.getchannel('A').crop((i * cell, 0, (i + 1) * cell, image.height))
        bounds = alpha.point(lambda a: 255 if a > 8 else 0).getbbox()
        if not bounds:
            raise ValueError(f'{name} frame {i} is empty')
        left, top, right, bottom = bounds
        frames.append([left + i * cell, top, right - left, bottom - top, i * cell + cell / 2])
    result[name] = {'size': [image.width, image.height], 'bytes': path.stat().st_size,
                    'alpha': list(image.getchannel('A').getextrema()), 'frames': frames}
print(json.dumps(result, ensure_ascii=False, indent=2))
