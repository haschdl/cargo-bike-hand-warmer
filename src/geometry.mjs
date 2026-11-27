export function pattern({length=180,radius=65,seam=10,tube=25,overlap=35,strapWidth=25,lining=4}={}) {
  for(const [k,v] of Object.entries({length,radius,seam,tube,overlap,strapWidth,lining}))
    if(!Number.isFinite(v)||v<=0||v>1000) throw new Error(k+' must be between 0 and 1000 mm');
  if(seam>=radius || lining>=radius || strapWidth*2>=length) throw new Error('Invalid clearance or seam geometry');
  const arc=Math.PI*radius, R=radius+seam, strapLength=Math.PI*tube+overlap;
  return {length,radius,seam,tube,overlap,strapWidth,lining,arc,R,strapLength,wrapWidth:arc+2*seam,wrapLength:length+2*seam,internalRadius:radius-lining};
}
export function svg(p) {
 const {length:L,radius:r,seam:s,arc:a,R,wrapWidth:w,wrapLength:h,strapLength:t,strapWidth:b}=p;
 const W=Math.max(w+30,2*R+30,t+30,100), y=h+55, z=y+R+s+40, H=z+b+100;
 const endCut=`M ${-Math.sqrt(R*R-s*s)} ${s} A ${R} ${R} 0 1 1 ${Math.sqrt(R*R-s*s)} ${s} Z`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
 <style>text{font:4px sans-serif;fill:#222} .cut{fill:none;stroke:#111;stroke-width:.35}.stitch{fill:none;stroke:#555;stroke-width:.3;stroke-dasharray:2 1}</style>
 <text x="10" y="8">P01 Wrap — cut 2 shell + 2 lining (pair)</text>
 <g transform="translate(10 15)"><rect class="cut" width="${w}" height="${h}"/><rect class="stitch" x="${s}" y="${s}" width="${a}" height="${L}"/>
 <path class="cut" d="M ${w/2} 0 v 3 M ${w/2} ${h} v -3"/><text x="5" y="${h/2}">Long edges: open bottom / bind</text><text x="5" y="8">Short edges: join end caps</text></g>
 <text x="10" y="${h+32}">P02 End cap — cut 4 shell + 4 lining (pair)</text>
 <g transform="translate(${R+10} ${y+R})"><path class="cut" d="${endCut}"/><path class="stitch" d="M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0 Z"/><path class="cut" d="M 0 ${-R} v 3"/><text x="-15" y="-8">Bind base</text></g>
 <text x="10" y="${z-5}">P03 Webbing blank — cut 4; fit before sewing</text><rect class="cut" x="10" y="${z}" width="${t}" height="${b}"/>
 <rect class="cut" x="10" y="${z+b+15}" width="50" height="50"/><text x="12" y="${z+b+22}">50 × 50 mm</text>
 <text x="10" y="${H-5}">Prototype only — print at 100%</text></svg>`;
}
