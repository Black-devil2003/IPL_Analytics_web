/**
 * ====================================================================
 * IPL ANALYTICS 3D MANAGER ENGINE (Three.js integration)
 * High-performance, low-overhead, professional 3D visualizer
 * ====================================================================
 */

class IPL3DManager {
    constructor() {
        this.activeScenes = {};
        this.isWebGLSupported = this.checkWebGLSupport();
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.deviceTier = this.detectDeviceTier();

        // Bind window resize listener once
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Listen to reduced motion preference changes
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
            this.prefersReducedMotion = e.matches;
        });
    }

    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    detectDeviceTier() {
        // Simple heuristic for low-end / mobile devices
        const isMobile = window.innerWidth <= 768;
        const memory = navigator.deviceMemory || 4;
        const hardwareConcurrency = navigator.hardwareConcurrency || 4;
        if (isMobile || memory < 4 || hardwareConcurrency < 4) {
            return 'low';
        }
        return 'high';
    }

    // Safely dispose of a scene by key to free GPU resources
    disposeScene(key) {
        if (!this.activeScenes[key]) return;
        const item = this.activeScenes[key];

        if (item.animFrameId) {
            cancelAnimationFrame(item.animFrameId);
        }

        if (item.resizeObserver) {
            item.resizeObserver.disconnect();
        }

        if (item.controls) {
            item.controls.dispose();
        }

        if (item.scene) {
            item.scene.traverse((child) => {
                if (child.isMesh || child.isPoints || child.isLine) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        }

        if (item.renderer) {
            if (item.renderer.domElement && item.renderer.domElement.parentNode) {
                item.renderer.domElement.parentNode.removeChild(item.renderer.domElement);
            }
            item.renderer.dispose();
        }

        delete this.activeScenes[key];
    }

    disposeAll() {
        Object.keys(this.activeScenes).forEach(key => this.disposeScene(key));
    }

    handleResize() {
        Object.values(this.activeScenes).forEach(item => {
            if (!item.container || !item.renderer || !item.camera) return;
            const width = item.container.clientWidth;
            const height = item.container.clientHeight;
            if (width > 0 && height > 0) {
                item.camera.aspect = width / height;
                item.camera.updateProjectionMatrix();
                item.renderer.setSize(width, height);
            }
        });
    }

    // --------------------------------------------------------------------
    // FEATURE 1: DASHBOARD HERO 3D SCENE
    // --------------------------------------------------------------------
    initDashboardHero3D(containerId) {
        const key = 'dashboardHero';
        this.disposeScene(key);

        const container = document.getElementById(containerId);
        if (!container) return;

        if (!this.isWebGLSupported || typeof THREE === 'undefined') {
            container.innerHTML = `
                <div class="hero-3d-fallback">
                    <div class="fallback-ball">🏏</div>
                    <span class="fallback-text">IPL Data Intelligence</span>
                </div>`;
            return;
        }

        const width = container.clientWidth || 300;
        const height = container.clientHeight || 260;

        // Scene, Camera, Renderer
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 0, 8);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        // Ambient Lighting (Dark Blue/Indigo atmospheric tint)
        const ambientLight = new THREE.AmbientLight(0x1E1B4B, 2.5);
        scene.add(ambientLight);

        // Key Spotlight (Stadium light effect)
        const spotLight = new THREE.SpotLight(0x60A5FA, 4);
        spotLight.position.set(5, 8, 6);
        spotLight.angle = Math.PI / 4;
        spotLight.penumbra = 0.8;
        spotLight.castShadow = true;
        scene.add(spotLight);

        // Gold Accent Light
        const goldLight = new THREE.PointLight(0xF59E0B, 3, 12);
        goldLight.position.set(-4, -2, 4);
        scene.add(goldLight);

        // Group for ball & bat
        const mainGroup = new THREE.Group();
        scene.add(mainGroup);

        // 1. Realistic 3D Cricket Ball (Procedural Sphere + Leather Bump Canvas + Seam)
        const ballRadius = 1.1;
        const ballGeo = new THREE.SphereGeometry(ballRadius, 32, 32);
        
        // Generate leather texture canvas
        const ballCanvas = document.createElement('canvas');
        ballCanvas.width = 256;
        ballCanvas.height = 256;
        const ctx = ballCanvas.getContext('2d');
        ctx.fillStyle = '#991B1B'; // Dark Crimson leather
        ctx.fillRect(0, 0, 256, 256);
        // Add seam line
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 6;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, 128);
        ctx.lineTo(256, 128);
        ctx.stroke();

        const ballTexture = new THREE.CanvasTexture(ballCanvas);
        const ballMat = new THREE.MeshStandardMaterial({
            map: ballTexture,
            roughness: 0.35,
            metalness: 0.1,
            clearcoat: 0.4,
            clearcoatRoughness: 0.2
        });
        const ballMesh = new THREE.Mesh(ballGeo, ballMat);
        ballMesh.castShadow = true;
        ballMesh.position.set(-0.6, 0.2, 0);
        mainGroup.add(ballMesh);

        // White Seam 3D Ring overlay
        const seamGeo = new THREE.TorusGeometry(ballRadius + 0.01, 0.025, 16, 64);
        const seamMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.5 });
        const seamMesh = new THREE.Mesh(seamGeo, seamMat);
        seamMesh.rotation.x = Math.PI / 2;
        ballMesh.add(seamMesh);

        // 2. Cricket Bat (Blade + Handle)
        const batGroup = new THREE.Group();
        // Blade
        const bladeGeo = new THREE.BoxGeometry(0.4, 2.8, 0.12);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xD97706, roughness: 0.6 }); // Wood tone
        const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
        bladeMesh.position.set(0, 0, 0);
        batGroup.add(bladeMesh);
        // Handle
        const handleGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 16);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.4 }); // Rubber grip
        const handleMesh = new THREE.Mesh(handleGeo, handleMat);
        handleMesh.position.set(0, 1.8, 0);
        batGroup.add(handleMesh);

        batGroup.position.set(1.5, -0.2, -0.5);
        batGroup.rotation.z = -Math.PI / 6;
        batGroup.rotation.y = Math.PI / 8;
        mainGroup.add(batGroup);

        // 3. Floating Data Particles
        const particleCount = this.deviceTier === 'low' ? 35 : 75;
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 10;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
            velocities.push({
                y: 0.003 + Math.random() * 0.005,
                x: (Math.random() - 0.5) * 0.002
            });
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const particleMat = new THREE.PointsMaterial({
            color: 0x60A5FA,
            size: 0.08,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending
        });
        const particleSystem = new THREE.Points(particleGeo, particleMat);
        scene.add(particleSystem);

        // 4. Subtle Stadium Base Ring
        const ringGeo = new THREE.RingGeometry(2.5, 3.8, 48);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x3B82F6, side: THREE.DoubleSide, transparent: true, opacity: 0.15 });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.position.y = -2;
        scene.add(ringMesh);

        // Parallax Mouse Interpolation variables
        let mouseX = 0, mouseY = 0;
        let targetX = 0, targetY = 0;

        const onMouseMove = (e) => {
            const rect = container.getBoundingClientRect();
            mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        };
        container.addEventListener('mousemove', onMouseMove);

        // Animation Loop
        let clock = new THREE.Clock();

        const animate = () => {
            const animFrameId = requestAnimationFrame(animate);
            this.activeScenes[key].animFrameId = animFrameId;

            const elapsedTime = clock.getElapsedTime();

            if (!this.prefersReducedMotion) {
                // Ball slow rotation & floating
                ballMesh.rotation.y = elapsedTime * 0.4;
                ballMesh.rotation.x = Math.sin(elapsedTime * 0.5) * 0.1;
                ballMesh.position.y = 0.2 + Math.sin(elapsedTime * 1.5) * 0.08;

                // Bat subtle sway
                batGroup.position.y = -0.2 + Math.cos(elapsedTime * 1.2) * 0.05;
                batGroup.rotation.y = Math.PI / 8 + Math.sin(elapsedTime * 0.8) * 0.05;

                // Particle update
                const posArr = particleGeo.attributes.position.array;
                for (let i = 0; i < particleCount; i++) {
                    posArr[i * 3 + 1] += velocities[i].y;
                    posArr[i * 3] += velocities[i].x;

                    if (posArr[i * 3 + 1] > 4) {
                        posArr[i * 3 + 1] = -3;
                        posArr[i * 3] = (Math.random() - 0.5) * 10;
                    }
                }
                particleGeo.attributes.position.needsUpdate = true;

                // Smooth Parallax camera movement
                targetX += (mouseX * 0.4 - targetX) * 0.05;
                targetY += (-mouseY * 0.4 - targetY) * 0.05;
                camera.position.x = targetX;
                camera.position.y = targetY;
                camera.lookAt(0, 0, 0);
            }

            renderer.render(scene, camera);
        };

        this.activeScenes[key] = {
            container, scene, camera, renderer,
            animFrameId: null
        };

        animate();
    }

    // --------------------------------------------------------------------
    // FEATURE 2: PLAYER 3D STAGE & FLOATING STAT CALLOUTS
    // --------------------------------------------------------------------
    initPlayer3DStage(containerId, playerData) {
        const key = 'playerStage';
        this.disposeScene(key);

        const container = document.getElementById(containerId);
        if (!container) return;

        if (!this.isWebGLSupported || typeof THREE === 'undefined') {
            container.innerHTML = `<div class="player-3d-fallback">🏏 3D Player Stage</div>`;
            return;
        }

        const width = container.clientWidth || 340;
        const height = container.clientHeight || 280;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 1.2, 5.5);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        container.appendChild(renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x38BDF8, 2);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0x3B82F6, 4, 10);
        pointLight.position.set(2, 4, 3);
        scene.add(pointLight);

        // Translucent Neon Pedestal
        const pedestalGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.3, 32);
        const pedestalMat = new THREE.MeshStandardMaterial({
            color: 0x1E1B4B,
            roughness: 0.2,
            metalness: 0.8,
            transparent: true,
            opacity: 0.85
        });
        const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
        pedestal.position.y = -1.2;
        scene.add(pedestal);

        // Glowing Neon Pedestal Ring
        const ringGeo = new THREE.TorusGeometry(1.65, 0.03, 16, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -1.05;
        scene.add(ring);

        // 3D Player Hologram Avatar Object (Stylized Helmet & Trophy Shield)
        const playerGroup = new THREE.Group();
        scene.add(playerGroup);

        // Helmet/Head Core
        const headGeo = new THREE.SphereGeometry(0.6, 32, 32);
        const headMat = new THREE.MeshStandardMaterial({
            color: 0x2563EB,
            roughness: 0.3,
            metalness: 0.5,
            wireframe: false
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.4;
        playerGroup.add(head);

        // Visor/Grill
        const visorGeo = new THREE.TorusGeometry(0.45, 0.04, 16, 32, Math.PI);
        const visorMat = new THREE.MeshStandardMaterial({ color: 0xFACC15, metalness: 0.9, roughness: 0.1 });
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.rotation.x = Math.PI / 6;
        visor.position.set(0, 0.4, 0.25);
        playerGroup.add(visor);

        // Shoulders/Body Core
        const bodyGeo = new THREE.CylinderGeometry(0.8, 0.5, 1.0, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.5 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = -0.4;
        playerGroup.add(body);

        // Floating Stats Overlay HTML container
        const statsOverlay = document.createElement('div');
        statsOverlay.className = 'player-3d-stats-overlay';

        const runs = playerData ? playerData.runs || '0' : '0';
        const sr = playerData ? playerData.sr || '0.0' : '0.0';
        const sixes = playerData ? playerData.sixes || '0' : '0';
        const fours = playerData ? playerData.fours || '0' : '0';

        statsOverlay.innerHTML = `
            <div class="stat-badge stat-badge-runs">
                <span class="badge-lbl">RUNS</span>
                <span class="badge-val">${runs}</span>
            </div>
            <div class="stat-badge stat-badge-sr">
                <span class="badge-lbl">STRIKE RATE</span>
                <span class="badge-val">${sr}</span>
            </div>
            <div class="stat-badge stat-badge-sixes">
                <span class="badge-lbl">SIXES</span>
                <span class="badge-val">${sixes}</span>
            </div>
            <div class="stat-badge stat-badge-fours">
                <span class="badge-lbl">FOURS</span>
                <span class="badge-val">${fours}</span>
            </div>
        `;
        container.appendChild(statsOverlay);

        let clock = new THREE.Clock();

        const animate = () => {
            const animFrameId = requestAnimationFrame(animate);
            this.activeScenes[key].animFrameId = animFrameId;

            const elapsed = clock.getElapsedTime();

            if (!this.prefersReducedMotion) {
                playerGroup.rotation.y = Math.sin(elapsed * 0.6) * 0.3;
                playerGroup.position.y = Math.sin(elapsed * 1.5) * 0.05;
                ring.rotation.z = elapsed * 0.5;
            }

            renderer.render(scene, camera);
        };

        this.activeScenes[key] = {
            container, scene, camera, renderer,
            animFrameId: null
        };

        animate();
    }

    // --------------------------------------------------------------------
    // FEATURE 3: 3D TEAM CARDS TILT HOVER (DOM enhancement)
    // --------------------------------------------------------------------
    initTeamCard3DEffects(cardElements) {
        if (!cardElements || cardElements.length === 0) return;

        cardElements.forEach(card => {
            if (card.dataset.has3dTilt) return;
            card.dataset.has3dTilt = "true";

            card.addEventListener('mousemove', (e) => {
                if (this.prefersReducedMotion) return;

                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = ((y - centerY) / centerY) * -8; // max 8 deg tilt
                const rotateY = ((x - centerX) / centerX) * 8;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(8px)`;
                
                const logo = card.querySelector('.team-card-logo, .team-detail-avatar');
                if (logo) {
                    logo.style.transform = `translateZ(20px)`;
                }
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)`;
                const logo = card.querySelector('.team-card-logo, .team-detail-avatar');
                if (logo) {
                    logo.style.transform = `translateZ(0px)`;
                }
            });
        });
    }

    // --------------------------------------------------------------------
    // FEATURE 4: 3D ANALYTICS PLAYER PERFORMANCE MAP (Scatter plot)
    // --------------------------------------------------------------------
    initAnalysis3DMap(containerId, playersData) {
        const key = 'analysis3DMap';
        this.disposeScene(key);

        const container = document.getElementById(containerId);
        if (!container) return;

        if (!this.isWebGLSupported || typeof THREE === 'undefined') {
            container.innerHTML = `
                <div class="analysis-3d-fallback">
                    <p>3D WebGL Visualization is unavailable in this environment.</p>
                </div>`;
            return;
        }

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 500;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0B0F19); // Dark blue/indigo

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(30, 25, 45);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        container.appendChild(renderer.domElement);

        // OrbitControls
        let controls = null;
        if (typeof THREE.OrbitControls !== 'undefined') {
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.maxDistance = 120;
            controls.minDistance = 10;
        }

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xFFFFFF, 1.2);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0x60A5FA, 2);
        dirLight.position.set(20, 40, 20);
        scene.add(dirLight);

        // 3D Grid & Axes Box
        const gridHelper = new THREE.GridHelper(40, 20, 0x3B82F6, 0x1E293B);
        gridHelper.position.set(20, 0, 20);
        scene.add(gridHelper);

        // Axis Lines
        const axesGroup = new THREE.Group();

        // X Axis (Runs - Blue)
        const xAxisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(40,0,0)]);
        const xAxisMat = new THREE.LineBasicMaterial({ color: 0x3B82F6, linewidth: 2 });
        axesGroup.add(new THREE.Line(xAxisGeo, xAxisMat));

        // Y Axis (Strike Rate - Green)
        const yAxisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,30,0)]);
        const yAxisMat = new THREE.LineBasicMaterial({ color: 0x10B981, linewidth: 2 });
        axesGroup.add(new THREE.Line(yAxisGeo, yAxisMat));

        // Z Axis (Sixes - Gold)
        const zAxisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,40)]);
        const zAxisMat = new THREE.LineBasicMaterial({ color: 0xF59E0B, linewidth: 2 });
        axesGroup.add(new THREE.Line(zAxisGeo, zAxisMat));

        scene.add(axesGroup);

        // Render Data Points (Top Players)
        const dataGroup = new THREE.Group();
        scene.add(dataGroup);

        const dataset = (playersData && playersData.length > 0) ? playersData.slice(0, 80) : [];

        // Max scale values for normalization
        const maxRuns = 8000;
        const maxSR = 200;
        const maxSixes = 350;

        const sphereGeo = new THREE.SphereGeometry(0.7, 16, 16);
        const playerMeshes = [];

        dataset.forEach((p, idx) => {
            const r = p.runs || 0;
            const sr = p.strike_rate || p.sr || 100;
            const sixes = p.sixes || 0;

            // Map to 3D grid space (X: 0 to 40, Y: 0 to 30, Z: 0 to 40)
            const posX = Math.min((r / maxRuns) * 40, 40);
            const posY = Math.min((sr / maxSR) * 30, 30);
            const posZ = Math.min((sixes / maxSixes) * 40, 40);

            // Color gradient based on Runs / SR
            const hue = 0.6 - (r / maxRuns) * 0.45; // Blue to Gold/Red
            const color = new THREE.Color().setHSL(hue, 0.85, 0.55);

            const mat = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.3,
                metalness: 0.4,
                emissive: color,
                emissiveIntensity: 0.2
            });

            const mesh = new THREE.Mesh(sphereGeo, mat);
            mesh.position.set(posX, posY, posZ);
            mesh.userData = {
                player: p.player || 'Unknown Player',
                runs: r,
                sr: sr,
                sixes: sixes,
                matches: p.matches || 0,
                originalScale: 1.0
            };

            dataGroup.add(mesh);
            playerMeshes.push(mesh);
        });

        // Highlight Ring object for selected player
        const ringGeo = new THREE.RingGeometry(0.9, 1.2, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xFACC15, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
        const highlightRing = new THREE.Mesh(ringGeo, ringMat);
        highlightRing.visible = false;
        scene.add(highlightRing);

        // Tooltip HTML element
        let tooltip = container.querySelector('.3d-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = '3d-tooltip';
            container.appendChild(tooltip);
        }

        // Raycasting for Hover & Click Selection
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let hoveredMesh = null;

        const onPointerMove = (e) => {
            const rect = container.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(playerMeshes);

            if (intersects.length > 0) {
                const hit = intersects[0].object;
                if (hoveredMesh !== hit) {
                    if (hoveredMesh) hoveredMesh.scale.set(1, 1, 1);
                    hoveredMesh = hit;
                    hoveredMesh.scale.set(1.4, 1.4, 1.4);
                }

                // Update Tooltip
                const p = hit.userData;
                tooltip.style.display = 'block';
                tooltip.style.left = `${e.clientX - rect.left + 15}px`;
                tooltip.style.top = `${e.clientY - rect.top - 20}px`;
                tooltip.innerHTML = `
                    <strong>${p.player}</strong><br/>
                    Runs: <span style="color:#60A5FA;">${p.runs}</span> | SR: <span style="color:#10B981;">${p.sr}</span><br/>
                    Sixes: <span style="color:#F59E0B;">${p.sixes}</span> | Matches: ${p.matches}
                `;
                container.style.cursor = 'pointer';
            } else {
                if (hoveredMesh) {
                    hoveredMesh.scale.set(1, 1, 1);
                    hoveredMesh = null;
                }
                tooltip.style.display = 'none';
                container.style.cursor = 'default';
            }
        };

        const onClick = () => {
            if (hoveredMesh) {
                highlightRing.visible = true;
                highlightRing.position.copy(hoveredMesh.position);
                highlightRing.lookAt(camera.position);
            }
        };

        container.addEventListener('mousemove', onPointerMove);
        container.addEventListener('click', onClick);

        // Animation Loop
        let clock = new THREE.Clock();

        const animate = () => {
            const animFrameId = requestAnimationFrame(animate);
            this.activeScenes[key].animFrameId = animFrameId;

            if (controls) controls.update();

            const elapsed = clock.getElapsedTime();

            if (!this.prefersReducedMotion && !controls?.state === -1) {
                dataGroup.rotation.y = Math.sin(elapsed * 0.1) * 0.1;
            }

            if (highlightRing.visible) {
                highlightRing.rotation.z = elapsed * 2;
            }

            renderer.render(scene, camera);
        };

        this.activeScenes[key] = {
            container, scene, camera, renderer, controls,
            animFrameId: null
        };

        animate();
    }
}

// Instantiate global IPL 3D Manager singleton
window.ipl3DManager = new IPL3DManager();
