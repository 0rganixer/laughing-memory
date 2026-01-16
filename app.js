import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* --- SYSTEM CONFIG & STATE --- */
const AppState = {
    user: localStorage.getItem('aura_user') || "Guest",
    course: localStorage.getItem('aura_course') || "strength",
    level: parseInt(localStorage.getItem('aura_lvl')) || 1,
    xp: parseInt(localStorage.getItem('aura_xp')) || 0,
    steps: parseInt(localStorage.getItem('aura_steps')) || 0,
    goal: parseInt(localStorage.getItem('aura_goal')) || 6000,
    theme: localStorage.getItem('aura_theme') || 'dark'
};

/* --- DATABASE OF WORKOUTS --- */
const CourseData = {
    strength: [
        { id: 's1', name: "Push Up Blitz", baseTime: 30, baseXP: 100 },
        { id: 's2', name: "Plank Hold", baseTime: 45, baseXP: 120 },
        { id: 's3', name: "Squat Power", baseTime: 60, baseXP: 150 }
    ],
    cardio: [
        { id: 'c1', name: "HIIT Sprints", baseTime: 30, baseXP: 110 },
        { id: 'c2', name: "Jumping Jacks", baseTime: 60, baseXP: 100 },
        { id: 'c3', name: "Burpee Burn", baseTime: 45, baseXP: 160 }
    ],
    zen: [
        { id: 'z1', name: "Deep Breath", baseTime: 60, baseXP: 80 },
        { id: 'z2', name: "Tree Pose", baseTime: 45, baseXP: 100 },
        { id: 'z3', name: "Lotus Flow", baseTime: 90, baseXP: 140 }
    ]
};

/* --- 1. AURA AI (GEMINI NANO WRAPPER) --- */
class AuraAI {
    constructor() {
        this.session = null;
    }

    async init() {
        // Feature detection for window.ai (Chrome built-in AI)
        if (window.ai && window.ai.languageModel) {
            try {
                this.session = await window.ai.languageModel.create();
                console.log("Gemini Nano: Initialized");
            } catch (e) { console.warn("Gemini Nano unavailable:", e); }
        }
    }

    async ask(prompt) {
        if (this.session) {
            try {
                return await this.session.prompt(prompt);
            } catch (e) { return this.heuristicFallback(prompt); }
        }
        return this.heuristicFallback(prompt);
    }

    heuristicFallback(prompt) {
        const p = prompt.toLowerCase();
        if(p.includes('hiit') || p.includes('strength')) return `Based on your ${AppState.course} course, high intensity is key. Keep intervals short but explosive.`;
        if(p.includes('diet') || p.includes('food')) return "Fuel efficiently. Protein for repair, Carbs for energy. Hydration is mandatory.";
        if(p.includes('level')) return `You are Level ${AppState.level}. To advance, complete the daily trials scaled to your metrics.`;
        return "I am processing your biometric data. Maintain consistency to upgrade your neural firmware.";
    }
}

/* --- 2. 3D VISUALIZATION ENGINE --- */
class VisualEngine {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.mixers = [];
        this.actions = {};
        this.activeAction = null;
        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);
        
        // Lighting
        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 3);
        const dir = new THREE.DirectionalLight(0xffffff, 1.5);
        dir.position.set(3, 10, 10);
        this.scene.add(hemi, dir);

        this.camera.position.set(0, 1, 5);

        // Load Model
        const loader = new GLTFLoader();
        loader.load('https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb', (gltf) => {
            const model = gltf.scene;
            model.position.y = -2;
            this.scene.add(model);
            const mixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach(c => this.actions[c.name] = mixer.clipAction(c));
            this.mixers.push(mixer);
            this.play('Idle');
        });

        this.animate();
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    play(name) {
        const next = this.actions[name] || this.actions['Idle'];
        if (this.activeAction !== next) {
            this.activeAction?.fadeOut(0.5);
            next.reset().fadeIn(0.5).play();
            this.activeAction = next;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.mixers.forEach(m => m.update(0.016));
        this.renderer.render(this.scene, this.camera);
    }
    
    setMode(mode) {
        // Shift camera for workout mode
        this.camera.position.z = mode === 'workout' ? 3.5 : 5;
    }
}

/* --- 3. WORKOUT MANAGER (Timer, Voice, Cam) --- */
class WorkoutManager {
    constructor(app) {
        this.app = app;
        this.timerInterval = null;
        this.videoEl = document.getElementById('webcam-feed');
        this.stream = null;
    }

