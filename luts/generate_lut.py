import numpy as np, sys
from PIL import Image

def smooth(x,a,b):
    t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)

def grade(rgb, k=1.0):
    r,g,b = rgb[...,0],rgb[...,1],rgb[...,2]
    x = rgb.copy()
    # contraste doux (S-curve) autour de 0.45
    p=0.45; c=0.18*k
    x = x + c*(x-p)*(1-np.abs(2*x-1))*1.6
    # fade : noirs légèrement relevés, blancs adoucis
    x = 0.025*k + x*(1-0.025*k-0.02*k)
    L = 0.2126*x[...,0]+0.7152*x[...,1]+0.0722*x[...,2]
    sh = (1-smooth(L,0.0,0.45))[...,None]
    hi = smooth(L,0.5,1.0)[...,None]
    # split toning : ombres vert-bleu (teal), hautes lumières ambrées
    x = x + sh*np.array([-0.025,0.012,0.022])*k + hi*np.array([0.03,0.01,-0.03])*k
    # saturation : -10% global, mais on préserve les tons chair/orangés
    L = (0.2126*x[...,0]+0.7152*x[...,1]+0.0722*x[...,2])[...,None]
    mx=x.max(-1); mn=x.min(-1); d=mx-mn+1e-6
    R,G,B=x[...,0],x[...,1],x[...,2]
    h=np.where(mx==R,((G-B)/d)%6,np.where(mx==G,(B-R)/d+2,(R-G)/d+4))*60
    skin = np.exp(-((h-28)/22)**2)  # oranges / peau / calvados
    sat = 1 - 0.12*k + 0.10*k*skin
    x = L + (x-L)*sat[...,None]
    return np.clip(x,0,1)

N=33
def write(path,k,title):
    v=np.linspace(0,1,N)
    b,g,r=np.meshgrid(v,v,v,indexing='ij')   # R varie le plus vite
    grid=np.stack([r,g,b],-1).reshape(-1,3)
    out=grade(grid,k)
    with open(path,'w') as f:
        f.write(f'TITLE "{title}"\n# Rec709 -> Rec709, pas pour du LOG\nLUT_3D_SIZE {N}\nDOMAIN_MIN 0.0 0.0 0.0\nDOMAIN_MAX 1.0 1.0 1.0\n\n')
        for o in out: f.write(f'{o[0]:.6f} {o[1]:.6f} {o[2]:.6f}\n')

d=sys.argv[1]; imgs=sys.argv[2:]
write(f'{d}/Calvados_Warm_Teal.cube',1.0,'Calvados Warm Teal')
write(f'{d}/Calvados_Warm_Teal_Light.cube',0.6,'Calvados Warm Teal Light')
# preview avant/après
tiles=[]
for p in imgs:
    im=Image.open(p).convert('RGB'); im=im.resize((360,int(360*im.height/im.width)))
    a=np.asarray(im)/255.0
    tiles.append(np.concatenate([a,grade(a,1.0)],0))
Image.fromarray((np.concatenate(tiles,1)*255).astype(np.uint8)).save(f'{d}/preview_avant_apres.jpg',quality=88)
