
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// --- CONFIG & MODES ---
const CONFIG = {
    particleCount: 1500,
    dustCount: 2000,
    gold: 0xd4af37,
    cream: 0xfceea7,
    red: 0xaa0000,
    green: 0x003311
};

const MODES = { TREE: 'tree', SCATTER: 'scatter', FOCUS: 'focus' };

const STATE = {
    mode: MODES.TREE,
    targetRotation: { x: 0, y: 0 },
    user: { name: 'Guest', isLoggedIn: false },
    isSyncing: false
};

// --- CLOUD STORAGE SYSTEM (Neon Integration) ---
class CloudStorage {
    private apiEndpoint = '/api/memories'; // Vercel Serverless Function path

    async savePhoto(base64: string, owner: string): Promise<any> {
        this.updateSyncStatus(true);
        console.log(`[Neon] Pushing memory to database for ${owner}...`);
        
        try {
            // Real integration: Fetch to Vercel API which talks to Neon
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_data: base64, owner })
            });

            if (!response.ok) throw new Error('DB Write Failed');
            
            const result = await response.json();
            return result;
        } catch (err) {
            console.warn('[Neon] Sync failed, falling back to local simulation', err);
            // Fallback to local storage if API is not yet deployed
            this.localFallback(base64, owner);
        } finally {
            this.updateSyncStatus(false);
        }
    }

    async getAll(): Promise<any[]> {
        this.updateSyncStatus(true);
        try {
            const response = await fetch(this.apiEndpoint);
            if (!response.ok) throw new Error('DB Read Failed');
            return await response.json();
        } catch (err) {
            const data = localStorage.getItem('christmas_cloud_memories');
            return data ? JSON.parse(data) : [];
        } finally {
            this.updateSyncStatus(false);
        }
    }

    private localFallback(base64: string, owner: string) {
        const data = localStorage.getItem('christmas_cloud_memories');
        const memories = data ? JSON.parse(data) : [];
        memories.push({ data: base64, owner, id: Date.now() });
        localStorage.setItem('christmas_cloud_memories', JSON.stringify(memories));
    }

    private updateSyncStatus(syncing: boolean) {
        STATE.isSyncing = syncing;
        const status = document.getElementById('status-bar');
        if (status) {
            status.style.borderColor = syncing ? '#ffaa00' : 'rgba(212, 175, 55, 0.2)';
            if (syncing) status.innerText = 'Cloud: Syncing...';
            else status.innerText = `Cloud: Connected as ${STATE.user.name}`;
        }
    }
}

const Cloud = new CloudStorage();

// --- 3D UTILS ---
function createTextTexture(text: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fceea7'; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 20; ctx.strokeRect(0,0,512,512);
    ctx.font = 'bold 50px "Cinzel"'; ctx.fillStyle = '#000'; ctx.textAlign = 'center';
    ctx.fillText(text, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// --- PARTICLE CLASSES ---
class ParticleSystem {
    scene: THREE.Scene;
    particles: AnimatedParticle[] = [];
    photoParticles: AnimatedParticle[] = [];
    currentFocusPhoto: AnimatedParticle | null = null;
    mainGroup: THREE.Group;
    
    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.mainGroup = new THREE.Group();
        this.scene.add(this.mainGroup);
    }

    async init() {
        // Base structure
        const geoBox = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const matGold = new THREE.MeshStandardMaterial({ color: CONFIG.gold, metalness: 0.8, roughness: 0.2 });
        const matGreen = new THREE.MeshStandardMaterial({ color: CONFIG.green, roughness: 0.8 });

        for (let i = 0; i < CONFIG.particleCount; i++) {
            const mesh = new THREE.Mesh(geoBox, Math.random() > 0.4 ? matGreen : matGold);
            const p = new AnimatedParticle(mesh, i, CONFIG.particleCount, 'DECOR');
            this.particles.push(p);
            this.mainGroup.add(mesh);
        }

        // Fetch from Neon via API
        const cloudPhotos = await Cloud.getAll();
        if (cloudPhotos.length === 0) {
            this.addPhotoFromData(createTextTexture("No Memories Yet").image.toDataURL());
        } else {
            cloudPhotos.forEach(p => this.addPhotoFromData(p.image_data || p.data));
        }
    }

    addPhotoFromData(base64: string) {
        const loader = new THREE.TextureLoader();
        loader.load(base64, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            const mat = new THREE.MeshStandardMaterial({ map: tex });
            const frameGeo = new THREE.BoxGeometry(1.2, 1.2, 0.1);
            const frameMat = new THREE.MeshStandardMaterial({ color: CONFIG.gold, metalness: 0.9 });
            const mesh = new THREE.Mesh(frameGeo, [frameMat, frameMat, frameMat, frameMat, mat, frameMat]);
            
            const p = new AnimatedParticle(mesh, this.particles.length, CONFIG.particleCount, 'PHOTO');
            this.particles.push(p);
            this.photoParticles.push(p);
            this.mainGroup.add(mesh);
            this.currentFocusPhoto = p;
        });
    }

    pickRandomPhoto() {
        if (this.photoParticles.length === 0) return;
        this.currentFocusPhoto = this.photoParticles[Math.floor(Math.random() * this.photoParticles.length)];
    }

    update(dt: number) {
        const isFocus = STATE.mode === MODES.FOCUS;
        this.mainGroup.rotation.y = THREE.MathUtils.lerp(this.mainGroup.rotation.y, isFocus ? 0 : STATE.targetRotation.y, 0.1);
        this.mainGroup.rotation.x = THREE.MathUtils.lerp(this.mainGroup.rotation.x, isFocus ? 0 : STATE.targetRotation.x, 0.1);
        this.particles.forEach(p => p.update(dt, STATE.mode, this.currentFocusPhoto));
    }
}