    async start(workoutId) {
        // 1. Calculate difficulty based on level
        const base = [...CourseData.strength, ...CourseData.cardio, ...CourseData.zen].find(w => w.id === workoutId);
        // FORMULA: Time = Base * (1 + Level * 0.1)
        const duration = Math.floor(base.baseTime * (1 + (AppState.level * 0.1)));
        const xpReward = Math.floor(base.baseXP * (1 + (AppState.level * 0.05)));

        // 2. UI Shift
        document.getElementById('active-workout-page').classList.remove('hidden');
        document.getElementById('app-interface').classList.add('hidden');
        this.app.visuals.setMode('workout');
        
        // 3. Start Camera
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.videoEl.srcObject = this.stream;
        } catch(e) { console.warn("Camera denied"); }

        // 4. Start Robot Animation
        let animName = 'Idle';
        if(base.name.includes("Run") || base.name.includes("HIIT")) animName = 'Running';
        if(base.name.includes("Squat") || base.name.includes("Jump")) animName = 'Jump';
        this.app.visuals.play(animName);

        // 5. Start Logic
        this.runSession(base.name, duration, xpReward);
    }

    runSession(name, totalTime, xp) {
        let timeLeft = totalTime;
        document.getElementById('workout-title').innerText = name;
        this.speak(`Starting ${name}. Duration ${totalTime} seconds.`);

        this.timerInterval = setInterval(() => {
            timeLeft--;
            const min = Math.floor(timeLeft/60);
            const sec = timeLeft%60;
            document.getElementById('workout-timer').innerText = `${min}:${sec<10?'0'+sec:sec}`;
            
            const progress = ((totalTime - timeLeft) / totalTime) * 100;
            document.getElementById('workout-progress').style.width = `${progress}%`;

            if(timeLeft <= 0) {
                this.complete(xp);
            } else if (timeLeft === 5) {
                this.speak("Five seconds remaining.");
            }
        }, 1000);
    }

    complete(xp) {
        this.speak("Protocol complete.");
        this.app.addXP(xp);
        alert(`SESSION COMPLETE\n+${xp} XP Gained`);
        this.stop();
    }

    stop() {
        clearInterval(this.timerInterval);
        if(this.stream) this.stream.getTracks().forEach(t => t.stop());
        document.getElementById('active-workout-page').classList.add('hidden');
        document.getElementById('app-interface').classList.remove('hidden');
        this.app.visuals.setMode('dashboard');
        this.app.visuals.play('Idle');
    }

    speak(text) {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.0;
        window.speechSynthesis.speak(u);
    }
}

/* --- 4. MAIN APP CONTROLLER --- */
class App {
    constructor() {
        this.ai = new AuraAI();
        this.visuals = new VisualEngine();
        this.workoutManager = new WorkoutManager(this);
        this.init();
    }

