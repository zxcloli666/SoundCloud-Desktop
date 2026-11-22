#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 resolution;
uniform float time;
uniform vec4 reaction;
uniform float lineExposure;
uniform float verticalOffset;
uniform float playback;
uniform float fieldScale;
uniform float contour;
uniform vec3 ink, primary, secondary, highlight;
float hash(vec2 p) {
  p=mod(p,64.0);
  return fract(sin(dot(p,vec2(12.9898,78.233)))*437.5453);
}
float noise(vec2 p) {
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float silk(vec2 p) {
  float value=0.0,weight=0.56;
  mat2 turn=mat2(0.8,0.6,-0.6,0.8);
  for(int i=0;i<3;i++){value+=weight*noise(p);p=turn*p*2.03+3.7;weight*=0.43;}
  return value;
}
vec3 illuminated(vec3 pigment) {
  float peak=max(max(pigment.r,pigment.g),pigment.b);
  return pigment*(max(0.62,peak)/max(peak,0.001));
}
void main() {
  vec2 uv=gl_FragCoord.xy/resolution;
  vec2 screen=vec2(uv.x,1.0-uv.y);
  float aspect=resolution.x/resolution.y;
  float portrait=1.0-smoothstep(0.78,1.15,aspect);
  float extent=mix(0.36,0.30,portrait)*fieldScale;
  vec2 p=(screen-vec2(0.50,mix(0.40,0.36,portrait)+verticalOffset))*vec2(aspect,1.0)/extent;
  float envelope=1.0-smoothstep(0.72,1.65,length(p));
#ifdef DOPPO_DESKTOP
  if (envelope <= 0.0) {
    gl_FragColor=vec4(0.0,0.0,0.0,1.0);
    return;
  }
#endif
  float t=time*0.82;
  float strength=clamp(reaction.x*0.42+reaction.y*0.36+reaction.z*0.38,0.0,1.0);
  float movement=0.40+0.20*playback+0.24*strength;
  vec2 q=vec2(silk(p*0.80+vec2(t*0.36,-t*0.23)),
              silk(p*0.80+vec2(4.3-t*0.25,1.7+t*0.29)));
  vec2 r=vec2(silk(p*0.86+q*1.65+vec2(1.7,t*0.29)),
              silk(p*0.86+q*1.45+vec2(8.1,-t*0.22)));
  vec2 w=p+movement*(r-0.40)+0.30*(q-0.40);
  float turning=0.08*sin(t*0.31)+0.04*playback*sin(t*0.47);
  w=mat2(cos(turning),-sin(turning),sin(turning),cos(turning))*w;
  w+=reaction.z*0.075*vec2(sin(p.y*3.1+q.x*4.0),cos(p.x*2.7+r.y*3.0));
  float angle=atan(w.y,w.x);
  float radius=length(w*vec2(0.92,1.02));
  float lobes=(0.15+0.065*playback)*sin(angle*3.0+t*0.63+q.x*2.7)
             +(0.065+0.035*playback)*sin(angle*5.0-t*0.39+r.y*2.7);
  float membrane=radius-0.76+lobes+0.05*sin(t*0.52);
  float body=1.0-smoothstep(-0.22,0.24,membrane);
  float shoulder=exp(-abs(membrane)*5.7);
  float ridge=exp(-abs(membrane)*(18.0+6.0*playback));
  float innerMembrane=length(w*vec2(1.17,0.93)+vec2(0.18,-0.03))-0.61
                     +0.14*sin(angle*3.0-t*0.70+q.y*2.5);
  float inner=exp(-abs(innerMembrane)*18.0)*body;
  float tint=smoothstep(0.12,0.70,q.x*0.60+r.y*0.62+0.10*sin(w.x+t*0.24));
  vec3 a=illuminated(primary);
  vec3 b=illuminated(secondary);
  vec3 light=highlight;
  vec3 pigment=mix(b,a,tint);
  float topTint=0.5+0.22*sin(screen.x*2.4+t*0.16)+0.14*r.x;
  float side=smoothstep(0.02,0.70,screen.x);
  vec3 atmosphere=mix(a,b,topTint)*0.035;
  float valley=0.70+0.22*sin(w.y*1.8+w.x*0.5+q.y*2.4+t*0.22);
  vec3 color=atmosphere*valley;
  color+=pigment*body*(0.10+0.18*r.y)*(0.12+0.88*contour);
  float incidence=0.36+0.64*smoothstep(-0.7,0.9,sin(angle+0.4+t*0.16));
  float glint=smoothstep(0.14,0.65,r.x+0.12*sin(p.y*1.2+t*0.17));
  vec3 rim=mix(pigment,light,0.42);
  float topReveal=smoothstep(0.015,0.13,screen.y);
  color+=rim*((ridge*(0.48+strength*0.30)*incidence*glint+inner*0.16)*lineExposure+shoulder*0.18)*topReveal*contour;
  color+=rim*shoulder*(reaction.z*0.20+reaction.x*0.10)*topReveal*contour;
  float luminance=dot(pow(max(color,vec3(0.0)),vec3(2.2)),vec3(0.2126,0.7152,0.0722));
  color*=min(1.0,pow(0.20/max(luminance,0.001),0.455));
  color*=envelope*0.72;
  color+=(hash(gl_FragCoord.xy)-0.5)/255.0;
  gl_FragColor=vec4(color,1.0);
}