class AnimatedParticle {
    mesh: THREE.Mesh; index: number; total: number; type: string;
    posTree: THREE.Vector3; posScatter: THREE.Vector3;

    constructor(mesh: THREE.Mesh, index: number, total: number, type: string) {
        this.mesh = mesh; this.index = index; this.total = total; this.type = type;
        const t = index / total;
        const radius = 12 * (1 - t);
        this.posTree = new THREE.Vector3(Math.cos(t * 50) * radius, (t * 40) - 20, Math.sin(t * 50) * radius);
        if (type === 'PHOTO') {
            const rnd = Math.random() * 50;
            const r = 12 * (1 - (index%total)/total) + 1.5;
            this.posTree.set(Math.cos(rnd)*r, (Math.random()*40)-20, Math.sin(rnd)*r);
        }
        this.posScatter = new THREE.Vector3().randomDirection().multiplyScalar(15 + Math.random() * 10);
    }

    update(dt: number, mode: string, focusTarget: AnimatedParticle | null) {
        let targetPos = this.posTree; let targetScale = 1;
        if (mode === MODES.SCATTER) targetPos = this.posScatter;
        else if (mode === MODES.FOCUS) {
            if (this === focusTarget) {
                const isPortrait = window.innerHeight > window.innerWidth;
                targetPos = new THREE.Vector3(0, 2, isPortrait ? 30 : 38);
                targetScale = isPortrait ? 2.8 : 4.5;
                this.mesh.lookAt(0, 2, 50);
            } else targetPos = this.posScatter;
        }
        this.mesh.position.lerp(targetPos, 2.5 * dt);
        const s = THREE.MathUtils.lerp(this.mesh.scale.x, targetScale, 2.5 * dt);
        this.mesh.scale.setScalar(s);
    }
}

// --- APP CLASS ---
class App {
    clock = new THREE.Clock();
    scene!: THREE.Scene;
    camera!: THREE.PerspectiveCamera;
    renderer!: THREE.WebGLRenderer;
    composer!: any;
    system!: ParticleSystem;
    handLandmarker?: any;
    lastVideoTime = -1;

    constructor() {
        this.initAuth();
        this.initThree().then(() => {
            this.initMediaPipe();
            this.animate();
        });
    }

    initAuth() {
        const overlay = document.getElementById('auth-overlay');
        const loginBtn = document.getElementById('login-btn');
        const usernameInput = document.getElementById('username-input') as HTMLInputElement;

        loginBtn?.addEventListener('click', async () => {
            STATE.user.name = usernameInput.value || 'Guest';
            STATE.user.isLoggedIn = true;
            overlay?.classList.add('hidden');
            
            if (this.system) {
                this.system.mainGroup.clear();
                this.system.particles = [];
                this.system.photoParticles = [];
                await this.system.init();
            }
        });
    }

    async initThree() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 2, 50);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.4, 0.85));

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        this.system = new ParticleSystem(this.scene);
        await this.system.init();

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        document.getElementById('file-input')?.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const base64 = ev.target?.result as string;
                await Cloud.savePhoto(base64, STATE.user.name);
                this.system.addPhotoFromData(base64);
            };
            reader.readAsDataURL(file);
        });

        document.getElementById('loader')?.style.setProperty('display', 'none');
    }

    async initMediaPipe() {
        try {
            const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" },
                runningMode: "VIDEO", numHands: 1
            });
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            (document.getElementById('webcam') as HTMLVideoElement).srcObject = stream;
        } catch (e) { console.warn("Cam Error", e); }
    }

    animate = () => {
        requestAnimationFrame(this.animate);
        const dt = this.clock.getDelta();
        
        if (this.handLandmarker) {
            const video = document.getElementById('webcam') as HTMLVideoElement;
            
            // Fix: Add comprehensive check for video readiness and dimensions
            // MediaPipe requires a video element with calculated width/height > 0
            const isVideoReady = video.readyState >= 2 && 
                                 video.videoWidth > 0 && 
                                 video.videoHeight > 0;

            if (isVideoReady && video.currentTime !== this.lastVideoTime) {
                this.lastVideoTime = video.currentTime;
                try {
                    const res = this.handLandmarker.detectForVideo(video, performance.now());
                    if (res.landmarks?.length > 0) {
                        const hand = res.landmarks[0];
                        STATE.targetRotation.y = (hand[9].x - 0.5) * 2;
                        STATE.targetRotation.x = (hand[9].y - 0.5) * 1;
                        const d = Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y);
                        const oldMode = STATE.mode;
                        if (d < 0.05) {
                            STATE.mode = MODES.FOCUS;
                            if (oldMode !== MODES.FOCUS) this.system.pickRandomPhoto();
                        } else STATE.mode = MODES.TREE;
                    }
                } catch (err) {
                    // Gracefully skip frames that fail to process
                    console.error("MediaPipe detection error:", err);
                }
            }
        }
        
        this.system.update(dt);
        this.composer.render();
    }
}

new App();
