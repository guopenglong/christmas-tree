import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

console.log("Starting Application...");

// --- GLOBAL CONFIG & STATE ---
const CONFIG = {
    particleCount: 1500,
    dustCount: 2500,
    gold: 0xd4af37,
    cream: 0xfceea7,
    red: 0xaa0000,
    green: 0x003311
};

const MODES = {
    TREE: 'tree',
    SCATTER: 'scatter',
    FOCUS: 'focus'
};

const STATE = {
    mode: MODES.TREE,
    targetRotation: { x: 0, y: 0 },
    handPresent: false
};

// --- ASSET GENERATION ---

// Procedural Candy Cane Texture
function createCandyCaneTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 64);
    
    // Red stripes
    ctx.fillStyle = '#cc0000';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(16, 0); ctx.lineTo(64, 48); ctx.lineTo(64, 64); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 32); ctx.lineTo(32, 0); ctx.lineTo(48, 0); ctx.lineTo(0, 48); ctx.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Default Text Photo
function createTextTexture(text: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fceea7';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#d4af37'; // Border
    ctx.fillRect(0,0, 512, 20);
    ctx.fillRect(0,0, 20, 512);
    ctx.fillRect(492,0, 20, 512);
    ctx.fillRect(0,492, 512, 20);
    
    ctx.font = 'bold 60px "Cinzel"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 256);
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// --- PARTICLE CLASSES ---

class ParticleSystem {
    scene: THREE.Scene;
    particles: AnimatedParticle[];
    mainGroup: THREE.Group;
    matGold: THREE.MeshStandardMaterial;
    matGreen: THREE.MeshStandardMaterial;
    matSphereRed: THREE.MeshPhysicalMaterial;
    matSphereGold: THREE.MeshPhysicalMaterial;
    geoBox: THREE.BoxGeometry;
    geoSphere: THREE.SphereGeometry;
    geoCane: THREE.TubeGeometry;
    matCane: THREE.MeshStandardMaterial;
    geoFrame: THREE.BoxGeometry;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.particles = [];
        this.mainGroup = new THREE.Group();
        this.scene.add(this.mainGroup);
        
        // Materials
        this.matGold = new THREE.MeshStandardMaterial({ 
            color: CONFIG.gold, metalness: 0.9, roughness: 0.2 
        });
        this.matGreen = new THREE.MeshStandardMaterial({ 
            color: CONFIG.green, metalness: 0.3, roughness: 0.6 
        });
        this.matSphereRed = new THREE.MeshPhysicalMaterial({
            color: 0xaa0022, metalness: 0.1, roughness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.1
        });
        this.matSphereGold = new THREE.MeshPhysicalMaterial({
            color: CONFIG.gold, metalness: 0.8, roughness: 0.2, clearcoat: 1.0
        });

        // Geometries
        this.geoBox = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        this.geoSphere = new THREE.SphereGeometry(0.3, 16, 16);
        
        // Candy Cane Geometry
        const path = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, -0.5, 0),
            new THREE.Vector3(0, 0.5, 0),
            new THREE.Vector3(0.2, 0.7, 0),
            new THREE.Vector3(0.4, 0.4, 0)
        ]);
        this.geoCane = new THREE.TubeGeometry(path, 20, 0.08, 8, false);
        this.matCane = new THREE.MeshStandardMaterial({ 
            map: createCandyCaneTexture(), metalness: 0.1, roughness: 0.5 
        });

        // Photo Frame Geo
        this.geoFrame = new THREE.BoxGeometry(1.2, 1.2, 0.1);
    }

    init() {
        // 1. Structural Particles
        for (let i = 0; i < CONFIG.particleCount; i++) {
            const type = Math.random();
            let mesh;
            
            if (type < 0.6) {
                mesh = new THREE.Mesh(this.geoBox, Math.random() > 0.5 ? this.matGold : this.matGreen);
            } else if (type < 0.9) {
                mesh = new THREE.Mesh(this.geoSphere, Math.random() > 0.5 ? this.matSphereGold : this.matSphereRed);
            } else {
                mesh = new THREE.Mesh(this.geoCane, this.matCane);
                mesh.scale.set(0.5, 0.5, 0.5);
            }

            const p = new AnimatedParticle(mesh, i, CONFIG.particleCount, 'DECOR');
            this.particles.push(p);
            this.mainGroup.add(mesh);
        }

        // 2. Dust Particles (Simple small spheres)
        const dustGeo = new THREE.SphereGeometry(0.05, 4, 4);
        const dustMat = new THREE.MeshBasicMaterial({ color: CONFIG.cream, transparent: true, opacity: 0.6 });
        for(let i=0; i<CONFIG.dustCount; i++) {
            const mesh = new THREE.Mesh(dustGeo, dustMat);
            const p = new AnimatedParticle(mesh, i, CONFIG.dustCount, 'DUST');
            this.particles.push(p);
            this.mainGroup.add(mesh);
        }

        // 3. Initial Photo
        this.addPhoto(createTextTexture("JOYEUX NOEL"));
    }

    addPhoto(texture: THREE.Texture) {
        const mat = new THREE.MeshStandardMaterial({ 
            map: texture, 
            color: 0xffffff,
            metalness: 0.4, 
            roughness: 0.3 
        });
        const mesh = new THREE.Mesh(this.geoFrame, [
            this.matGold, this.matGold, this.matGold, this.matGold, mat, this.matGold
        ]);
        
        const idx = this.particles.length;
        const count = CONFIG.particleCount; // approximation for spiral calculation
        const p = new AnimatedParticle(mesh, idx, count, 'PHOTO');
        this.particles.push(p);
        this.mainGroup.add(mesh);
    }

    addPhotoToScene(t: THREE.Texture) {
        this.addPhoto(t);
    }

    update(dt: number) {
        // Smoothly rotate the entire group based on Hand Input
        this.mainGroup.rotation.y = THREE.MathUtils.lerp(this.mainGroup.rotation.y, STATE.targetRotation.y, 0.1);
        this.mainGroup.rotation.x = THREE.MathUtils.lerp(this.mainGroup.rotation.x, STATE.targetRotation.x, 0.1);

        // Pick a target photo for FOCUS mode
        let focusTarget: AnimatedParticle | null = null;
        if (STATE.mode === MODES.FOCUS) {
                // Find first photo or specific one
                focusTarget = this.particles.find(p => p.type === 'PHOTO') || null;
        }

        this.particles.forEach(p => p.update(dt, STATE.mode, focusTarget));
    }
}

