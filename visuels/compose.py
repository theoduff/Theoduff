import cv2,numpy as np
from PIL import Image
rng=np.random.default_rng(7)
CW,CH=2160,2700; S=CW/736; EXT=184
src=cv2.imread('scene_x4.png').astype(np.float32)
# ---------- wall ----------
regions=[src[2000:2944,0:600],src[2050:2944,2200:2944],src[0:370,0:2944]]
det=[r-cv2.GaussianBlur(r,(0,0),30) for r in regions]
tsd=np.mean([d.std() for d in det])
P=360; tex=np.zeros((CH,CW,3),np.float32); wsum=np.zeros((CH,CW,1),np.float32)
win=np.outer(np.hanning(P),np.hanning(P))[...,None].astype(np.float32)+1e-3
step=P//2
for y in range(-step,CH,step):
  for x in range(-step,CW,step):
    d=det[rng.integers(len(det))]; h,w=d.shape[:2]
    yy=rng.integers(0,h-P); xx=rng.integers(0,w-P); p=d[yy:yy+P,xx:xx+P]
    if rng.random()<.5: p=p[:,::-1]
    if rng.random()<.5: p=p[::-1]
    y0,x0=max(y,0),max(x,0); y1,x1=min(y+P,CH),min(x+P,CW)
    tex[y0:y1,x0:x1]+=p[y0-y:y1-y,x0-x:x1-x]*win[y0-y:y1-y,x0-x:x1-x]
    wsum[y0:y1,x0:x1]+=win[y0-y:y1-y,x0-x:x1-x]
tex/=wsum; tex*=tsd/tex.std()
# low-frequency lighting fitted on clean wall pixels of the original
o=cv2.imread('scene.png').astype(np.float32)
clean=np.ones(o.shape[:2],bool); clean[90:510,60:690]=False
pm=cv2.imread('alpha.png',0); clean&=cv2.resize(pm,(736,736))<10
ys,xs=np.nonzero(clean); ys=ys[::7]; xs=xs[::7]
def feats(x,y): x=x/736-.5; y=y/736-.5; return np.stack([np.ones_like(x),x,y,x*x,y*y,x*y],-1)
A=feats(xs.astype(float),ys.astype(float)); coef=np.linalg.lstsq(A,o[ys,xs],rcond=None)[0]
gy,gx=np.mgrid[0:CH,0:CW].astype(float); oy=np.clip(gy/S-EXT,0,736); ox=gx/S
base=(feats(ox,oy)@coef).astype(np.float32)
wall=base+tex
canvas=wall.copy()
# ---------- papers ----------
def jersey(path):
  im=cv2.imread(path).astype(np.float32); g=im.min(2)
  ys,xs=np.nonzero(g<235); return im[ys.min():ys.max()+1,xs.min():xs.max()+1]
def paste_rgba(dst,rgb,a,cx,cy):
  h,w=a.shape; x0=int(cx-w/2); y0=int(cy-h/2)
  X0,Y0=max(x0,0),max(y0,0); X1,Y1=min(x0+w,CW),min(y0+h,CH)
  aa=a[Y0-y0:Y1-y0,X0-x0:X1-x0,None]; dst[Y0:Y1,X0:X1]=dst[Y0:Y1,X0:X1]*(1-aa)+rgb[Y0-y0:Y1-y0,X0-x0:X1-x0]*aa
def rot(img,ang,border):
  h,w=img.shape[:2]; M=cv2.getRotationMatrix2D((w/2,h/2),ang,1); c,s=abs(M[0,0]),abs(M[0,1])
  nw,nh=int(h*s+w*c)+4,int(h*c+w*s)+4; M[0,2]+=nw/2-w/2; M[1,2]+=nh/2-h/2
  return cv2.warpAffine(img,M,(nw,nh),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_CONSTANT,borderValue=border),M
def pin(dst,x,y,r=10):
  sh=np.zeros(dst.shape[:2],np.float32); cv2.circle(sh,(int(x+4),int(y+6)),r+2,1,-1,cv2.LINE_AA); sh=cv2.GaussianBlur(sh,(0,0),4)
  dst*=1-0.35*sh[...,None]
  m=np.zeros(dst.shape[:2],np.float32); cv2.circle(m,(int(x),int(y)),r,1,-1,cv2.LINE_AA)
  yy,xx=np.mgrid[0:dst.shape[0],0:dst.shape[1]]; d=np.hypot(xx-(x-r*.35),yy-(y-r*.35))/r
  col=np.stack([np.full_like(d,40),np.full_like(d,45),np.clip(215-60*d,140,215)],-1)+np.clip(1-d*2.2,0,1)[...,None]*110
  dst[:]=dst*(1-m[...,None])+np.clip(col,0,255)*m[...,None]
