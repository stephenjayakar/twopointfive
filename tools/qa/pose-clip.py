# A SCENE OF tools/qa/close-stills.ts AS IT MOVES, WITHOUT A GPU: every PLY of a scene taken every second frame (`stalk-clip`) drawn by pose-mesh-raster.py's
# rasteriser, the view following Sam, and put together at 30 frames a second with ffmpeg.
#   python3 -I tools/qa/pose-clip.py <scene.json> --out clip.mp4 [--tile 420] [--beside footage.mp4] [--procs 4]
# Five views side by side: over his shoulder from behind and above, as the footage's camera has him, then the game camera's own pitch from behind him, from each side and
# from the front, because the game's camera sees him from all of them and the footage only from behind (a pose that reads from behind can read as arms held out from the side). --beside puts a clip
# to the left of them, cut to the tile's height and looped. What it cannot show: light, cloth, the page's own camera.
import importlib.util, json, math, multiprocessing, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw
spec = importlib.util.spec_from_file_location('raster', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pose-mesh-raster.py')); R = importlib.util.module_from_spec(spec); spec.loader.exec_module(R)
VIEWS = [('from behind and above', R.view_basis(12, 42), 1.0), ('behind', R.view_basis(25, 55), 1.3), ('his left', R.view_basis(115, 55), 1.3), ('in front', R.view_basis(205, 55), 1.3), ('his right', R.view_basis(295, 55), 1.3)]

def one(job):
    k, label, path, tile, out = job
    P, C, slot, F = R.read_ply(path); m = slot == 0
    centre = np.array([P[m, 0].mean(), 0.55, P[m, 2].mean()])
    img = Image.new('RGB', (tile * len(VIEWS), tile))
    for i, (_, basis, half) in enumerate(VIEWS): img.paste(R.draw(P, C, slot, F, basis, tile, centre, half), (i * tile, 0))
    d = ImageDraw.Draw(img); d.text((6, 6), label, fill=(30, 30, 30))
    for i, (name, _, _) in enumerate(VIEWS): d.text((i * tile + 6, tile - 16), name, fill=(30, 30, 30))
    img.save(f'{out}/{k:04d}.png')

def main():
    a = sys.argv[1:]; opt = lambda n, v: a[a.index(n) + 1] if n in a else v
    src = a[0]; out = opt('--out', 'clip.mp4'); tile = int(opt('--tile', '420')); beside = opt('--beside', ''); procs = int(opt('--procs', str(os.cpu_count() or 2)))
    meta = json.load(open(src)); base = os.path.dirname(os.path.abspath(src))
    with tempfile.TemporaryDirectory() as t:
        with multiprocessing.Pool(procs) as pool: pool.map(one, [(k, s['label'], os.path.join(base, s['file']), tile, t) for k, s in enumerate(meta['shots'])])
        ins = ['-framerate', '30', '-i', f'{t}/%04d.png']; vf = []
        if beside: ins = ['-stream_loop', '-1', '-i', beside] + ins; vf = ['-filter_complex', f'[0:v]fps=30,scale=-2:{tile}[l];[l][1:v]hstack=shortest=1[v]', '-map', '[v]']
        subprocess.check_call(['ffmpeg', '-v', 'error', '-y', *ins, *vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out])
    print(out, len(meta['shots']), 'frames')
main()
