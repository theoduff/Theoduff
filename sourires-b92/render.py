import subprocess, math
from PIL import Image, ImageOps, ImageFilter, ImageEnhance, ImageDraw, ImageFont
W,H,FPS=1080,1920,30
FB=ImageFont.truetype('fonts/Lexend-Black.ttf',96)
FI=ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf',120)
FS=ImageFont.truetype('fonts/Lexend-Bold.ttf',46)
# (file, dur, (cx,cy,zoom) start, end, caption)
S=[
 ('9_1csB',1.5,(.36,.42,1.05),(.38,.40,1.22),'hook'),
 ('19_1csB',1.0,(.42,.46,1.55),(.42,.44,1.8),'hook'),
 ('10_1csB',1.0,(.58,.5,1.0),(.76,.5,1.05),None),
 ('39_1-3L',1.0,(.55,.42,1.25),(.56,.40,1.4),None),
 ('16_1csB',1.0,(.55,.45,1.0),(.63,.45,1.08),None),
 ('27_1o1q',1.0,(.47,.5,1.0),(.56,.5,1.1),None),
 ('43_1-3L',1.0,(.3,.5,1.0),(.72,.5,1.0),None),
 ('38_1-3L',1.0,(.28,.5,1.0),(.72,.5,1.0),None),
 ('32_1-3L',0.5,(.56,.42,1.25),(.58,.40,1.35),None),
 ('50_1-3L',0.5,(.52,.55,1.2),(.52,.55,1.3),None),
 ('7_1csB',0.5,(.28,.45,1.15),(.30,.45,1.25),None),
 ('000040310008_1SBX',0.5,(.5,.55,1.15),(.5,.55,1.25),None),
 ('64_1-3L',1.0,(.2,.5,1.0),(.5,.5,1.05),None),
 ('65_1-3L',1.0,(.55,.5,1.0),(.78,.5,1.05),None),
 ('46_1-3L',1.0,(.3,.5,1.0),(.68,.5,1.0),None),
 ('68_1-3L',1.5,(.33,.55,1.05),(.8,.55,1.05),None),
 ('74_1-3L',3.0,None,None,'end'),
]
cache={}
def load(n):
    if n not in cache:
        im=ImageOps.exif_transpose(Image.open(f'ph/{n}.jpg')).convert('RGB')
        im=ImageEnhance.Color(im).enhance(1.12); im=ImageEnhance.Contrast(im).enhance(1.04)
        cache[n]=im
    return cache[n]
def ease(x): return 0.5-0.5*math.cos(math.pi*x)
def crop(im,cx,cy,z):
    iw,ih=im.size
    ch=ih/z; cw=ch*9/16
    if cw>iw: cw=iw; ch=cw*16/9
    x0=min(max(cx*iw-cw/2,0),iw-cw); y0=min(max(cy*ih-ch/2,0),ih-ch)
    return im.resize((W,H),Image.BICUBIC,box=(x0,y0,x0+cw,y0+ch))
def text_c(d,y,s,font,fill='white',stroke=0):
    w=d.textlength(s,font=font); d.text(((W-w)/2,y),s,font=font,fill=fill,stroke_width=stroke,stroke_fill='black')
def shadow_text(fr,lines):
    lay=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(lay)
    for y,s,font in lines: text_c(d,y+6,s,font,fill=(0,0,0,170))
    lay=lay.filter(ImageFilter.GaussianBlur(10)); fr.paste(lay,(0,0),lay)
    d=ImageDraw.Draw(fr)
    for y,s,font in lines: text_c(d,y,s,font)
end_bg=None
def end_frame(p,t):
    global end_bg
    im=load('74_1-3L')
    if end_bg is None:
        bg=crop(im,.5,.5,1.0).filter(ImageFilter.GaussianBlur(40)); end_bg=ImageEnhance.Brightness(bg).enhance(0.55)
    fr=end_bg.copy()
    s=1.0+0.06*p; pw=int(1000*s); ph=int(pw*im.size[1]/im.size[0])
    card=im.resize((pw,ph),Image.BICUBIC)
    bord=Image.new('RGB',(pw+24,ph+24),'white'); bord.paste(card,(12,12))
    a=min(1,t/0.25); y=int(H/2-ph/2-12+ (1-ease(a))*80)
    fr.paste(bord,((W-pw-24)//2,y))
    if t>0.35:
        shadow_text(fr,[(260,'BOULOGNE 92',FB),(380,'aviron',FI)])
    if t>0.9:
        shadow_text(fr,[(1480,'Le sourire,',FS),(1545,"c'est contagieux.",FS)])
    return fr
ff=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
    '-i','music.wav','-map','0:v','-map','1:a','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p',
    '-af','afade=t=out:st=17.2:d=0.8','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart','sourires_b92.mp4'],stdin=subprocess.PIPE)
T=0.0; fi=0
for n,d,a,b,cap in S:
    nf=round(d*FPS)
    for k in range(nf):
        p=k/max(1,nf-1); t=k/FPS
        if cap=='end': fr=end_frame(p,t)
        else:
            e=ease(p); cx,cy,z=[a[i]+(b[i]-a[i])*e for i in range(3)]
            pop=1+0.06*math.exp(-t*14)   # punch-in pop at each cut
            fr=crop(load(n),cx,cy,z*pop)
            if cap=='hook':
                T0=fi/FPS
                if T0>0.15: shadow_text(fr,[(170,'Essaie de ne pas',FS if False else ImageFont.truetype('fonts/Lexend-Black.ttf',78))] + ([(268,'sourire.',FI)] if T0>0.55 else []))
        ff.stdin.write(fr.tobytes()); fi+=1
ff.stdin.close(); ff.wait(); print('frames',fi, fi/FPS)