    init() {
        this.ai.init();
        this.applyTheme();
        this.setupEventListeners();
        
        // Check Login State
        if(localStorage.getItem('aura_user')) {
            document.getElementById('login-sequence').classList.add('hidden');
            document.getElementById('app-interface').classList.remove('hidden');
            document.getElementById('app-interface').classList.add('app-active');
            this.loadDashboard();
        }

        // Course Selection Logic
        document.querySelectorAll('.course-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.course-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                AppState.course = btn.dataset.course;
            });
        });
    }

    setupEventListeners() {
        // Login
        document.getElementById('auth-btn').onclick = () => {
            const name = document.getElementById('user-input').value || "Operator";
            AppState.user = name;
            this.saveState();
            this.loginAnim();
        };

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                document.getElementById(`view-${e.target.dataset.target}`).classList.add('active');
            });
        });

        // Workout Cancel
        document.getElementById('cancel-workout-btn').onclick = () => this.workoutManager.stop();

        // Settings
        document.getElementById('open-settings').onclick = () => this.toggleSettings(true);
        document.getElementById('theme-toggle-btn').onclick = () => {
            AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
            this.saveState();
            this.applyTheme();
        };

        // AI Chat
        document.getElementById('ai-send').onclick = async () => {
            const inp = document.getElementById('ai-prompt');
            const txt = inp.value;
            if(!txt) return;
            this.addMsg(txt, 'user');
            inp.value = '';
            const id = this.addMsg('Thinking...', 'ai');
            const resp = await this.ai.ask(txt);
            document.getElementById(id).innerText = resp;
        };
    }

    loginAnim() {
        const log = document.getElementById('boot-logs');
        log.innerHTML = ">> BIOMETRICS CONFIRMED<br>>> COURSE: " + AppState.course.toUpperCase();
        document.getElementById('auth-btn').style.background = "#10b981";
        setTimeout(() => {
            document.getElementById('login-sequence').style.opacity = 0;
            setTimeout(() => {
                document.getElementById('login-sequence').classList.add('hidden');
                document.getElementById('app-interface').classList.remove('hidden');
                setTimeout(() => document.getElementById('app-interface').classList.add('app-active'), 50);
                this.loadDashboard();
            }, 800);
        }, 1500);
    }

    loadDashboard() {
        this.updateHUD();
        this.generateRandomLeaderboard();
        this.renderWorkouts();
        
        // Simulate Steps
        setInterval(() => {
            AppState.steps += Math.floor(Math.random() * 5);
            this.updateHUD();
        }, 5000);
    }

    renderWorkouts() {
        // Dashboard recommendations
        const container = document.getElementById('dashboard-workouts');
        const list = CourseData[AppState.course];
        container.innerHTML = list.map(w => `
            <button class="action-btn" onclick="app.workoutManager.start('${w.id}')">
                <i data-lucide="play"></i> ${w.name}
            </button>
        `).join('');

        // Challenges (Scaled)
        const cContainer = document.getElementById('challenge-list');
        cContainer.innerHTML = list.map(w => {
            const scaledTime = Math.floor(w.baseTime * (1 + (AppState.level * 0.15))); // Harder scaling
            const scaledXP = Math.floor(w.baseXP * (1 + (AppState.level * 0.1)));
            return `
            <div class="challenge-item" onclick="app.workoutManager.start('${w.id}')">
                <div>
                    <strong>${w.name} (Elite)</strong><br>
                    <span style="font-size:0.8rem; color:var(--text-secondary)">${scaledTime}s Duration</span>
                </div>
                <div style="text-align:right">
                    <span class="difficulty-badge">LVL ${AppState.level} SCALED</span>
                    <div style="color:var(--success); font-weight:700">+${scaledXP} XP</div>
                </div>
            </div>`;
        }).join('');
        lucide.createIcons();
    }

    generateRandomLeaderboard() {
        const names = ["K-Pax", "Neo_Fit", "Trinity", "Glitch", "Cipher", "Vortex", "Echo", "Nova", "Flux", "Zen"];
        const list = document.getElementById('rank-list');
        list.innerHTML = '';
        
        const data = names.map(n => ({
            name: n,
            score: Math.floor(Math.random() * 15000) + 2000
        }));
        
        // Add User
        data.push({ name: AppState.user + " (YOU)", score: AppState.steps, isMe: true });
        data.sort((a,b) => b.score - a.score);

        data.forEach((u, i) => {
            list.innerHTML += `
            <div class="rank-row" style="${u.isMe?'background:rgba(99,102,241,0.1); border-left:3px solid var(--accent)':''}">
                <div class="rank-num" style="color:${i<3?'var(--accent)':'var(--text-secondary)'}">#${i+1}</div>
                <div class="rank-name">${u.name}</div>
                <div class="rank-score">${u.score.toLocaleString()}</div>
            </div>`;
        });
    }

    addXP(amount) {
        AppState.xp += amount;
        const req = AppState.level * 500;
        if(AppState.xp >= req) {
            AppState.level++;
            AppState.xp = 0;
            alert("LEVEL UP! SYSTEM UPGRADED.");
        }
        this.saveState();
        this.updateHUD();
        this.renderWorkouts(); // Re-render to scale difficulty
    }

    updateHUD() {
        document.getElementById('hud-username').innerText = AppState.user;
        document.getElementById('hud-level').innerText = `LVL ${AppState.level}`;
        document.getElementById('hud-course').innerText = AppState.course.toUpperCase();
        document.getElementById('step-display').innerText = AppState.steps.toLocaleString();
        
        const req = AppState.level * 500;
        const pct = (AppState.xp / req) * 100;
        const circle = document.querySelector('.progress-ring__circle');
        const r = circle.r.baseVal.value;
        const c = r * 2 * Math.PI;
        circle.style.strokeDashoffset = c - (pct / 100) * c;
    }

    addMsg(txt, type) {
        const div = document.createElement('div');
        div.className = `msg ${type}`;
        div.innerText = txt;
        div.id = 'msg-' + Date.now();
        document.getElementById('chat-feed').appendChild(div);
        return div.id;
    }

    toggleSettings(show) {
        const m = document.getElementById('settings-modal');
        show ? m.classList.remove('hidden') : m.classList.add('hidden');
        if(show) {
            document.getElementById('edit-name').value = AppState.user;
            document.getElementById('edit-goal').value = AppState.goal;
        }
    }

    saveProfile() {
        AppState.user = document.getElementById('edit-name').value;
        AppState.goal = document.getElementById('edit-goal').value;
        this.saveState();
        this.updateHUD();
        this.toggleSettings(false);
    }

    applyTheme() {
        document.body.className = `theme-${AppState.theme}`;
    }

    saveState() {
        localStorage.setItem('aura_user', AppState.user);
        localStorage.setItem('aura_course', AppState.course);
        localStorage.setItem('aura_lvl', AppState.level);
        localStorage.setItem('aura_xp', AppState.xp);
        localStorage.setItem('aura_steps', AppState.steps);
        localStorage.setItem('aura_theme', AppState.theme);
    }
}

// Global Access
window.app = new App();