def paper(dst,w,h,cx,cy,ang,content=None,pins=((0,0),(1,0))):
  shade=np.linspace(1.0,0.965,h)[:,None,None]*np.linspace(0.985,1.0,w)[None,:,None]
  p=np.ones((h,w,3),np.float32)*np.array([236,237,238],np.float32)*shade
  p+=rng.normal(0,1.6,(h,w,1)).astype(np.float32)
  if content is not None:
    jh,jw=content.shape[:2]; tw=int(w*0.86); th=int(jh*tw/jw)
    if th>h*0.86: th=int(h*0.86); tw=int(jw*th/jh)
    j=cv2.resize(content,(tw,th),interpolation=cv2.INTER_AREA)/255.
    y0=(h-th)//2; x0=(w-tw)//2; p[y0:y0+th,x0:x0+tw]*=np.clip(j*1.02,0,1)
  a=np.ones((h,w),np.float32)
  pr,M=rot(p,ang,(0,0,0)); ar,_=rot(a,ang,0)
  sh=cv2.GaussianBlur(ar,(0,0),14); sh2=np.zeros_like(sh); sh2[14:,8:]=sh[:-14,:-8]; sh=sh2
  paste_rgba(dst,np.zeros_like(pr),sh*0.30,cx,cy)
  paste_rgba(dst,pr,ar,cx,cy)
  H2,W2=ar.shape
  for (u,v) in pins:
    px,py=M@np.array([22+u*(w-44),22+v*(h-44),1.0]); pin(dst,px-W2/2+cx,py-H2/2+cy)
J={k:jersey(f'../images/{k}.webp') for k in (2,3,4,5)}
# blank backing sheets (collage feel)

# jerseys: 5=Las Vegas, 3=Shibuya, 2=Dopo's, 4=Pattaya
def sz(k,w): jh,jw=J[k].shape[:2]; return w,int(w*0.86*jh/jw/0.86+w*0.14)
for k,w,cx,cy,ang,pins in [(5,770,640,700,-1.6,((0,0),(1,0))),(3,770,1530,740,1.3,((0,0),(1,0),(1,1))),
                           (2,690,420,1640,1.1,((0,0),(1,0),(0,1))),(4,690,1745,1680,-1.0,((0,0),(1,0),(1,1)))]:
  w_,h_=sz(k,w); paper(canvas,w_,h_,cx,cy,ang,J[k],pins)
# ---------- person ----------
bm=(cv2.imread('alpha.png',0)>128).astype(np.uint8)
bm=cv2.morphologyEx(bm,cv2.MORPH_OPEN,np.ones((9,9),np.uint8))
core=cv2.erode(bm,np.ones((41,41),np.uint8)).astype(np.float32)
band=cv2.dilate(bm,np.ones((41,41),np.uint8)).astype(np.float32)
lum=cv2.GaussianBlur(src.max(2),(0,0),1.0)
key=np.clip((165-lum)/80,0,1)
al=np.maximum(core,key*band)
lim=(np.array([(0,0),(436,0),(430,330),(431,372),(436,386),(446,394),(458,401),(472,412),(484,425),(493,440),(501,456),(509,476),(515,496),(521,518),(560,560),(560,736),(0,736)],np.float32)*4).astype(np.int32)
L=np.zeros(al.shape,np.float32); cv2.fillPoly(L,[lim],1,cv2.LINE_AA); L=cv2.GaussianBlur(L,(0,0),2.0)
al*=L
n,l,st,_=cv2.connectedComponentsWithStats((al>0.5).astype(np.uint8)); i=1+np.argmax(st[1:,4])
keep=cv2.dilate((l==i).astype(np.uint8),np.ones((7,7),np.uint8)); al*=keep
sc=CW/2944; per=cv2.resize(src,(CW,CW),interpolation=cv2.INTER_AREA); per=per*0.25+per.mean(2,keepdims=True)*0.75; pa=cv2.resize(al,(CW,CW),interpolation=cv2.INTER_AREA)
oy=CH-CW
# soft contact shadow of the person on wall
ps=cv2.GaussianBlur(pa,(0,0),40); ps2=np.zeros_like(ps); ps2[10:,25:]=ps[:-10,:-25]; canvas[oy:]*=1-0.18*ps2[...,None]
canvas[oy:]=canvas[oy:]*(1-pa[...,None])+per*pa[...,None]
# ---------- finish ----------
out=cv2.resize(np.clip(canvas,0,255),(1080,1350),interpolation=cv2.INTER_AREA)
bl=cv2.GaussianBlur(out,(0,0),1.2); out=out+0.45*(out-bl)
yy,xx=np.mgrid[0:1350,0:1080]; v=1-0.10*(((xx-540)/540)**2+((yy-650)/700)**2); out*=v[...,None]
out+=rng.normal(0,1.8,(1350,1080,1))
out=np.clip(out,0,255).astype(np.uint8)
cv2.imwrite('final.png',out); cv2.imwrite('final.jpg',out,[cv2.IMWRITE_JPEG_QUALITY,96])
