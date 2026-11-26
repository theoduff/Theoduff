# Vertical "smiles" reel from raw B92 rushes: no text, no music, natural sound only.
import subprocess, os
R='rush/'; os.makedirs('clips',exist_ok=True)
# (file, in, out, kind, params)  kind 'sony' = 16:9 S-Log3 crop with cx0->cx1 ; 'vert' = vertical phone clip, zoom z at (cx,cy)
EDL=[
 ('jetable_intro.MOV',2.0,5.5,'vert',(1.0,.5,.5)),
 ('9657.MP4',8.5,10.8,'sony',(.32,.32)),
 ('9659.MP4',17.0,19.5,'sony',(.74,.74)),
 ('9653.MP4',9.3,11.0,'sony',(.25,.58)),
 ('9656.MP4',4.3,6.6,'sony',(.36,.39)),
 ('9653.MP4',3.4,5.0,'sony',(.76,.70)),
 ('9659.MP4',14.0,15.2,'sony',(.42,.36)),
 ('IMG_0273.MOV',8.5,10.5,'vert',(1.6,.55,.42)),
 ('IMG_0274.MOV',1.5,5.5,'vert',(1.45,.5,.38)),
]
outs=[]
for i,(f,a,b,k,p) in enumerate(EDL):
    d=b-a; o=f'clips/c{i:02d}.mp4'; outs.append(o)
    if k=='sony':
        c0,c1=p
        v=(f"crop=w=ih*9/16:h=ih:x='max(0,min(iw-ow,({c0}+({c1}-{c0})*t/{d})*iw-ow/2))':y=0,"
           f"scale=1080:1920:flags=lanczos,format=yuv444p10le,lut3d=slog3doux.cube,eq=saturation=0.95")
    else:
        z,cx,cy=p
        v=(f"crop=w=iw/{z}:h=ih/{z}:x=max(0\\,min(iw-ow\\,{cx}*iw-ow/2)):y=max(0\\,min(ih-oh\\,{cy}*ih-oh/2)),"
           f"scale=1080:1920:flags=lanczos")
    v+=f",fps=30,format=yuv420p,setsar=1"
    af=f"aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-17:TP=-2:LRA=7,afade=t=in:d=0.04,afade=t=out:st={d-0.06:.3f}:d=0.06"
    cmd=['ffmpeg','-v','error','-y','-ss',str(a),'-i',R+f,'-t',f'{d:.3f}','-vf',v,'-af',af,
         '-c:v','libx264','-preset','slow','-crf','17','-c:a','pcm_s16le','-ar','48000',o.replace('.mp4','.mov')]
    subprocess.run(cmd,check=True); print('ok',o,d)
open('clips/list.txt','w').write(''.join(f"file 'c{i:02d}.mov'\n" for i in range(len(EDL))))
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i','clips/list.txt',
  '-c:v','copy','-af','loudnorm=I=-14:TP=-1:LRA=9','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart','sourires_b92_video.mp4'],check=True)
