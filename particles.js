import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';

export class ParticlesSwarm {
    constructor(container, count = 20000) {
        this.count = count;
        this.container = container;
        this.speedMult = 1;
        
        const PHYSICS_MODE = 'lerp';
        const STIFFNESS = 2;
        const DAMPING = 0.08;
        const NOISE_STRENGTH = 0;
        const MOUSE_MODE = 'none';
        const MOUSE_INFLUENCE = 2.5;

        this.physicsOverrides = {
            gravity: null,
            shockwaveCenter: null,
            shockwaveForce: null,
            shockwaveRadius: null,
            stiffness: null,
            damping: null,
            noiseStrength: null,
        };

        // SETUP
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.position.set(0, 0, 100);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        // POST PROCESSING
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        this.bloomPass.strength = 0.5; this.bloomPass.radius = 0.3; this.bloomPass.threshold = 0.25;
        this.composer.addPass(this.bloomPass);

        

        

        // 3. RADIAL BLUR
        

const GeometricDistortShader = {
    uniforms: {
        'tDiffuse':    { value: null },
        'uGeoMode':    { value: 0 },     // 0=off 1=kaleid 2=mirrorH 3=mirrorV 4=pixelate 5=fisheye 6=bulge 7=polar
        'uGeoAmount':  { value: 0.5 },   // generic strength / amount
        'uSegments':   { value: 6.0 },   // kaleidoscope segments (3–16)
        'uPixelSize':  { value: 8.0 },   // pixelate block size (2–64)
        'uResolution': { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform int   uGeoMode;
        uniform float uGeoAmount;
        uniform float uSegments;
        uniform float uPixelSize;
        uniform vec2  uResolution;
        varying vec2  vUv;

        #define PI  3.14159265358979
        #define PI2 6.28318530718

        void main() {
            if (uGeoMode == 0) { gl_FragColor = texture2D(tDiffuse, vUv); return; }

            vec2 uv = vUv;

            // ── 1. Kaleidoscope ───────────────────────────────────────────────
            if (uGeoMode == 1) {
                vec2 p = uv - 0.5;
                float r = length(p);
                float a = atan(p.y, p.x);
                float sliceAngle = PI2 / uSegments;
                a = mod(a, sliceAngle);
                if (a > sliceAngle * 0.5) a = sliceAngle - a; // mirror within slice
                uv = vec2(r * cos(a), r * sin(a)) + 0.5;
            }
            // ── 2. Mirror Horizontal ─────────────────────────────────────────
            else if (uGeoMode == 2) {
                uv.x = uv.x < 0.5 ? uv.x : 1.0 - uv.x;
            }
            // ── 3. Mirror Vertical ───────────────────────────────────────────
            else if (uGeoMode == 3) {
                uv.y = uv.y < 0.5 ? uv.y : 1.0 - uv.y;
            }
            // ── 4. Pixelate ───────────────────────────────────────────────────
            else if (uGeoMode == 4) {
                vec2 blockSize = vec2(uPixelSize) / uResolution;
                uv = floor(uv / blockSize) * blockSize + blockSize * 0.5;
            }
            // ── 5. Fisheye / Spherize ─────────────────────────────────────────
            else if (uGeoMode == 5) {
                vec2 p = uv * 2.0 - 1.0;
                float len = length(p);
                if (len < 1.0) {
                    float z = sqrt(1.0 - len * len * uGeoAmount);
                    float theta = atan(len / z) * (1.0 / PI);
                    uv = p * (theta / len) * 0.5 + 0.5;
                }
            }
            // ── 6. Bulge / Pinch ──────────────────────────────────────────────
            else if (uGeoMode == 6) {
                vec2 p = uv - 0.5;
                float dist = length(p);
                float factor = pow(dist, uGeoAmount > 0.5 ? 0.6 : 1.8);
                uv = normalize(p + 0.00001) * factor * 0.5 + 0.5;
            }
            // ── 7. Polar Coordinates ──────────────────────────────────────────
            else if (uGeoMode == 7) {
                float r = uv.y;
                float a = (uv.x - 0.5) * PI2;
                uv = vec2(r * cos(a), r * sin(a)) * 0.5 + 0.5;
            }

            gl_FragColor = texture2D(tDiffuse, clamp(uv, 0.001, 0.999));
        }
    `
};
// --- INJECTED SHADER CONSTANTS ---
const ColorGradeCompositeShader = {
    uniforms: {
        "tDiffuse":    { value: null },
        "bgColor":     { value: new THREE.Color(0x000000) },
        "uBrightness": { value: 0.0 },   // -0.5 → +0.5
        "uContrast":   { value: 1.0 },   // 0.0 → 3.0
        "uSaturation": { value: 1.0 },   // 0.0 → 3.0
        "uHueShift":   { value: 0.0 },   // 0.0 → 1.0 (full rotation)
        "uExposure":   { value: 1.0 },   // 0.1 → 4.0
        "uToneMap":    { value: 0 },     // 0=off 1=ACES 2=Reinhard 3=Filmic
        "uTintColor":  { value: new THREE.Color(0xffffff) },
        "uTintShadow": { value: new THREE.Color(0x000000) },
        "uTintAmt":    { value: 0.0 },   // 0.0 → 1.0
        "uInvert":     { value: 0.0 },   // 0=off 1=on
        "uSolarize":   { value: 0.0 },   // 0=off 0–1=threshold
        "uPosterize":  { value: 0.0 },   // 0=off 2–8=bands
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3  bgColor;
        uniform float uBrightness;
        uniform float uContrast;
        uniform float uSaturation;
        uniform float uHueShift;
        uniform float uExposure;
        uniform int   uToneMap;
        uniform vec3  uTintColor;
        uniform vec3  uTintShadow;
        uniform float uTintAmt;
        uniform float uInvert;
        uniform float uSolarize;
        uniform float uPosterize;
        varying vec2  vUv;

        // Hue rotation matrix (lossless, works on any colour)
        vec3 rotateHue(vec3 col, float h) {
            float ang = h * 6.28318530718;
            float c = cos(ang), s = sin(ang);
            float sq = 0.57735026919; // 1/sqrt(3)
            // Rodrigues rotation around grey axis (1,1,1)/sqrt(3)
            return col * c
                + cross(vec3(sq,sq,sq), col) * s
                + vec3(sq,sq,sq) * dot(vec3(sq,sq,sq), col) * (1.0 - c);
        }

        // Tone mapping
        vec3 acesToneMap(vec3 x){
            return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.);
        }
        vec3 reinhardToneMap(vec3 x){ return x/(x+1.); }
        vec3 filmicToneMap(vec3 x){
            vec3 X=max(vec3(0.),x-0.004);
            return (X*(6.2*X+0.5))/(X*(6.2*X+1.7)+0.06);
        }

        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);

            // 1. Background composite
            float bgAlpha = clamp(max(texel.r, max(texel.g, texel.b)), 0.0, 1.0);
            vec3 col = texel.rgb + bgColor * (1.0 - bgAlpha);

            // 2. Exposure
            col *= uExposure;

            // 3. Tone mapping
            if (uToneMap == 1) col = acesToneMap(col);
            else if (uToneMap == 2) col = reinhardToneMap(col);
            else if (uToneMap == 3) col = filmicToneMap(col);

            // 4. Brightness
            col = col + uBrightness;

            // 5. Contrast  (pivot at 0.5)
            col = (col - 0.5) * uContrast + 0.5;

            // 6. Saturation
            float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
            col = mix(vec3(lum), col, uSaturation);

            // 7. Hue shift
            if (uHueShift != 0.0) col = rotateHue(col, uHueShift);

            // 8. Duotone (shadow→highlight colour remap)
            if (uTintAmt > 0.0) {
                float lumDt = dot(col, vec3(0.2126, 0.7152, 0.0722));
                vec3 duotone = mix(uTintShadow, uTintColor, lumDt);
                col = mix(col, duotone, uTintAmt);
            }

            // 9. Solarize  (partial invert above threshold)
            if (uSolarize > 0.0) {
                float lumS = dot(col, vec3(0.2126, 0.7152, 0.0722));
                float mask = step(uSolarize, lumS);
                col = mix(col, 1.0 - col, mask);
            }

            // 10. Invert
            if (uInvert > 0.5) col = 1.0 - col;

            // 11. Posterize
            if (uPosterize >= 2.0) {
                float bands = uPosterize;
                col = floor(col * bands + 0.5) / bands;
            }

            gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }
    `
};

const LiquidMarbleShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'time': { value: 0.0 },
        'strength': { value: 0.0 },
        'speed': { value: 0.5 },
        'scale': { value: 3.0 }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float strength;
        uniform float speed;
        uniform float scale;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){
            vec2 i=floor(p); vec2 f=fract(p);
            vec2 u=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
        }
        vec2 fbm2(vec2 p){
            float f=0.0; float a=0.5;
            for(int i=0;i<5;i++){ f+=a*noise(p); p*=2.0; a*=0.5; }
            return vec2(f, noise(p+vec2(3.7,1.3)));
        }
        void main(){
            if(strength==0.0){ gl_FragColor=texture2D(tDiffuse,vUv); return; }
            vec2 p = vUv * scale;
            float t = time * speed;
            // Domain warp — each layer warps the coordinate space of the next
            vec2 q = fbm2(p + t);
            vec2 r = fbm2(p + q + vec2(1.7+t*0.15, 9.2+t*0.05));
            vec2 warp = fbm2(p + r);
            vec2 sampledUv = clamp(vUv + (warp - 0.5) * strength * 0.4, 0.001, 0.999);
            gl_FragColor = texture2D(tDiffuse, sampledUv);
        }
    `
};

const TwirlShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'angle': { value: 0.0 },
        'radius': { value: 0.5 },
        'center': { value: new THREE.Vector2(0.5, 0.5) }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float angle;
        uniform float radius;
        uniform vec2 center;
        varying vec2 vUv;
        void main(){
            vec2 delta = vUv - center;
            float dist = length(delta);
            float twirlAngle = angle * max(0.0, (radius - dist) / radius);
            float c = cos(twirlAngle), s = sin(twirlAngle);
            vec2 rotated = vec2(c*delta.x - s*delta.y, s*delta.x + c*delta.y);
            gl_FragColor = texture2D(tDiffuse, clamp(center + rotated, 0.001, 0.999));
        }
    `
};

const WaveWarpShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'time': { value: 0.0 },
        'freqX': { value: 10.0 },
        'freqY': { value: 10.0 },
        'amplitude': { value: 0.0 },
        'speed': { value: 1.0 }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float freqX;
        uniform float freqY;
        uniform float amplitude;
        uniform float speed;
        varying vec2 vUv;
        void main(){
            if(amplitude==0.0){ gl_FragColor=texture2D(tDiffuse,vUv); return; }
            float t = time * speed;
            vec2 displaced = vUv + vec2(
                sin(vUv.y * freqX + t) * amplitude,
                cos(vUv.x * freqY + t) * amplitude
            );
            gl_FragColor = texture2D(tDiffuse, clamp(displaced, 0.001, 0.999));
        }
    `
};

const FluidChromaShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'time': { value: 0.0 },
        'strength': { value: 0.0 },
        'dispersion': { value: 0.02 },
        'speed': { value: 0.5 }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float strength;
        uniform float dispersion;
        uniform float speed;
        varying vec2 vUv;
        
        void main() {
            if(strength == 0.0) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
            
            float t = time * speed;
            vec2 p = vUv - 0.5;
            
            // Large scale, smooth, organic flow using trig functions instead of high-frequency noise
            float x1 = sin(p.y * 3.1 + t * 0.7) * cos(p.x * 2.1 + t * 0.9);
            float y1 = cos(p.x * 3.4 - t * 0.6) * sin(p.y * 2.3 - t * 0.8);
            
            float x2 = sin(p.y * 5.2 - t * 1.2 + x1) * cos(p.x * 4.1 + t * 1.1 + y1);
            float y2 = cos(p.x * 5.5 + t * 1.3 - x1) * sin(p.y * 4.3 - t * 1.0 - y1);
            
            // Smooth directional vector
            vec2 dir = vec2(x2, y2) * strength * 0.2;
            
            // Heavy chromatic aberration on the fluid edges
            float rCol = texture2D(tDiffuse, clamp(vUv + dir * (1.0 + dispersion * 2.0), 0.001, 0.999)).r;
            float gCol = texture2D(tDiffuse, clamp(vUv + dir, 0.001, 0.999)).g;
            float bCol = texture2D(tDiffuse, clamp(vUv + dir * (1.0 - dispersion * 2.0), 0.001, 0.999)).b;
            
            // Add a subtle iridescent sheen based on the flow derivative
            float sheen = dot(dir, vec2(0.5)) * 2.0;
            vec3 iridescence = vec3(
                0.5 + 0.5 * sin(sheen * 10.0 + 0.0),
                0.5 + 0.5 * sin(sheen * 10.0 + 2.0),
                0.5 + 0.5 * sin(sheen * 10.0 + 4.0)
            ) * 0.15 * strength;

            gl_FragColor = vec4(vec3(rCol, gCol, bCol) + iridescence, 1.0);
        }
    `
};

const PixelMeltShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'time': { value: 0.0 },
        'amount': { value: 0.0 },
        'threshold': { value: 0.5 },
        'angle': { value: 0.0 }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float amount;
        uniform float threshold;
        uniform float angle;
        varying vec2 vUv;
        
