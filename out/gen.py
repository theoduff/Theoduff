import numpy as np
from PIL import Image
W,H=1080,1350
rng=np.random.default_rng(7)
y,x=np.mgrid[0:H,0:W].astype(np.float32)
u,v=x/W,y/H
def blob(cx,cy,sx,sy,a):
    return a*np.exp(-(((u-cx)/sx)**2+((v-cy)/sy)**2))
D=(blob(-0.05,-0.02,0.35,0.30,1.0)+blob(1.05,0.0,0.25,0.18,0.85)
   +blob(1.02,0.36,0.18,0.14,0.9)+blob(0.62,0.44,0.20,0.07,0.35)
   +blob(0.33,0.63,0.20,0.09,1.0)+blob(-0.05,0.55,0.12,0.25,0.45)
   +blob(0.05,1.05,0.30,0.12,1.0)+blob(0.60,1.06,0.45,0.13,1.0)
   +blob(1.05,0.85,0.12,0.18,0.5))
D=np.clip(D,0,1)
# concentric rings centered near bottom
cx,cy=0.55*W,1.02*H
r=np.hypot(x-cx,y-cy)
period=16.0
ring=(0.5+0.5*np.cos(2*np.pi*r/period))**6
vis=np.clip((v-0.22)/0.25,0,1)*np.clip(1-D*0.8,0,1)*np.clip(r/120,0,1)
ring*=vis
# grain: stochastic dither of the density field
noise=rng.normal(0,1,(H,W)).astype(np.float32)
Dn=np.clip(D+0.28*noise+0.55*ring,0,1)
light=np.array([232,248,253],np.float32)
blue=np.array([18,152,222],np.float32)
img=light+(blue-light)*Dn[...,None]
img+=rng.normal(0,6,(H,W,1)).astype(np.float32)
Image.fromarray(np.clip(img,0,255).astype(np.uint8)).save('/home/user/Theoduff/out/insta_1080x1350.png',optimize=True)
Image.open('/home/user/Theoduff/out/insta_1080x1350.png').save('/home/user/Theoduff/out/insta_1080x1350.jpg',quality=97,subsampling=0)
