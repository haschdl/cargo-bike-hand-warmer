// All dimensions in mm. One mirrored pair; rectangular soft hood with inward-facing mouth.
(function(root){
function pattern(m){
 for(const k of ['length','depth','height','rail','tube','seam','strap','overlap']) if(!Number.isFinite(m[k])||m[k]<=0||m[k]>500)throw Error('Check '+k+' (1–500 mm)');
 const {length:L,depth:D,height:H,rail:R,tube:T,seam:S,strap:B,overlap:O}=m;
 const q=T/2+3;
 if(R<=q||R+q>=D||H/2<=q+S||L<=2*B+2*S)throw Error('Not enough room for rail notch or mounting tabs.');
 // U-wrap: roof, outer wall, floor. Mouth is the unsewn inward edge.
 const W=2*D+H;
 const cap='M 0 0 H '+(D+S)+' V '+(H+2*S)+' H 0 V '+(H/2+S+q)+' H '+R+' A '+q+' '+q+' 0 0 0 '+R+' '+(H/2+S-q)+' H 0 Z';
 return {m,W,q,parts:[
 {name:'P1 hood wrap',count:'2 shell + 2 lining',w:W,h:L+2*S,cut:'M 0 0 H '+W+' V '+(L+2*S)+' H 0 Z',stitch:'M 0 '+S+' H '+W+' M 0 '+(L+S)+' H '+W,fold:'M '+D+' 0 V '+(L+2*S)+' M '+(D+H)+' 0 V '+(L+2*S)},
 {name:'P2 end panel',count:'4 shell + 4 lining',w:D+S,h:H+2*S,cut:cap,stitch:'M 0 '+S+' H '+D+' V '+(H+S)+' H 0'},
 {name:'P3 strap blank',count:'4 webbing',w:Math.PI*T+O+25,h:B,cut:'M 0 0 H '+(Math.PI*T+O+25)+' V '+B+' H 0 Z'}
 ]};
}
function sheet(p){let y=15;const W=Math.max(...p.parts.map(x=>x.w))+20;let body='';for(const a of p.parts){body+='<g transform="translate(10 '+y+')"><text y="-4">'+a.name+' — '+a.count+'</text><path class="cut" d="'+a.cut+'"/>'+(a.stitch?'<path class="stitch" d="'+a.stitch+'"/>':'')+(a.fold?'<path class="fold" d="'+a.fold+'"/>':'')+'</g>';y+=a.h+18;}body+='<rect class="cut" x="10" y="'+y+'" width="50" height="50"/><text x="12" y="'+(y+8)+'">50 mm square</text>';return {W,H:y+60,body};}
const style='<style>text{font:4px sans-serif;fill:#111}.cut,.stitch,.fold{fill:none;stroke:#111;stroke-width:.35}.stitch{stroke-dasharray:3 2}.fold{stroke-dasharray:1 2}</style>';
function svg(p){const {W,H,body}=sheet(p);return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'mm" height="'+H+'mm" viewBox="0 0 '+W+' '+H+'">'+style+body+'</svg>';}
function pages(p){const {W,H,body}=sheet(p),out=[],cols=Math.ceil(W/190),rows=Math.ceil(H/270);for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){out.push('<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">'+style+'<text x="10" y="6">Row '+(r+1)+'/'+rows+' column '+(c+1)+'/'+cols+' — trim border; butt adjacent edges</text><svg x="10" y="10" width="190" height="270" viewBox="'+(c*190)+' '+(r*270)+' 190 270" overflow="hidden">'+body+'</svg><rect x="10" y="10" width="190" height="270" class="cut"/><path class="cut" d="M 10 287 H 60"/><text x="65" y="288">50 mm check</text></svg>');}return out;}
const defaults={length:180,depth:100,height:100,rail:25,tube:16,seam:10,strap:25,overlap:35};
root.Pogie={pattern,svg,pages,defaults};
})(globalThis);
