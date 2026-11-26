import numpy as np, wave, sys
SR=44100; BPM=120; B=60/BPM; DUR=float(sys.argv[1]); N=int(SR*(DUR+1.5))
L=np.zeros(N); R=np.zeros(N); rng=np.random.default_rng(3)
def add(sig,t,pan=0.0,g=1.0):
    i=int(t*SR); s=sig[:max(0,N-i)]*g
    L[i:i+len(s)]+=s*(1-pan)*0.5*2**0.5*0.7; R[i:i+len(s)]+=s*(1+pan)*0.5*2**0.5*0.7
def f(m): return 440*2**((m-69)/12)
def pluck(m,d=0.45,bright=1.0):
    t=np.arange(int(SR*d))/SR; fr=f(m)
    s=np.sin(2*np.pi*fr*t)+0.5*bright*np.sin(4*np.pi*fr*t)*np.exp(-t*9)+0.25*bright*np.sin(6*np.pi*fr*t)*np.exp(-t*14)
    return s*np.exp(-t*6)*np.minimum(1,t*400)
def bell(m,d=0.6):
    t=np.arange(int(SR*d))/SR; fr=f(m)
    return (np.sin(2*np.pi*fr*t+1.2*np.sin(2*np.pi*fr*3.5*t)*np.exp(-t*6)))*np.exp(-t*5)*np.minimum(1,t*600)
def kick():
    t=np.arange(int(SR*0.3))/SR; ph=2*np.pi*np.cumsum(50+90*np.exp(-t*35))/SR
    return np.sin(ph)*np.exp(-t*9)
def clap():
    t=np.arange(int(SR*0.18))/SR; n=rng.standard_normal(len(t))
    env=np.exp(-t*30)+0.6*np.exp(-np.maximum(0,t-0.012)*40)*(t>0.012)+0.4*np.exp(-np.maximum(0,t-0.024)*25)*(t>0.024)
    n=np.convolve(n,[1,-0.6],'same'); return n*env*0.5
def shaker():
    t=np.arange(int(SR*0.06))/SR; n=np.diff(rng.standard_normal(len(t)+1)); return n*np.exp(-t*60)*0.12
def bass(m,d):
    t=np.arange(int(SR*d))/SR; fr=f(m); return (np.sin(2*np.pi*fr*t)+0.3*np.sin(4*np.pi*fr*t))*np.minimum(1,t*200)*np.exp(-t*2.5)*np.minimum(1,(d-t)*60)
# I-V-vi-IV in D major: D A Bm G
chords=[[62,66,69],[57,61,64],[59,62,66],[55,59,62]]; roots=[38,33,35,31]
mel=[74,76,78,76, 73,76,73,71, 74,78,81,78, 79,78,76,74]  # per half-bar pattern
nb=int(DUR/B)+1
for b in range(nb):
    t=b*B; bar=b//4; ci=bar%4; intro=b<4
    if not intro or b>=2: add(kick(),t,0,0.9 if not intro else 0.5)
    if b%2==1 and not intro: add(clap(),t,0.1,0.55)
    for k in range(2): add(shaker(),t+k*B/2+B/4,0.4,1.0)
    # ukulele-ish strum on off-beats
    for j,m in enumerate(chords[ci]): add(pluck(m+12,0.35),t+B/2+j*0.012,-0.3,0.18)
    for j,m in enumerate(chords[ci]): add(pluck(m+12,0.35,0.6),t+j*0.012,-0.3,0.12)
    if not intro: add(bass(roots[ci]+12,B*0.9),t,0,0.35)
    # melody: bell on beats with skips
    if b>=4 and b%1==0:
        m=mel[(b-4)%16]
        if (b%8) not in (3,7): add(bell(m),t,0.25,0.16)
        if (b%4)==1: add(bell(m+2,0.3),t+B/2,0.25,0.10)
# final chord ring
tend=nb*B
for m in [62,66,69,74]: add(pluck(m+12,1.5),tend,0,0.25)
add(kick(),tend,0,0.9)
x=np.stack([L,R],1); x=np.tanh(x*1.2); x/=np.max(np.abs(x))*1.12
fade=int(SR*1.2); x[-fade:]*=np.linspace(1,0,fade)[:,None]
w=wave.open('music.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x*32767).astype('<i2').tobytes()); w.close()