class AnimatedParticle {
    mesh: THREE.Mesh;
    index: number;
    total: number;
    type: string;
    randomOffset: THREE.Vector3;
    rotationSpeed: THREE.Vector3;
    posTree: THREE.Vector3;
    posScatter: THREE.Vector3;
    dummy: THREE.Vector3;

    constructor(mesh: THREE.Mesh, index: number, total: number, type: string) {
        this.mesh = mesh;
        this.index = index;
        this.total = total;
        this.type = type;
        
        this.randomOffset = new THREE.Vector3(
            (Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2
        );
        this.rotationSpeed = new THREE.Vector3(
            Math.random()*2, Math.random()*2, Math.random()*2
        );

        // Tree Position Calculation (pre-calc)
        const t = index / total; // 0 to 1
        const angle = t * 50 * Math.PI;
        const height = (t * 40) - 20; // -20 to 20
        const maxRadius = 12;
        const radius = maxRadius * (1 - t) + (type === 'DUST' ? 2 : 0);
        
        this.posTree = new THREE.Vector3(
            Math.cos(angle) * radius,
            height,
            Math.sin(angle) * radius
        );

        if(type === 'PHOTO') {
            // Place photos randomly in the tree cone but slightly pushed out
            const rndT = Math.random();
            const rAngle = rndT * 50 * Math.PI;
            const rH = (rndT * 40) - 20;
            const rR = 12 * (1 - rndT) + 1.5;
            this.posTree.set(Math.cos(rAngle)*rR, rH, Math.sin(rAngle)*rR);
        }

        // Scatter Position
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = 8 + Math.random() * 12; // 8 to 20
        this.posScatter = new THREE.Vector3(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
        
        this.dummy = new THREE.Vector3(); // Temp
    }

    update(dt: number, mode: string, focusTarget: AnimatedParticle | null) {
        let targetPos = this.posTree;
        let targetScale = 1;
        
        if (mode === MODES.SCATTER) {
            targetPos = this.posScatter;
            // Rotate in Scatter mode
            this.mesh.rotation.x += this.rotationSpeed.x * dt;
            this.mesh.rotation.y += this.rotationSpeed.y * dt;
        } else if (mode === MODES.FOCUS) {
            if (this === focusTarget) {
                targetPos = new THREE.Vector3(0, 2, 35); // Front of camera
                targetScale = 4.5;
                // Always face camera
                this.mesh.lookAt(0, 2, 50);
            } else {
                // Background scatter
                targetPos = this.posScatter;
            }
        } else {
            // Tree Mode Rotations (reset or gentle sway)
            if(this.type !== 'DUST') {
                this.mesh.rotation.y += 0.5 * dt;
            }
        }

        // Smooth Transition (Lerp)
        const speed = 2.0 * dt;
        this.mesh.position.lerp(targetPos, speed);
        
        // Scale Lerp
        const s = this.mesh.scale.x;
        const ns = THREE.MathUtils.lerp(s, targetScale, speed);
        if (this.type !== 'CANE') { // Cane has different base scale, simplified here
                this.mesh.scale.setScalar(ns);
        } else if (this === focusTarget) {
                this.mesh.scale.setScalar(ns);
        }
    }
}

// --- MAIN APP ---

class App {
    clock: THREE.Clock;
    enableCam: boolean;
    scene!: THREE.Scene;
    camera!: THREE.PerspectiveCamera;
    renderer!: THREE.WebGLRenderer;
    composer!: EffectComposer;
    system!: ParticleSystem;
    handLandmarker?: HandLandmarker;
    lastVideoTime: number = -1;

    constructor() {
        this.animate = this.animate.bind(this);
        this.clock = new THREE.Clock();
        this.enableCam = false;

        this.initThree().then(() => {
            this.initUI();
            this.hideLoader(); // Hide loader as soon as Three.js is ready
            this.initMediaPipe().catch(err => console.error("MediaPipe failed:", err));
        }).catch(err => {
            console.error("Critical Three.js Init Error", err);
            this.hideLoader();
            alert("Could not load 3D engine. Please use a WebGL compatible browser.");
        });
    }

    hideLoader() {
        const loader = document.getElementById('loader');
        if (loader && loader.style.display !== 'none') {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 800);
        }
    }

    async initThree() {
        // Scene
        this.scene = new THREE.Scene();
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 2, 50);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.renderer.toneMappingExposure = 2.2;
        document.body.appendChild(this.renderer.domElement);

        // Environment
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
        const roomEnv = new RoomEnvironment();
        this.scene.environment = pmremGenerator.fromScene(roomEnv).texture;
        roomEnv.dispose();

        // Post Processing
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.7;
        bloomPass.strength = 0.45;
        bloomPass.radius = 0.4;
        this.composer.addPass(bloomPass);

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const innerLight = new THREE.PointLight(0xffaa00, 2, 20);
        innerLight.position.set(0, 0, 0);
        this.scene.add(innerLight);

        const spotGold = new THREE.SpotLight(0xffd700, 1200);
        spotGold.position.set(30, 40, 40);
        spotGold.angle = Math.PI / 4;
        spotGold.penumbra = 0.5;
        this.scene.add(spotGold);

        const spotBlue = new THREE.SpotLight(0x4444ff, 600);
        spotBlue.position.set(-30, 20, -30);
        spotBlue.lookAt(0,0,0);
        this.scene.add(spotBlue);

        // Content
        this.system = new ParticleSystem(this.scene);
        this.system.init();

        // Listeners
        window.addEventListener('resize', () => this.onResize());
        
        requestAnimationFrame(this.animate);
    }

