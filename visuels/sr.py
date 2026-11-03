import cv2,sys,time
t=time.time()
sr=cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel('models/x.pb'); sr.setModel('edsr',4)
img=cv2.imread(sys.argv[1]); 
img=cv2.fastNlMeansDenoisingColored(img,None,3,3,7,21)
out=sr.upsample(img); cv2.imwrite(sys.argv[2],out); print(out.shape,time.time()-t)
