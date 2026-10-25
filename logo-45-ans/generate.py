import math
O="#F25C05"; O2="#C94A00"; K="#141414"; K2="#3A3A3A"; CR="#F3EEE6"
def star(cx,cy,R,c1,c2,ratio=0.4):
    r=R*ratio; out=[]
    P=lambda rr,a:(cx+rr*math.cos(math.radians(a)),cy+rr*math.sin(math.radians(a)))
    for k in range(5):
        p=P(R,-90+72*k); il=P(r,-90-36+72*k); ir=P(r,-90+36+72*k)
        f=lambda q:f"{q[0]:.1f},{q[1]:.1f}"
        out.append(f'<polygon points="{cx},{cy} {f(il)} {f(p)}" fill="{c2}"/>')
        out.append(f'<polygon points="{cx},{cy} {f(p)} {f(ir)}" fill="{c1}"/>')
    return "".join(out)
F='font-family="Inter Display"'
def A(bg,num,txt,acc,sc1,sc2,pid):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
<defs><pattern id="{pid}" width="10" height="14" patternUnits="userSpaceOnUse"><rect width="10" height="9" fill="{num}"/></pattern></defs>
<rect width="600" height="600" fill="{bg}"/>
{star(300,122,70,sc1,sc2)}
<text x="300" y="418" {F} font-weight="900" font-size="280" letter-spacing="-2" text-anchor="middle" fill="url(#{pid})">45</text>
<text x="309" y="486" {F} font-weight="800" font-size="46" letter-spacing="18" text-anchor="middle" fill="{txt}">SARCEAUX</text>
<line x1="130" y1="527" x2="180" y2="527" stroke="{acc}" stroke-width="2"/>
<line x1="420" y1="527" x2="470" y2="527" stroke="{acc}" stroke-width="2"/>
<text x="304" y="534" {F} font-weight="600" font-size="20" letter-spacing="8" text-anchor="middle" fill="{acc}">1982 — 2027</text>
</svg>'''
def C():
    stripes="".join(f'<rect x="100" y="{y}" width="400" height="13" fill="{O2}"/>' for y in range(105,500,26))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
<defs><clipPath id="cd"><circle cx="300" cy="300" r="190"/></clipPath>
<path id="tp" d="M 78,300 A 222,222 0 0 1 522,300"/><path id="bp" d="M 58,300 A 242,242 0 0 0 542,300"/></defs>
<rect width="600" height="600" fill="{K}"/>
<circle cx="300" cy="300" r="272" fill="none" stroke="{CR}" stroke-width="2"/>
<text {F} font-weight="800" font-size="34" letter-spacing="14" text-anchor="middle" fill="{CR}"><textPath href="#tp" startOffset="50%">SARCEAUX</textPath></text>
<text {F} font-weight="600" font-size="20" letter-spacing="8" text-anchor="middle" fill="{O}"><textPath href="#bp" startOffset="50%">1982 — 45 ANS — 2027</textPath></text>
<circle cx="300" cy="300" r="190" fill="{O}"/>
<g clip-path="url(#cd)">{stripes}</g>
{star(300,272,128,K,K2)}
<text x="300" y="462" {F} font-weight="900" font-size="64" letter-spacing="-2" text-anchor="middle" fill="{CR}">45</text>
</svg>'''
html=f'''<html><body style="margin:0;display:flex;gap:0;background:#000">
{A(CR,O,K,O,K,K2,"p1")}{A(K,O,CR,O,O,O2,"p2")}{C()}</body></html>'''
open('sheet.html','w').write(html)
out="/home/user/Theoduff/logo-45-ans/"
for name,svg in (("A-clair",A(CR,O,K,O,K,K2,"p1")),("B-sombre",A(K,O,CR,O,O,O2,"p2")),("C-sceau",C())):
    open(out+f"sarceaux-45-{name}.svg","w").write(svg)