    initUI() {
        // H to hide
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'h') {
                document.querySelector('#ui-container')?.classList.toggle('ui-hidden');
            }
        });

        // Upload Logic
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e: Event) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (!f) return;
                
                const reader = new FileReader();
                reader.onload = (ev) => {
                    new THREE.TextureLoader().load(ev.target?.result as string, (t) => {
                        t.colorSpace = THREE.SRGBColorSpace; 
                        this.system.addPhotoToScene(t); // Wrapper method needed
                    });
                };
                reader.readAsDataURL(f);
            });
        }
    }

    async initMediaPipe() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });

        // Setup Webcam
        const video = document.getElementById('webcam') as HTMLVideoElement;
        const constraints = { video: true };
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            video.addEventListener('loadeddata', () => {
                this.enableCam = true;
            });
        } catch (err) {
            console.warn("Webcam access denied or unavailable", err);
        }
    }

    processGestures(result: HandLandmarkerResult) {
        if (!result.landmarks || result.landmarks.length === 0) {
            STATE.handPresent = false;
            // Slowly return to 0 rotation if no hand
            STATE.targetRotation.x = 0;
            STATE.targetRotation.y = 0;
            return;
        }

        STATE.handPresent = true;
        const hand = result.landmarks[0]; // {x,y,z} normalized

        // 1. Interaction Mapping (Rotation)
        // Landmark 9 is middle finger mcp (roughly center of palm)
        const palm = hand[9];
        // Map x (0..1) to Rotation Y (-PI..PI) - inverted for mirror feel
        // Map y (0..1) to Rotation X (-PI/4 .. PI/4)
        STATE.targetRotation.y = (palm.x - 0.5) * 2.0; 
        STATE.targetRotation.x = (palm.y - 0.5) * 1.0;

        // 2. Gesture Recognition
        const wrist = hand[0];
        const thumbTip = hand[4];
        const indexTip = hand[8];
        const tips = [8, 12, 16, 20].map(i => hand[i]);

        // Math utilities
        const dist = (p1: any, p2: any) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
        
        // Pinch: Thumb to Index
        const pinchDist = dist(thumbTip, indexTip);
        
        // Fist/Open: Avg distance from tips to wrist
        let avgDistToWrist = 0;
        tips.forEach(t => avgDistToWrist += dist(t, wrist));
        avgDistToWrist /= 4;

        if (pinchDist < 0.05) {
            if (STATE.mode !== MODES.FOCUS) console.log("Gesture: PINCH -> FOCUS");
            STATE.mode = MODES.FOCUS;
        } else if (avgDistToWrist < 0.25) {
            if (STATE.mode !== MODES.TREE) console.log("Gesture: FIST -> TREE");
            STATE.mode = MODES.TREE;
        } else if (avgDistToWrist > 0.4) {
            if (STATE.mode !== MODES.SCATTER) console.log("Gesture: OPEN -> SCATTER");
            STATE.mode = MODES.SCATTER;
        }
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate);
        
        const dt = this.clock.getDelta();

        // CV Loop
        if (this.enableCam && this.handLandmarker) {
            const video = document.getElementById('webcam') as HTMLVideoElement;
            if (video && video.currentTime !== this.lastVideoTime) {
                this.lastVideoTime = video.currentTime;
                const startTime = performance.now();
                const result = this.handLandmarker.detectForVideo(video, startTime);
                this.processGestures(result);
            }
        }

        // Three.js Update
        if (this.system) {
            this.system.update(dt);
        }
        
        // Render
        if (this.composer) {
            this.composer.render();
        }
    }
}

// Start with error handling
try {
    new App();
} catch (e) {
    console.error("Critical Start Error", e);
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
    alert("Application failed to start. Check console.");
}