        float hash(float n) { return fract(sin(n)*43758.5453); }
        float noise(vec2 p) {
            vec2 ip = floor(p); vec2 u = fract(p); u = u*u*(3.0-2.0*u);
            float res = mix(
                mix(hash(ip.x+ip.y*57.0), hash(ip.x+1.0+ip.y*57.0), u.x),
                mix(hash(ip.x+(ip.y+1.0)*57.0), hash(ip.x+1.0+(ip.y+1.0)*57.0), u.x), u.y);
            return res;
        }

        void main() {
            if(amount == 0.0) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
            
            float angRad = angle * 3.14159265 / 180.0;
            vec2 dir = vec2(cos(angRad), sin(angRad));
            
            vec2 perp = vec2(-dir.y, dir.x);
            float lineCoord = dot(vUv, perp);
            
            float n = noise(vec2(lineCoord * 100.0, time * 0.5));
            float n2 = noise(vec2(lineCoord * 50.0, time * 0.2));
            
            float displacement = 0.0;
            if (n > threshold) {
                displacement = (n - threshold) * amount * 0.5 + n2 * amount * 0.5;
            }
            
            vec2 uvOffset = vUv - dir * displacement;
            vec4 col = texture2D(tDiffuse, clamp(uvOffset, 0.001, 0.999));
            gl_FragColor = col;
        }
    `
};

const CrystalPrismShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'time': { value: 0.0 },
        'facets': { value: 10.0 },
        'refraction': { value: 0.05 },
        'dispersion': { value: 0.02 }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float facets;
        uniform float refraction;
        uniform float dispersion;
        varying vec2 vUv;
        
        vec2 hash2(vec2 p) {
            p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
            return fract(sin(p)*43758.5453);
        }
        
        void main() {
            if(refraction <= 0.0) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
            
            vec2 p = vUv * facets;
            vec2 n = floor(p);
            vec2 f = fract(p);
            
            vec2 m_point;
            float m_dist = 8.0;
            
            for(int j=-1; j<=1; j++)
            for(int i=-1; i<=1; i++) {
                vec2 g = vec2(float(i),float(j));
                vec2 o = hash2(n + g);
                o = 0.5 + 0.5*sin(time * 0.2 + 6.2831*o);
                vec2 r = g + o - f;
                float d = dot(r,r);
                if(d < m_dist) {
                    m_dist = d;
                    m_point = r;
                }
            }
            
            vec2 edgeDist = min(vUv, 1.0 - vUv);
            float edgeFade = smoothstep(0.0, 0.05, min(edgeDist.x, edgeDist.y));
            vec2 warp = m_point * refraction * edgeFade;
            
            float rCol = texture2D(tDiffuse, clamp(vUv + warp * (1.0 + dispersion), 0.001, 0.999)).r;
            float gCol = texture2D(tDiffuse, clamp(vUv + warp, 0.001, 0.999)).g;
            float bCol = texture2D(tDiffuse, clamp(vUv + warp * (1.0 - dispersion), 0.001, 0.999)).b;
            
            float highlight = smoothstep(0.2, 0.0, length(m_point)) * 0.15 * clamp(refraction * 10.0, 0.0, 1.0);
            
            gl_FragColor = vec4(rCol + highlight, gCol + highlight, bCol + highlight, 1.0);
        }
    `
};

