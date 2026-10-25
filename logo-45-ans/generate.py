import math
C=500
O="#FF6A13"; O2="#E2540A"; D="#1C1C1E"; D2="#2C2C2F"; W="#FFFFFF"
def pt(r,a): a=math.radians(a); return (C+r*math.cos(a), C+r*math.sin(a))
def f(p): return f"{p[0]:.1f},{p[1]:.1f}"
s=[]
s.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">')
s.append(f'''<defs>
<linearGradient id="og" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A3D"/><stop offset="1" stop-color="{O2}"/></linearGradient>
<linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A2A2E"/><stop offset="1" stop-color="#121214"/></linearGradient>
<clipPath id="disc"><circle cx="{C}" cy="{C}" r="300"/></clipPath>
<path id="top" d="M {C-372},{C} A 372 372 0 0 1 {C+372},{C}"/>
<path id="bot" d="M {C-400},{C} A 400 400 0 0 0 {C+400},{C}"/>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.35"/></filter>
</defs>''')
# outer badge
s.append(f'<circle cx="{C}" cy="{C}" r="480" fill="url(#dg)"/>')
s.append(f'<circle cx="{C}" cy="{C}" r="462" fill="none" stroke="{O}" stroke-width="4"/>')
s.append(f'<circle cx="{C}" cy="{C}" r="328" fill="none" stroke="{O}" stroke-width="4"/>')
# arc text
s.append(f'<text font-family="Inter Display" font-weight="900" font-size="92" fill="{W}" letter-spacing="14" text-anchor="middle"><textPath href="#top" startOffset="50%">SARCEAUX</textPath></text>')
s.append(f'<text font-family="Inter Display" font-weight="700" font-size="44" fill="{O}" letter-spacing="12" text-anchor="middle"><textPath href="#bot" startOffset="50%">1982 — 2027</textPath></text>')
# laurels: stem + curved leaves, bottom to top on each side
for side in (1,-1):
    a0,a1 = (128,204) if side==1 else (52,-24)
    r=395
    p0,p1=pt(r,a0),pt(r,a1)
    sweep = 1 if side==1 else 0
    s.append(f'<path d="M {f(p0)} A {r} {r} 0 0 {sweep} {f(p1)}" fill="none" stroke="{O}" stroke-width="4" stroke-linecap="round"/>')
    n=9
    for i in range(n):
        a = a0 + (a1-a0)*(i+0.5)/n
        cx,cy = pt(r,a)
        t = a+90 if side==1 else a-90
        sz = 46 - i*2.2
        for off in (-34,34):
            ang = math.radians(t+off)
            tip=(cx+sz*math.cos(ang), cy+sz*math.sin(ang))
            perp=ang+math.pi/2; w=sz*0.38
            m=((cx+tip[0])/2,(cy+tip[1])/2)
            c1=(m[0]+w*math.cos(perp), m[1]+w*math.sin(perp)); c2=(m[0]-w*math.cos(perp), m[1]-w*math.sin(perp))
            col = O if off<0 else "#FF8A3D"
            s.append(f'<path d="M {f((cx,cy))} Q {f(c1)} {f(tip)} Q {f(c2)} {f((cx,cy))} Z" fill="{col}"/>')
# inner disc with modern stripes
s.append(f'<circle cx="{C}" cy="{C}" r="300" fill="url(#og)"/>')
s.append('<g clip-path="url(#disc)">')
for k,y in enumerate(range(C-300, C+300, 40)):
    s.append(f'<rect x="{C-300}" y="{y}" width="600" height="20" fill="#000" opacity="0.07"/>')
s.append('</g>')
# faceted star
R,r=270,108
outer=[pt(R,-90+72*k) for k in range(5)]
inner=[pt(r,-90+36+72*k) for k in range(5)]
s.append('<g filter="url(#sh)">')
for k in range(5):
    P=outer[k]; Ir=inner[k]; Il=inner[k-1]
    s.append(f'<polygon points="{C},{C} {f(Il)} {f(P)}" fill="#3A3A3E"/>')
    s.append(f'<polygon points="{C},{C} {f(P)} {f(Ir)}" fill="{D}"/>')
s.append('</g>')
# 45
s.append(f'<text x="{C}" y="{C+55}" font-family="Inter Display" font-weight="900" font-size="190" fill="{W}" text-anchor="middle" letter-spacing="-8">45</text>')
# ANS pill
s.append(f'<rect x="{C-95}" y="{C+178}" width="190" height="62" rx="31" fill="{D}" stroke="{W}" stroke-width="3"/>')
s.append(f'<text x="{C}" y="{C+223}" font-family="Inter Display" font-weight="800" font-size="40" fill="{W}" text-anchor="middle" letter-spacing="14">ANS</text>')
s.append('</svg>')
open('/home/user/Theoduff/logo-45-ans/sarceaux-45-ans.svg','w').write("\n".join(s))
