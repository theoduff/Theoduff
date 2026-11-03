import cv2,numpy as np
img=cv2.imread('scene_x4.png'); H,W=img.shape[:2]
s=1472/W; sm=cv2.resize(img,(1472,1472),interpolation=cv2.INTER_AREA)
poly=np.array([(318,300),(330,262),(372,255),(415,268),(430,320),(434,380),(482,410),(518,452),(532,520),(537,585),(500,605),(497,736),(268,736),(273,605),(208,585),(208,520),(222,452),(262,410),(310,385)],np.float32)*1472/736
m=np.zeros((1472,1472),np.uint8); cv2.fillPoly(m,[poly.astype(np.int32)],1)
k=lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(r,r))
dil=cv2.dilate(m,k(61)); ero=cv2.erode(m,k(81))
gc=np.full(m.shape,cv2.GC_BGD,np.uint8); gc[dil>0]=cv2.GC_PR_BGD; gc[m>0]=cv2.GC_PR_FGD
# dark pixels inside polygon -> probable fg strongly
gray=cv2.cvtColor(sm,cv2.COLOR_BGR2GRAY)
gc[(ero>0)]=cv2.GC_FGD
bgd=np.zeros((1,65),np.float64); fgd=np.zeros((1,65),np.float64)
cv2.grabCut(sm,gc,None,bgd,fgd,6,cv2.GC_INIT_WITH_MASK)
fg=((gc==1)|(gc==3)).astype(np.uint8)
# keep largest component
n,l,st,_=cv2.connectedComponentsWithStats(fg); i=1+np.argmax(st[1:,4]); fg=(l==i).astype(np.uint8)
lim=np.array([(0,0),(436,0),(430,330),(431,372),(436,386),(446,394),(458,401),(472,412),(484,425),(493,440),(501,456),(509,476),(515,496),(521,518),(560,560),(560,736),(0,736)],np.float32)*1472/736
L=np.zeros_like(fg); cv2.fillPoly(L,[lim.astype(np.int32)],1); fg=fg&L
n,l,st,_=cv2.connectedComponentsWithStats(fg); i=1+np.argmax(st[1:,4]); fg=(l==i).astype(np.uint8)
fg=cv2.morphologyEx(fg,cv2.MORPH_CLOSE,k(9)); fg=cv2.morphologyEx(fg,cv2.MORPH_OPEN,k(5))
big=cv2.resize(fg*255,(W,H),interpolation=cv2.INTER_LINEAR).astype(np.float32)/255
alpha=cv2.ximgproc.guidedFilter(img,big,8,1e-3)
alpha=np.clip((alpha-0.5)*1.6+0.5,0,1)
cv2.imwrite('alpha.png',(alpha*255).astype(np.uint8))
viz=img.copy(); viz=(viz*alpha[...,None]+np.array([0,255,0])*(1-alpha[...,None])).astype(np.uint8)
cv2.imwrite('viz.jpg',cv2.resize(viz,(900,900)))