const CinematicArtifactShader = {
    uniforms: {
        'tDiffuse':       { value: null },
        'uHalation':      { value: 0.0 },  // 0.0 → 1.0
        'uHalationColor': { value: new THREE.Color(0xff4400) },
        'uScanlines':     { value: 0.0 },  // 0.0 → 1.0
        'uScanDensity':   { value: 200.0 },// lines per screen (80–400)
        'uScanSoftness':  { value: 0.5 },  // edge softness
        'uResolution':    { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uHalation;
        uniform vec3  uHalationColor;
        uniform float uScanlines;
        uniform float uScanDensity;
        uniform float uScanSoftness;
        uniform vec2  uResolution;
        varying vec2 vUv;

        // Simple box blur (5-tap horizontal) for halation glow
        vec3 boxBlur(vec2 uv, float rad) {
            vec2 px = vec2(rad) / uResolution;
            vec3 c = texture2D(tDiffuse, uv).rgb;
            c += texture2D(tDiffuse, uv + vec2(px.x, 0.)).rgb;
            c += texture2D(tDiffuse, uv - vec2(px.x, 0.)).rgb;
            c += texture2D(tDiffuse, uv + vec2(0., px.y)).rgb;
            c += texture2D(tDiffuse, uv - vec2(0., px.y)).rgb;
            return c / 5.0;
        }

        void main() {
            if (uHalation == 0.0 && uScanlines == 0.0) {
                gl_FragColor = texture2D(tDiffuse, vUv);
                return;
            }
            vec4 texel = texture2D(tDiffuse, vUv);
            vec3 col = texel.rgb;

            // Halation: warm glow around bright edges (film emulation)
            if (uHalation > 0.0) {
                vec3 blurred = boxBlur(vUv, 8.0);
                float brightness = dot(blurred, vec3(0.2126, 0.7152, 0.0722));
                float haloPow = pow(max(0.0, brightness - 0.4), 1.5);
                vec3 haloColor = uHalationColor * haloPow * uHalation * 2.0;
                // Additive blend — mimics light leaking through film layers
                col += haloColor * (1.0 - col); // dodge-style to avoid blowout
            }

            // CRT Scanlines: horizontal dark lines across the screen
            if (uScanlines > 0.0) {
                float lineY = vUv.y * uScanDensity;
                float wave = sin(lineY * 3.14159265) * 0.5 + 0.5;
                float line = smoothstep(uScanSoftness, 1.0 - uScanSoftness, wave);
                float darkness = 1.0 - (1.0 - line) * uScanlines * 0.7;
                col *= darkness;
            }

            gl_FragColor = vec4(col, texel.a);
        }
    `
};

const LensSimulationShader = {
    uniforms: {
        'tDiffuse':      { value: null },
        'uTime':         { value: 0.0 },
        'uLensDist':     { value: 0.0 },  // -1.0 → 1.0 (neg=barrel, pos=pincushion)
        'uShake':        { value: 0.0 },  // 0.0 → 1.0
        'uShakeSpeed':   { value: 3.0 },  // shake frequency
        'uStreaks':       { value: 0.0 }, // 0.0 → 1.0 anamorphic horizontal streaks
        'uStreakColor':  { value: new THREE.Color(0x88aaff) },
        'uResolution':   { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uLensDist;
        uniform float uShake;
        uniform float uShakeSpeed;
        uniform float uStreaks;
        uniform vec3  uStreakColor;
        uniform vec2  uResolution;
        varying vec2  vUv;

        // Pseudo-random for shake
        float rand(float n){ return fract(sin(n) * 43758.5453); }

        void main() {
            if (uLensDist == 0.0 && uShake == 0.0 && uStreaks == 0.0) {
                gl_FragColor = texture2D(tDiffuse, vUv);
                return;
            }
            vec2 uv = vUv;

            // ── Camera Shake ─────────────────────────────────────────────────
            if (uShake > 0.0) {
                float t = floor(uTime * uShakeSpeed);
                vec2 shakeOffset = vec2(
                    (rand(t) - 0.5) * 2.0,
                    (rand(t + 1.7) - 0.5) * 2.0
                ) * uShake * 0.015;
                uv += shakeOffset;
            }

            // ── Lens Distortion (barrel k1 radial) ────────────────────────
            if (uLensDist != 0.0) {
                vec2 p = uv * 2.0 - 1.0;
                float r2 = dot(p, p);
                float distortion = 1.0 + uLensDist * r2;
                p *= distortion;
                uv = p * 0.5 + 0.5;
            }

            vec4 col = texture2D(tDiffuse, clamp(uv, 0.001, 0.999));

            // ── Anamorphic Streaks (horizontal lens flare lines) ──────────
            if (uStreaks > 0.0) {
                float brightness = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
                float threshold = 0.6;
                float streakIntensity = max(0.0, brightness - threshold) * uStreaks * 3.0;

                // Sample horizontally to create streak
                vec3 streak = vec3(0.0);
                float total = 0.0;
                float maxWidth = 0.3 * uStreaks;
                for (int i = -8; i <= 8; i++) {
                    float offset = float(i) * maxWidth / 8.0;
                    float weight = exp(-float(i*i) * 0.08); // Gaussian falloff along streak
                    vec2 sampleUv = vec2(clamp(uv.x + offset, 0.001, 0.999), uv.y);
                    vec3 s = texture2D(tDiffuse, sampleUv).rgb;
                    float sBright = dot(s, vec3(0.2126, 0.7152, 0.0722));
                    streak += s * weight * max(0.0, sBright - threshold);
                    total += weight;
                }
                streak = (streak / total) * uStreakColor;
                col.rgb += streak * uStreaks * 1.5;
            }

            gl_FragColor = col;
        }
    `
};

const LiquidGlassShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'time': { value: 0.0 },
        'amount': { value: 0.0 },
        'type': { value: 0 },
        'uGlassScale': { value: 1.0 },
        'uGlassDistortion': { value: 1.0 },
        'uEdgeHighlight': { value: 1.0 },
        'uChromatic': { value: 1.0 },
        'uResolution': { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float amount;
        uniform int type;
        uniform float uGlassScale;
        uniform float uGlassDistortion;
        uniform float uEdgeHighlight;
        uniform float uChromatic;
        uniform vec2 uResolution;
        varying vec2 vUv;

        #define PI 3.14159265359

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

        float smoothNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f*f*(3.0-2.0*f);
            return mix(mix(hash(i+vec2(0,0)), hash(i+vec2(1,0)), u.x),
                       mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
        }

        float fbm(vec2 p) {
            float v = 0.0; float a = 0.5;
            for(int i=0; i<3; i++) { v += a * smoothNoise(p); p *= 2.0; a *= 0.5; }
            return v;
        }

        // Hexagon grid function
        vec4 hexCoords(vec2 uv) {
            vec2 r = vec2(1.0, 1.7320508);
            vec2 h = r * 0.5;
            vec2 a = mod(uv, r) - h;
            vec2 b = mod(uv - h, r) - h;
            vec2 gv = dot(a, a) < dot(b, b) ? a : b;
            vec2 id = uv - gv;
            return vec4(gv.x, gv.y, id.x, id.y);
        }

        vec4 sampleWithChromatic(vec2 uv, vec2 dir, float dist, vec3 baseHighlight) {
            float ca = uChromatic * amount * 0.05 * uGlassDistortion;
            if (ca <= 0.001) {
                vec4 col = texture2D(tDiffuse, clamp(uv + dir * dist, 0.001, 0.999));
                col.rgb += baseHighlight * uEdgeHighlight;
                return col;
            }
            vec2 rOffset = dir * (dist + ca);
            vec2 gOffset = dir * dist;
            vec2 bOffset = dir * (dist - ca);
            
            float r = texture2D(tDiffuse, clamp(uv + rOffset, 0.001, 0.999)).r;
            float g = texture2D(tDiffuse, clamp(uv + gOffset, 0.001, 0.999)).g;
            float b = texture2D(tDiffuse, clamp(uv + bOffset, 0.001, 0.999)).b;
            
            return vec4(r + baseHighlight.r * uEdgeHighlight, 
                        g + baseHighlight.g * uEdgeHighlight, 
                        b + baseHighlight.b * uEdgeHighlight, 1.0);
        }

        void main() {
            if (amount == 0.0) { gl_FragColor = texture2D(tDiffuse, vUv); return; }

            vec2 uv = vUv;
            vec2 sampleUv = uv;
            vec3 highlight = vec3(0.0);
            vec2 dir = vec2(0.0);
            float dist = 0.0;

            if (type == 0) { // ── Fluted ──────────────────────────────────────
                float strips = max(1.0, 30.0 * uGlassScale);
                float warpX = uv.x + sin(uv.x * 10.0 + time * 0.2) * 0.02;
                float phase = warpX * strips;
                float localX = fract(phase);
                
                dir = vec2(1.0, 0.0);
                dist = (localX - 0.5) * 0.1 * amount * uGlassDistortion;
                
                float edge = pow(abs(localX - 0.5) * 2.0, 8.0);
                highlight = vec3(edge * 0.5 * amount);
            }
            else if (type == 1) { // ── Frosted ──────────────────────────────────
                float scale = max(0.1, 4.0 * uGlassScale);
                vec2 n1 = vec2(
                    fbm(uv * scale + vec2(time * 0.1, 0.0)),
                    fbm(uv * scale + vec2(0.0, time * 0.1))
                );
                dir = (n1 - 0.5);
                dist = amount * 0.12 * uGlassDistortion;
            }
            else if (type == 2) { // ── Diamond Cut (NEW) ────────────────────────
                vec2 p = uv * max(1.0, 20.0 * uGlassScale);
                p.y += time * 0.5;
                
                vec2 p1 = mat2(0.866, -0.5, 0.866, 0.5) * p;
                vec2 f = fract(p1);
                vec2 i = floor(p1);
                
                float tri = step(f.x, f.y);
                vec2 center = i + vec2(0.5) + (tri == 1.0 ? vec2(-0.1, 0.1) : vec2(0.1, -0.1));
                
                vec2 facetNormal = normalize(p1 - center);
                dir = mat2(0.866, 0.5, -0.866, 0.5) * facetNormal;
                
                dist = amount * 0.08 * uGlassDistortion;
                
                float edgeX = min(f.x, 1.0 - f.x);
                float edgeY = min(f.y, 1.0 - f.y);
                float edgeDiag = abs(f.x - f.y);
                float edge = min(min(edgeX, edgeY), edgeDiag);
                
                float glint = pow(1.0 - smoothstep(0.0, 0.15, edge), 4.0);
                highlight = vec3(glint * 0.6 * amount);
            }
            else if (type == 3) { // ── Hexagonal Facets (NEW) ───────────────────
                vec2 p = (uv - 0.5) * (uResolution.x/uResolution.y);
                p *= max(1.0, 15.0 * uGlassScale);
                p.y += time * 0.2;
                
                vec4 hc = hexCoords(p);
                
                float angle = hash(hc.zw) * PI * 2.0;
                vec2 tilt = vec2(cos(angle), sin(angle));
                
                dir = tilt;
                dist = amount * 0.05 * uGlassDistortion;
                
                float hexDist = max(abs(hc.y), dot(abs(hc.xy), vec2(0.866025, 0.5)));
                float edge = smoothstep(0.42, 0.5, hexDist);
                highlight = vec3(edge * 0.5 * amount);
            }
            else if (type == 4) { // ── Prism / Spectrum ──────────────────────────
                float sep = amount * 0.04 * max(0.1, uGlassScale) * uGlassDistortion;
                vec2 rOff = vec2( sep,       sep * 0.5);
                vec2 gOff = vec2( 0.0,       0.0      );
                vec2 bOff = vec2(-sep,      -sep * 0.5);

                float angle = time * 0.15;
                float ca = cos(angle), sa = sin(angle);
                mat2 rot = mat2(ca, -sa, sa, ca);
                rOff = rot * rOff;
                bOff = rot * bOff;

                float r = texture2D(tDiffuse, clamp(uv + rOff, 0.001, 0.999)).r;
                float g = texture2D(tDiffuse, clamp(uv + gOff, 0.001, 0.999)).g;
                float b = texture2D(tDiffuse, clamp(uv + bOff, 0.001, 0.999)).b;

                float hue = fract(uv.x + uv.y * 0.5 + time * 0.05);
                vec3 rainbow;
                float h6 = hue * 6.0;
                float fi = floor(h6);
                float ff = h6 - fi;
                if      (fi < 1.0) rainbow = vec3(1.0, ff,  0.0);
                else if (fi < 2.0) rainbow = vec3(1.0-ff, 1.0, 0.0);
                else if (fi < 3.0) rainbow = vec3(0.0, 1.0, ff);
                else if (fi < 4.0) rainbow = vec3(0.0, 1.0-ff, 1.0);
                else if (fi < 5.0) rainbow = vec3(ff, 0.0, 1.0);
                else               rainbow = vec3(1.0, 0.0, 1.0-ff);
                
                rainbow *= 0.3 * amount * uEdgeHighlight; 

                gl_FragColor = vec4(vec3(r, g, b) + rainbow, 1.0);
                return;
            }
            else if (type == 5) { // ── Condensation (NEW) ───────────────────────
                vec2 p = uv * max(1.0, 8.0 * uGlassScale);
                p.x *= (uResolution.x / uResolution.y);
                
                vec2 gv = fract(p) - 0.5;
                vec2 id = floor(p);
                
                float n = hash(id);
                float t = time * 0.5 + n * 100.0;
                float dropSize = mix(0.1, 0.3, hash(id + 13.5));
                
                gv.y += sin(t) * 0.2 * step(0.8, hash(id + 7.2)); 
                
                float d = length(gv * vec2(1.0, 0.8));
                
                if (d < dropSize) {
                    vec3 normal = normalize(vec3(gv.x, gv.y, dropSize - d));
                    dir = normal.xy;
                    dist = amount * 0.15 * uGlassDistortion;
                    
                    float spec = pow(max(0.0, dot(normal, normalize(vec3(-1.0, 1.0, 1.0)))), 16.0);
                    highlight = vec3(spec * uEdgeHighlight * amount);
                } else {
                    float scale = 10.0;
                    vec2 n1 = vec2(fbm(uv * scale), fbm(uv * scale + 1.2));
                    dir = (n1 - 0.5);
                    dist = amount * 0.02;
                }
            }

            gl_FragColor = sampleWithChromatic(uv, dir, dist, highlight);
        }
    `
};



        

        

        // 4.5 BACKGROUND COMPOSITE
        const BgCompositeShader = {
            uniforms: {
                "tDiffuse": { value: null },
                "bgColor": { value: new THREE.Color('#03050a') }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform vec3 bgColor;
                varying vec2 vUv;
                void main() {
                    vec4 texel = texture2D( tDiffuse, vUv );
                    float alpha = clamp(max(texel.r, max(texel.g, texel.b)), 0.0, 1.0);
                    gl_FragColor = vec4( texel.rgb + bgColor * (1.0 - alpha), 1.0 );
                }
            `
        };
        this.bgCompositePass = new ShaderPass(BgCompositeShader);
        this.composer.addPass(this.bgCompositePass);

        

        // --- CUSTOM POST PROCESSING (Only Active Effects) ---
        

        

        

        

        

        

        

        
        
        

        

        if (this.composer.passes.length > 0) {
            this.composer.passes[this.composer.passes.length - 1].renderToScreen = true;
        }


        // OBJECTS
        this.dummy = new THREE.Object3D();
        this.color = new THREE.Color();
        this.target = new THREE.Vector3();
        this.pColor = new THREE.Color();
        
        this.geometry = new THREE.TetrahedronGeometry(0.25).clone();
        
        const W = Math.ceil(Math.sqrt(this.count));
        const H = W;
        const references = new Float32Array(this.count * 2);
        for (let i = 0; i < this.count; i++) {
            references[i * 2] = ((i % W) + 0.5) / W;
            references[i * 2 + 1] = (Math.floor(i / W) + 0.5) / H;
        }
        this.geometry.setAttribute('reference', new THREE.InstancedBufferAttribute(references, 2));

        const scales = new Float32Array(this.count);
        const opacities = new Float32Array(this.count);
        for(let i=0; i<this.count; i++) { scales[i] = 1.0; opacities[i] = 1.0; }
        this.geometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scales, 1));
        this.geometry.setAttribute('instanceOpacity', new THREE.InstancedBufferAttribute(opacities, 1));
        window.particleScales = scales;
        window.particleOpacities = opacities;

        this.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        // GPGPU Shader compiler
        const applyGPGPU = (mat) => {
            mat.onBeforeCompile = (shader) => {
                shader.uniforms.texturePosition = { value: null };
                shader.uniforms.gpgpuEnabled = { value: 1.0 };
                mat.userData.shader = shader;

                shader.vertexShader = `
                    attribute vec2 reference;
                    attribute float instanceScale;
                    attribute float instanceOpacity;
                    varying float vInstanceOpacity;
                    uniform sampler2D texturePosition;
                    uniform float gpgpuEnabled;
                ` + shader.vertexShader;

                shader.vertexShader = shader.vertexShader.replace(
                    '#include <project_vertex>',
                    `
                    vec4 mvPosition = vec4( transformed, 1.0 );
                    #ifdef USE_BATCHING
                        mvPosition = batchingMatrix * mvPosition;
                    #endif
                    #ifdef USE_INSTANCING
                        mvPosition.xyz *= instanceScale;
                        vInstanceOpacity = instanceOpacity;
                        
                        mat4 m = instanceMatrix;
                        if (gpgpuEnabled > 0.5) {
                            m[3] = vec4(0.0, 0.0, 0.0, 1.0);
                        }
                        mvPosition = m * mvPosition;
                        if (gpgpuEnabled > 0.5) {
                            mvPosition.xyz += texture2D(texturePosition, reference).xyz;
                        } else {
                            mvPosition.xyz += vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
                        }
                    #endif
                    mvPosition = modelViewMatrix * mvPosition;
                    gl_Position = projectionMatrix * mvPosition;
                    `
                );

                shader.fragmentShader = `
                    varying float vInstanceOpacity;
                ` + shader.fragmentShader;

                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <color_fragment>',
                    `
                    #include <color_fragment>
                    diffuseColor.a *= vInstanceOpacity;
                    `
                );
            };
            if (mat.uniforms) {
                mat.uniforms.texturePosition = { value: null };
                mat.uniforms.gpgpuEnabled = { value: 1.0 };
            }
            mat.needsUpdate = true;
        };
        applyGPGPU(this.material);

        this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.count);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(this.mesh);
        
        this.positions = [];
        this.targets = [];
        for(let i=0; i<this.count; i++) {
            const p = new THREE.Vector3((Math.random()-0.5)*100, (Math.random()-0.5)*100, (Math.random()-0.5)*100);
            this.positions.push(p.clone());
            this.targets.push(p.clone());
            this.mesh.setColorAt(i, this.color.setHex(0x00ff88));
        }

        // GPGPU PHYSICS ENGINE CORE
        this.targetTex = new THREE.DataTexture(new Float32Array(W * H * 4), W, H, THREE.RGBAFormat, THREE.FloatType);

        this.gpuCompute = new GPUComputationRenderer(W, H, this.renderer);
        const dtPosition = this.gpuCompute.createTexture();
        const dtVelocity = this.gpuCompute.createTexture();
        
        const posArray = dtPosition.image.data;
        const velArray = dtVelocity.image.data;
        for (let i = 0; i < W * H; i++) {
            const idx = i * 4;
            let x = (Math.random() - 0.5) * 100;
            let y = (Math.random() - 0.5) * 100;
            let z = (Math.random() - 0.5) * 100;
            posArray[idx] = x;
            posArray[idx + 1] = y;
            posArray[idx + 2] = z;
            posArray[idx + 3] = 1.0;

            velArray[idx] = 0.0;
            velArray[idx + 1] = 0.0;
            velArray[idx + 2] = 0.0;
            velArray[idx + 3] = 0.0;
        }

        const posShader = `
            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec3 pos = texture2D(texturePosition, uv).xyz;
                vec3 vel = texture2D(textureVelocity, uv).xyz;
                pos += vel * 0.016;
                gl_FragColor = vec4(pos, 1.0);
            }
        `;

        const velShader = `
            uniform float uTime;
            uniform float uDeltaTime;
            uniform float uStiffness;
            uniform float uDamping;
            uniform float uNoiseStrength;
            uniform int uPhysicsMode;
            uniform int uMouseMode;
            uniform float uMouseInfluence;
            uniform vec3 uMouse3D;
            uniform sampler2D textureTarget;
            uniform vec3 uGravity;
            uniform vec3 uShockwaveCenter;
            uniform float uShockwaveForce;
            uniform float uShockwaveRadius;

            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
            vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
            float snoise(vec3 v) {
                const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
                vec3 i  = floor(v + dot(v, vec3(C.y)));
                vec3 x0 = v - i + dot(i, vec3(C.x));
                vec3 g = step(x0.yzx, x0.xyz);
                vec3 l = 1.0 - g;
                vec3 i1 = min(g.xyz, l.zxy);
                vec3 i2 = max(g.xyz, l.zxy);
                vec3 x1 = x0 - i1 + vec3(C.x);
                vec3 x2 = x0 - i2 + vec3(C.y);
                vec3 x3 = x0 - D.yyy;
                i = mod289(i);
                vec4 p = permute(permute(permute(
                           i.z + vec4(0.0, i1.z, i2.z, 1.0))
                         + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                         + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                float n_ = 0.142857142857;
                vec3 ns = n_ * D.wyz - D.xzx;
                vec4 j = p - 49.0 * floor(p * ns.z);
                vec4 x_ = floor(j * ns.z);
                vec4 y_ = floor(j - 7.0 * x_);
                vec4 x = x_ *ns.x + ns.yyyy;
                vec4 y = y_ *ns.x + ns.yyyy;
                vec4 h = 1.0 - abs(x) - abs(y);
                vec4 b0 = vec4(x.xy, y.xy);
                vec4 b1 = vec4(x.zw, y.zw);
                vec4 s0 = floor(b0)*2.0 + 1.0;
                vec4 s1 = floor(b1)*2.0 + 1.0;
                vec4 sh = -step(h, vec4(0.0));
                vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
                vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
                vec3 p0 = vec3(a0.xy, h.x);
                vec3 p1 = vec3(a0.zw, h.y);
                vec3 p2 = vec3(a1.xy, h.z);
                vec3 p3 = vec3(a1.zw, h.w);
                vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
                p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
                vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                m = m * m;
                return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
            }

            vec3 curlNoise(vec3 p) {
                const float e = 0.05;
                float dx = snoise(vec3(p.x + e, p.y, p.z)) - snoise(vec3(p.x - e, p.y, p.z));
                float dy = snoise(vec3(p.x, p.y + e, p.z)) - snoise(vec3(p.x, p.y - e, p.z));
                float dz = snoise(vec3(p.x, p.y, p.z + e)) - snoise(vec3(p.x, p.y, p.z - e));
                return vec3(dy - dz, dz - dx, dx - dy) / (2.0 * e);
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec3 pos = texture2D(texturePosition, uv).xyz;
                vec3 vel = texture2D(textureVelocity, uv).xyz;
                vec3 target = texture2D(textureTarget, uv).xyz;

                vec3 force = vec3(0.0);

                // 1. Target Attraction / Spring Force
                if (uPhysicsMode == 0) {
                    vec3 desiredVel = (target - pos) * 10.0;
                    force += (desiredVel - vel) * 20.0;
                } else {
                    vec3 springForce = -uStiffness * (pos - target);
                    force += springForce;
                }

                // 2. Mouse Force
                if (uMouseMode > 0) {
                    float d = distance(pos, uMouse3D);
                    float radius = uMouseInfluence * 15.0;
                    if (d < radius && d > 0.1) {
                        float strength = (1.0 - d / radius);
                        vec3 mouseDir = normalize(pos - uMouse3D);
                        if (uMouseMode == 1) {
                            force -= mouseDir * strength * 150.0;
                        } else if (uMouseMode == 2) {
                            force += mouseDir * strength * 150.0;
                        } else if (uMouseMode == 3) {
                            vec3 up = vec3(0.0, 1.0, 0.0);
                            vec3 tangent = normalize(cross(mouseDir, up));
                            force += tangent * strength * 150.0;
                        }
                    }
                }

                // 3. Curl Noise / Turbulence
                if (uNoiseStrength > 0.0 || uPhysicsMode == 3) {
                    float scale = 0.05;
                    vec3 noiseOffset = curlNoise(pos * scale + vec3(0.0, 0.0, uTime * 0.2));
                    float currentNoiseStrength = uNoiseStrength * (uPhysicsMode == 3 ? 15.0 : 5.0);
                    force += noiseOffset * currentNoiseStrength;
                }

                // 4. Stochastic Flocking
                if (uPhysicsMode == 2) {
                    float seed = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
                    for(int k = 1; k <= 4; k++) {
                        vec2 sampleUv = fract(uv + vec2(
                            sin(float(k) * 1.7 + seed + uTime) * 0.27,
                            cos(float(k) * 2.3 + seed + uTime) * 0.31
                        ));
                        vec3 otherPos = texture2D(texturePosition, sampleUv).xyz;
                        float d = distance(pos, otherPos);
                        if (d < 4.0 && d > 0.01) {
                            vec3 repelDir = normalize(pos - otherPos);
                            force += repelDir * (1.0 - d / 4.0) * 120.0;
                        }
                    }
                }

                // 5. Gravity Override
                force += uGravity * 100.0;

                // 6. Shockwave (Radial Explosion)
                if (uShockwaveForce > 0.0) {
                    float d = distance(pos, uShockwaveCenter);
                    if (d < uShockwaveRadius && d > 0.1) {
                        float shockStrength = (1.0 - (d / uShockwaveRadius)) * uShockwaveForce;
                        vec3 shockDir = normalize(pos - uShockwaveCenter);
                        force += shockDir * shockStrength * 500.0;
                    }
                }

                vel += force * uDeltaTime;
                vel *= (1.0 - uDamping);

                float maxVel = 50.0;
                if (length(vel) > maxVel) {
                    vel = normalize(vel) * maxVel;
                }

                gl_FragColor = vec4(vel, 1.0);
            }
        `;

        this.positionVariable = this.gpuCompute.addVariable("texturePosition", posShader, dtPosition);
        this.velocityVariable = this.gpuCompute.addVariable("textureVelocity", velShader, dtVelocity);

        this.gpuCompute.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable]);
        this.gpuCompute.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);

        this.positionUniforms = this.positionVariable.material.uniforms;
        this.velocityUniforms = this.velocityVariable.material.uniforms;

        this.velocityUniforms.uTime = { value: 0.0 };
        this.velocityUniforms.uDeltaTime = { value: 0.016 };
        
        let pModeVal = 1;
        if (PHYSICS_MODE === 'lerp') pModeVal = 0;
        else if (PHYSICS_MODE === 'spring') pModeVal = 1;
        else if (PHYSICS_MODE === 'flocking') pModeVal = 2;
        else if (PHYSICS_MODE === 'fluid') pModeVal = 3;
        this.velocityUniforms.uPhysicsMode = { value: pModeVal };

        let mModeVal = 0;
        if (MOUSE_MODE === 'attract') mModeVal = 1;
        else if (MOUSE_MODE === 'repel') mModeVal = 2;
        else if (MOUSE_MODE === 'vortex') mModeVal = 3;
        this.velocityUniforms.uMouseMode = { value: mModeVal };
        this.velocityUniforms.uMouseInfluence = { value: MOUSE_INFLUENCE };
        this.velocityUniforms.uMouse3D = { value: new THREE.Vector3() };
        this.velocityUniforms.textureTarget = { value: this.targetTex };
        
        this.velocityUniforms.uStiffness = { value: STIFFNESS };
        this.velocityUniforms.uDamping = { value: DAMPING };
        this.velocityUniforms.uNoiseStrength = { value: NOISE_STRENGTH };

        this.velocityUniforms.uGravity = { value: new THREE.Vector3() };
        this.velocityUniforms.uShockwaveCenter = { value: new THREE.Vector3() };
        this.velocityUniforms.uShockwaveForce = { value: 0.0 };
        this.velocityUniforms.uShockwaveRadius = { value: 0.0 };

        this.gpuCompute.init();

        this.clock = new THREE.Clock();
        // Mouse tracking for physics
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.dummyPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        this.intersectPoint = new THREE.Vector3();
        
        window.addEventListener('pointermove', (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        this.animate = this.animate.bind(this);
        this.animate();
    }

    setPhysics(options) {
        if (!options) return;
        if (options.gravity) {
            if (!this.physicsOverrides.gravity) this.physicsOverrides.gravity = new THREE.Vector3();
            this.physicsOverrides.gravity.copy(options.gravity);
        }
        if (options.shockwave) {
            if (options.shockwave.center) {
                if (!this.physicsOverrides.shockwaveCenter) this.physicsOverrides.shockwaveCenter = new THREE.Vector3();
                this.physicsOverrides.shockwaveCenter.copy(options.shockwave.center);
            }
            if (options.shockwave.force !== undefined) this.physicsOverrides.shockwaveForce = options.shockwave.force;
            if (options.shockwave.radius !== undefined) this.physicsOverrides.shockwaveRadius = options.shockwave.radius;
        }
        if (options.stiffness !== undefined) this.physicsOverrides.stiffness = options.stiffness;
        if (options.drag !== undefined) this.physicsOverrides.damping = options.drag;
        if (options.turbulence !== undefined) this.physicsOverrides.noiseStrength = options.turbulence;
    }

    setEffects(options) {
        if (!options) return;
        if (options.glowIntensity !== undefined && this.bloomPass) this.bloomPass.strength = options.glowIntensity;
        if (options.glowThreshold !== undefined && this.bloomPass) this.bloomPass.threshold = options.glowThreshold;
        if (options.motionTrails !== undefined && this.afterimagePass) this.afterimagePass.uniforms['damp'].value = options.motionTrails;
        if (options.filmGrain !== undefined && this.filmPass) {
            this.filmPass.uniforms['intensity'].value = options.filmGrain;
            this.filmPass.enabled = options.filmGrain > 0;
        }
        if (options.vignette !== undefined && this.vignettePass) this.vignettePass.uniforms['darkness'].value = options.vignette;
        if (options.gaussianBlur !== undefined && this.hBlurPass && this.vBlurPass) {
            if (options.gaussianBlur === 0) {
                this.hBlurPass.enabled = false; this.vBlurPass.enabled = false;
            } else {
                this.hBlurPass.enabled = true; this.vBlurPass.enabled = true;
                this.hBlurPass.uniforms['h'].value = options.gaussianBlur / window.innerWidth;
                this.vBlurPass.uniforms['v'].value = options.gaussianBlur / window.innerHeight;
            }
        }
        if (options.radialBlur !== undefined && this.radialBlurPass) {
            if (options.radialBlur === 0) {
                this.radialBlurPass.enabled = false;
            } else {
                this.radialBlurPass.enabled = true;
                this.radialBlurPass.uniforms['strength'].value = options.radialBlur;
            }
        }
        if (options.bgColor !== undefined) {
            if (this.bgCompositePass) this.bgCompositePass.uniforms['bgColor'].value.set(options.bgColor);
            if (this.vignettePass) this.vignettePass.uniforms['color'].value.set(options.bgColor);
            document.body.style.background = options.bgColor;
        }
    }

    updateGPGPUTargets() {
        const data = this.targetTex.image.data;
        const W = Math.ceil(Math.sqrt(this.count));
        for (let i = 0; i < W * W; i++) {
            const idx = i * 4;
            if (i < this.count && i < this.targets.length) {
                const p = this.targets[i];
                data[idx] = p.x;
                data[idx + 1] = p.y;
                data[idx + 2] = p.z;
            } else {
                data[idx] = 999999.0;
                data[idx + 1] = 999999.0;
                data[idx + 2] = 999999.0;
            }
            data[idx + 3] = 1.0;
        }
        this.targetTex.needsUpdate = true;
    }

    animate() {
        requestAnimationFrame(this.animate);
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime() * this.speedMult;
        
        if(this.material.uniforms && this.material.uniforms.uTime) {
            this.material.uniforms.uTime.value = time;
        }

        if (this.velocityUniforms) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            this.raycaster.ray.intersectPlane(this.dummyPlane, this.intersectPoint);
            this.velocityUniforms.uMouse3D.value.copy(this.intersectPoint);
        }

        // API Stubs
        const PARAMS = {"knotP":3,"knotQ":2,"swirl":0.6,"radius":24,"tube":6,"glow":1.2};
        const addControl = (id, l, min, max, val) => {
             return PARAMS[id] !== undefined ? PARAMS[id] : val;
        };
        const setInfo = () => {};
        const annotate = () => {};
        const setPhysics = (options) => this.setPhysics(options);
        const setEffects = (options) => this.setEffects(options);
        let THREE_LIB = THREE;
        
        const count = this.count; // Alias for user code
        
        for(let i=0; i<this.count; i++) {
            let target = this.target;
            let color = this.pColor;
            
            // INJECTED CODE
            const knotP = addControl("knotP", "Knot Turns (p)", 1, 6, 3);
            const knotQ = addControl("knotQ", "Knot Turns (q)", 1, 6, 2);
            const swirl = addControl("swirl", "Swirl Speed", 0, 3, 0.6);
            const radius = addControl("radius", "Radius", 5, 60, 24);
            const tubeR = addControl("tube", "Tube Thickness", 0.5, 15, 6);
            const glow = addControl("glow", "Glow Pulse", 0, 3, 1.2);
            
            const safeCount = count > 1 ? count : 2;
            const t = (i / safeCount) * Math.PI * 2 * knotP + time * swirl * 0.2;
            const phase = (i / safeCount) * Math.PI * 2 * knotQ;
            
            const cosT = Math.cos(t);
            const sinT = Math.sin(t);
            const r = radius + tubeR * Math.cos(phase + time * 0.5);
            const z = tubeR * Math.sin(phase + time * 0.5) * 4;
            const wob = Math.sin(time * 1.3 + i * 0.001) * 2;
            
            target.set(
              (r + wob) * cosT,
              (r + wob) * sinT,
              z + Math.sin(t * 2 + time) * 3
            );
            
            const hue = ((i / safeCount) + time * 0.05) % 1;
            const pulse = 0.5 + 0.5 * Math.sin(time * glow + phase);
            color.setHSL(hue, 0.85, 0.35 + pulse * 0.35);
            
            if (i === 0) {
              setInfo("Bioluminescent Torus Knot", "A flowing (p,q) torus knot swarm pulsing with deep-sea light.");
              annotate("core", new THREE.Vector3(0, 0, 0), "Knot Core");
            }
            
            // UPDATE
            this.targets[i].copy(this.target);
            this.positions[i].lerp(this.targets[i], 0.1);

            this.dummy.position.set(0, 0, 0);
            if ('spark' === 'vector') {
                const lookDirection = this.targets[i].clone().sub(this.positions[i]).normalize().multiplyScalar(2);
                if (this.targets[i].distanceToSquared(this.positions[i]) > 0.1) {
                    this.dummy.lookAt(lookDirection);
                }
            } else if ('spark' === 'plasma' || 'spark' === 'ink' || 'spark' === 'paint') {
                this.dummy.lookAt(this.camera.position); // Billboard
            } else {
                this.dummy.rotation.set(0, 0, 0);
            }
            
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
            this.mesh.setColorAt(i, this.pColor);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        if(this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
        if(this.mesh.geometry.attributes.instanceScale) this.mesh.geometry.attributes.instanceScale.needsUpdate = true;
        if(this.mesh.geometry.attributes.instanceOpacity) this.mesh.geometry.attributes.instanceOpacity.needsUpdate = true;

        this.updateGPGPUTargets();

        if (this.velocityUniforms) {
            this.velocityUniforms.uTime.value = time;
            this.velocityUniforms.uDeltaTime.value = delta;
            
            if (this.physicsOverrides.gravity) {
                this.velocityUniforms.uGravity.value.copy(this.physicsOverrides.gravity);
            } else {
                this.velocityUniforms.uGravity.value.set(0, 0, 0);
            }
            if (this.physicsOverrides.shockwaveCenter && this.physicsOverrides.shockwaveForce !== null) {
                this.velocityUniforms.uShockwaveCenter.value.copy(this.physicsOverrides.shockwaveCenter);
                this.velocityUniforms.uShockwaveForce.value = this.physicsOverrides.shockwaveForce;
                this.velocityUniforms.uShockwaveRadius.value = this.physicsOverrides.shockwaveRadius;
            } else {
                this.velocityUniforms.uShockwaveForce.value = 0.0;
            }
            if (this.physicsOverrides.stiffness !== null) {
                this.velocityUniforms.uStiffness.value = this.physicsOverrides.stiffness;
            } else {
                // STIFFNESS from enclosing scope
                this.velocityUniforms.uStiffness.value = 2;
            }
            if (this.physicsOverrides.damping !== null) {
                this.velocityUniforms.uDamping.value = this.physicsOverrides.damping;
            } else {
                // DAMPING from enclosing scope
                this.velocityUniforms.uDamping.value = 0.08;
            }
            if (this.physicsOverrides.noiseStrength !== null) {
                this.velocityUniforms.uNoiseStrength.value = this.physicsOverrides.noiseStrength;
            } else {
                // NOISE_STRENGTH from enclosing scope
                this.velocityUniforms.uNoiseStrength.value = 0;
            }
        }

        this.gpuCompute.compute();

        const posTexture = this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture;
        if (this.material.userData.shader) {
            this.material.userData.shader.uniforms.texturePosition.value = posTexture;
            this.material.userData.shader.uniforms.gpgpuEnabled.value = 1.0;
        }
        if (this.material.uniforms && this.material.uniforms.texturePosition) {
            this.material.uniforms.texturePosition.value = posTexture;
            this.material.uniforms.gpgpuEnabled.value = 1.0;
        }

        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor.needsUpdate = true;
        
        this.composer.render(delta);
    }
    
    dispose() {
        this.geometry.dispose();
        this.material.dispose();
        this.scene.remove(this.mesh);
        this.renderer.dispose();
    }
}