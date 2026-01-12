window.Scrapper3000 = {
    canvas: null,
    engine: null,
    scene: null,

    // Managers
    assets: null,
    input: null,
    player: null,
    mobs: null,
    bot: null,
    dotNetHelper: null, // C# Interop
    _isPaused: false,

    debugHealthCheck: function () {
        console.group("🏥 Scrapper 3000 Health Check");
        console.log("AssetManager:", this.assets ? "✅ Ready" : "❌ NULL");
        console.log("InputManager:", this.input ? "✅ Ready" : "❌ NULL");
        console.log("PlayerController:", this.player ? "✅ Ready" : "❌ NULL");
        console.log("MobManager:", this.mobs ? "✅ Ready" : "❌ NULL");
        console.log("BotManager:", this.bot ? "✅ Ready" : "❌ NULL");
        if (this.player) {
            console.log("Player Mesh:", this.player.mesh ? "✅ Spawned" : "⚠️ Missing");
            console.log("Camera:", this.player.camera ? "✅ Active" : "❌ NO CAMERA");
        }
        console.groupEnd();
    },

    init: function (dotNetHelper, canvasId) {
        console.log("Scrapper 3000: Engine Initializing (Refactored Architecture)...");
        this.dotNetHelper = dotNetHelper;
        this.canvas = document.getElementById(canvasId);
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = new BABYLON.Scene(this.engine);

        // 1. Initialize Managers
        this.assets = new AssetManager(this.scene);
        this.input = new InputManager(this.scene, this.canvas);
        this.player = new PlayerController(this.scene, this.assets, dotNetHelper);
        this.mobs = new MobManager(this.scene, this.assets, this.player, dotNetHelper);
        this.bot = new BotManager(this.scene, this.assets, this.player, this.mobs, dotNetHelper);

        // 1.5 Standby Camera (Inside Shed)
        const standbyCam = new BABYLON.FreeCamera("StandbyCamera", new BABYLON.Vector3(0, 1.7, -4), this.scene);
        standbyCam.setTarget(new BABYLON.Vector3(0, 1.7, 0));
        this.scene.activeCamera = standbyCam;

        // 2. Setup Environment (Standard Lights/Fog)
        this.setupEnvironment();

        // 3. Render Loop (Singleton)
        this.initRenderLoop();

        // Resize Event
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
        this.engine.resize(); // Initial fit

        // Setup initial scene (Shed)
        this.resetToShed();

        // 4. Global Event Listeners
        window.addEventListener("playerHit", (e) => {
            if (this.mobs) this.mobs.notifyPlayerHit(e.detail);
        });
    },

    setupEnvironment: function () {
        // Basic lighting
        // NAMING CRITICAL: These must match what we look for in resetToShed/spawnJunkyard
        var light = new BABYLON.HemisphericLight("sun", new BABYLON.Vector3(0, 1, 0), this.scene);
        light.intensity = 1.0; // Brighter

        // Ambient Light for clarity
        var ambient = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, -1, 0), this.scene);
        ambient.intensity = 0.3;
        ambient.diffuse = new BABYLON.Color3(0.5, 0.5, 0.6); // Blue-ish tint from sky

        // Back Clear color (Non-black to verify render)
        this.scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.12, 1.0);

        // Fog (Disabled for testing visibility)
        this.scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
    },

    buildShed: function () {
        console.log("Scrapper 3000: Building Shed...");
        // Create simple room
        var shed = BABYLON.MeshBuilder.CreateBox("shed", { width: 10, height: 6, depth: 10 }, this.scene);
        shed.position.y = 3;
        var shedMat = new BABYLON.StandardMaterial("shedMat", this.scene);
        shedMat.backFaceCulling = false;
        shedMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.35);
        shed.material = shedMat;

        // Ground
        var ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, this.scene);
        var groundMat = new BABYLON.StandardMaterial("groundMat", this.scene);
        groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        ground.material = groundMat;
        ground.checkCollisions = true; // Floor is solid

        // Spawn Intro Items (Crates/Gear)
        this.spawnIntroItems();
    },

    spawnIntroItems: function () {
        console.log("Scrapper 3000: Spawning Intro Gear...");

        const makePedestal = (pos, itemType) => {
            // 1. Create a Cylinder Pedestal
            const p = BABYLON.MeshBuilder.CreateCylinder("pedestal_" + itemType, { height: 0.8, diameter: 0.6 }, this.scene);
            p.position = pos;
            const pMat = new BABYLON.StandardMaterial("pedestalMat", this.scene);
            pMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.2);
            pMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
            p.material = pMat;

            // 1.5 Add Spotlight above
            const light = new BABYLON.SpotLight("spot_" + itemType, pos.add(new BABYLON.Vector3(0, 3, 0)), new BABYLON.Vector3(0, -1, 0), Math.PI / 3, 2, this.scene);
            light.diffuse = new BABYLON.Color3(1, 0.2, 0.2); // Cool Red
            light.intensity = 2.0;
            light.parent = p; // Cleanup together

            // 2. Spawn Custom Mesh
            let mesh;
            const itemPos = pos.clone().add(new BABYLON.Vector3(0, 0.5, 0));

            if (itemType === "Backpack") {
                mesh = BABYLON.MeshBuilder.CreateBox("loot_" + itemType, { width: 0.4, height: 0.5, depth: 0.3 }, this.scene);
                const mat = new BABYLON.StandardMaterial("packMat", this.scene);
                mat.diffuseColor = new BABYLON.Color3(0.4, 0.3, 0.2); // leather
                mesh.material = mat;
                // Add a flap visual
                const flap = BABYLON.MeshBuilder.CreateBox("flap", { width: 0.42, height: 0.15, depth: 0.32 }, this.scene);
                flap.parent = mesh;
                flap.position.y = 0.2;
                flap.material = mat;
            } else if (itemType === "Overalls") {
                // Folded clothes stack
                mesh = BABYLON.MeshBuilder.CreateBox("loot_" + itemType, { width: 0.4, height: 0.15, depth: 0.4 }, this.scene);
                const mat = new BABYLON.StandardMaterial("denimMat", this.scene);
                mat.diffuseColor = new BABYLON.Color3(0.1, 0.2, 0.5); // Denim blue
                mesh.material = mat;
            } else if (itemType === "Stick") {
                mesh = BABYLON.MeshBuilder.CreateCylinder("loot_" + itemType, { height: 1.2, diameter: 0.05 }, this.scene);
                const mat = new BABYLON.StandardMaterial("woodMat", this.scene);
                mat.diffuseColor = new BABYLON.Color3(0.5, 0.4, 0.3);
                mesh.material = mat;
                mesh.rotation.z = Math.PI / 4; // Lean it
                itemPos.y += 0.4;
            }

            if (mesh) {
                mesh.position = itemPos;
                mesh.isPickable = true;
                mesh.actionManager = new BABYLON.ActionManager(this.scene);
                mesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                    this.dotNetHelper.invokeMethodAsync('OnItemPickedUp', itemType);
                    mesh.dispose();
                    if (light) light.dispose();
                }));

                // Rotate Animation
                this.scene.registerBeforeRender(() => {
                    if (mesh && !mesh.isDisposed()) {
                        mesh.rotation.y += 0.01;
                    }
                });
            }
        };

        // Standard Intro Layout
        makePedestal(new BABYLON.Vector3(-2.5, 0.4, 3), "Backpack");
        makePedestal(new BABYLON.Vector3(0, 0.4, 4), "Overalls");
        makePedestal(new BABYLON.Vector3(2.5, 0.4, 3), "Stick");
    },

    // BRIDGE: Called by C# logic to start game
    jumpToJunkyard: async function (gender, hairLength, hairColor) {
        console.log("Scrapper 3000: Jumping to Junkyard...");

        try {
            // 1. Expand World
            this.spawnJunkyard();

            // 2. Spawn Player
            await this.player.updateAvatar(gender, hairLength, hairColor);

            // 3. Force Initial Gear Sync
            await this.player.updateGear();

            // 4. Spawn Mobs
            this.mobs.spawnRats();
            this.mobs.spawnWolves();

        } catch (e) {
            console.error("CRITICAL ERROR in jumpToJunkyard:", e);
        } finally {
            // ALWAYS ensure camera is switched, even if world gen fails
            if (this.player) this.player.setupThirdPersonCamera();
        }
    },

    resetToShed: function () {
        console.log("Scrapper 3000: Resetting to Shed...");

        // 1. Ensure Ground Exists
        let ground = this.scene.getMeshByName("ground");
        if (!ground) {
            ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, this.scene);
            const groundMat = new BABYLON.StandardMaterial("groundMat", this.scene);
            groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
            groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
            ground.material = groundMat;
            ground.checkCollisions = true;
        }

        ground.position.y = 0.05; // Raise definitively (5cm) to show wood
        ground.setEnabled(true);
        ground.scaling = new BABYLON.Vector3(1, 1, 1);
        if (ground.material) {
            // Updated Floor Texture
            if (!ground.material.diffuseTexture && !ground.material.isWood) {
                ground.material.diffuseColor = new BABYLON.Color3(1, 1, 1);
                ground.material.diffuseTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/wood.jpg", this.scene);
                ground.material.diffuseTexture.uScale = 4;
                ground.material.diffuseTexture.vScale = 4;
                ground.material.isWood = true;
            }
        }

        // 1.5 Disable External Lights & Skybox (Aggressive cleanup for light limit)
        this.scene.lights.forEach(l => {
            if (l.name !== "shedLight" && !l.name.startsWith("spot_")) {
                l.setEnabled(false);
            }
        });

        const sky = this.scene.getMeshByName("sky");
        if (sky) sky.setEnabled(false);
        let shed = this.scene.getMeshByName("shed");
        if (!shed) {
            shed = BABYLON.MeshBuilder.CreateBox("shed", { width: 10, height: 6, depth: 10 }, this.scene);
            shed.position.y = 3;
            var shedMat = new BABYLON.StandardMaterial("shedMat", this.scene);
            shedMat.backFaceCulling = false;
            shedMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.35);
            shed.material = shedMat;
        }
        shed.setEnabled(true);

        // Warm interior light
        let shedLight = this.scene.getLightByName("shedLight");
        if (!shedLight) {
            shedLight = new BABYLON.PointLight("shedLight", new BABYLON.Vector3(0, 4, 0), this.scene);
            shedLight.intensity = 1.0;
            shedLight.diffuse = new BABYLON.Color3(1, 0.9, 0.75); // Warm Tungsten
            shedLight.specular = new BABYLON.Color3(1, 1, 1);
        }
        shedLight.setEnabled(true);

        if (this.player) {
            this.player.setupFirstPersonCamera();
            if (this.player.camera) {
                this.player.camera.position = new BABYLON.Vector3(0, 1.7, -4);
                this.player.camera.setTarget(new BABYLON.Vector3(0, 1.7, 5));
            }
            if (this.player.mesh) this.player.mesh.setEnabled(false);
        }
        if (this.mobs) this.mobs.clearMobs();

        // Spawn starting gear pedestals
        this.spawnIntroItems();
    },

    spawnJunkyard: function () {
        // Expand Ground
        const ground = this.scene.getMeshByName("ground");
        if (ground) {
            ground.setEnabled(true);
            ground.scaling = new BABYLON.Vector3(20, 1, 20); // 400x400

            const groundMat = new BABYLON.StandardMaterial("groundMat", this.scene);
            groundMat.diffuseTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/grass.jpg", this.scene);
            groundMat.diffuseTexture.uScale = 60;
            groundMat.diffuseTexture.vScale = 60;
            groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
            ground.material = groundMat;
        }

        const shed = this.scene.getMeshByName("shed");
        if (shed) shed.setEnabled(false);

        const shedLight = this.scene.getLightByName("shedLight");
        if (shedLight) shedLight.setEnabled(false);

        // Re-enable Sun/Hemi
        let sun = this.scene.getLightByName("sun");
        if (sun) {
            sun.setEnabled(true);
        } else {
            // Fallback if missing
            sun = new BABYLON.HemisphericLight("sun", new BABYLON.Vector3(0, 1, 0), this.scene);
        }

        let hemi = this.scene.getLightByName("hemi");
        if (hemi) {
            hemi.setEnabled(true);
        } else {
            hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, -1, 0), this.scene);
            hemi.intensity = 0.3;
        }

        // 2.5 Dispose Intro Assets (Pedestals & Loot)
        this.scene.meshes.slice().forEach(m => {
            if (m.name && (m.name.startsWith("pedestal_") || m.name.startsWith("loot_"))) {
                m.dispose();
            }
        });

        // Skybox (Singleton check)
        let sky = this.scene.getMeshByName("sky");
        if (!sky) {
            sky = BABYLON.MeshBuilder.CreateSphere("sky", { diameter: 300, segments: 16 }, this.scene);
            const skyMat = new BABYLON.StandardMaterial("skyMat", this.scene);
            skyMat.backFaceCulling = false;
            skyMat.diffuseColor = new BABYLON.Color3(0.6, 0.45, 0.3); // Dusty sunset
            skyMat.emissiveColor = new BABYLON.Color3(0.3, 0.2, 0.15); // Glow a bit
            sky.material = skyMat;
            sky.infiniteDistance = true;
        }
        sky.setEnabled(true);

        // Sam's Kiosk (Shop) - Singleton check
        if (!this.scene.getMeshByName("SamKiosk")) {
            this.assets.loadModel("data/models/SamKiosk.json").then(kiosk => {
                if (kiosk) {
                    kiosk.name = "SamKiosk";
                    kiosk.position = new BABYLON.Vector3(-10, 0, 20);
                    kiosk.rotation.y = Math.PI / 4;

                    kiosk.getChildMeshes().forEach(m => {
                        m.isInteractable = true;
                        m.isPickable = true;
                        m.actionManager = new BABYLON.ActionManager(this.scene);
                        m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                            this.dotNetHelper.invokeMethodAsync('OpenShop');
                        }));
                    });
                }
            });
        } else {
            const kiosk = this.scene.getMeshByName("SamKiosk");
            if (kiosk) kiosk.setEnabled(true);
        }

        // Medic Tent (Healing) - Singleton check
        if (!this.scene.getMeshByName("MedicTent")) {
            this.assets.loadModel("data/models/MedicTent.json").then(tent => {
                if (tent) {
                    tent.name = "MedicTent";
                    tent.position = new BABYLON.Vector3(10, 0, 20);
                    tent.rotation.y = -Math.PI / 4;

                    tent.getChildMeshes().forEach(m => {
                        m.isInteractable = true;
                        m.isPickable = true;
                        m.actionManager = new BABYLON.ActionManager(this.scene);
                        m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                            this.dotNetHelper.invokeMethodAsync('HealPlayer');
                        }));
                    });
                }
            });
        } else {
            const tent = this.scene.getMeshByName("MedicTent");
            if (tent) tent.setEnabled(true);
        }

        // Scrap Piles (Simple Gen) - Singleton check
        const pilesExist = this.scene.meshes.some(m => m.name && m.name.startsWith("ScrapPile_"));
        if (!pilesExist) {
            for (let i = 0; i < 20; i++) {
                const x = (Math.random() - 0.5) * 60;
                const z = (Math.random() - 0.5) * 60 + 60; // Offset from player spawn
                this.assets.loadModel("data/models/ScrapPile.json").then(pile => {
                    if (pile) {
                        pile.name = "ScrapPile_" + i;
                        pile.position = new BABYLON.Vector3(x, 0, z);
                        this.mobs._enablePicking(pile);
                    }
                });
            }
        }
    },

    // BRIDGE: C# Interop Delegations
    updateGear: async function () {
        if (this.player) await this.player.updateGear();
    },

    updateAvatar: function (gender, hairLength, hairColor) {
        if (this.player) this.player.updateAvatar(gender, hairLength, hairColor);
    },

    switchToThirdPerson: function (gender, hairLength, hairColor) {
        // Alias for updateAvatar / spawn
        this.updateAvatar(gender, hairLength, hairColor);
    },

    updateHair: function (length, color) {
        if (this.player) this.player.updateHair(length, color);
    },

    playDeathAnimation: function () {
        if (this.player) this.player.playDeathAnimation();
    },

    respawnPlayer: function () {
        if (this.player) {
            this.player.respawnPlayer();
            this.spawnJunkyard(); // Re-seed world
        }
    },

    setPaused: function (isPaused) {
        this._isPaused = isPaused;
    },

    // UI Updates (Visual only, engine doesn't use these but C# expects them to exist)
    updateStats: function (atk, def) {
        if (this.player) {
            this.player.attackPower = atk || 10;
            this.player.defense = def || 0;
            console.log(`Stats Updated: ATK=${atk}, DEF=${def}`);
        }
    },

    exitShed: function () {
        if (this.player && this.player.mesh) {
            this.player.mesh.position = new BABYLON.Vector3(0, 2.0, 15);
            this.spawnJunkyard();
        }
    },

    whack: function (target) {
        if (this.player) this.player.whack(target);
    },

    // Helper to consolidate render loop logic
    initRenderLoop: function () {
        this.engine.runRenderLoop(() => {
            if (!this.scene || this._isPaused) {
                if (this.scene) this.scene.render(); // Still render, just don't update
                return;
            }

            const dt = this.engine.getDeltaTime() / 1000;
            const moveInput = this.input ? this.input.getMovementInput() : { x: 0, y: 0 };

            if (this.player) {
                this.player.updateMovement(dt, moveInput);
                if (this.input && this.input.isAttackPressed()) this.whack();
            }

            if (this.mobs) this.mobs.update(dt);
            if (this.bot) this.bot.update(dt);

            this.scene.render();
        });
    },

    debugPhysics: function () {
        if (this.player && this.player.mesh) {
            console.log("Pos: " + this.player.mesh.position);
            console.log("Collisions: " + this.player.mesh.checkCollisions);
        }
    },

    createParticleSystem: function (type, position) {
        const isOrganic = type === "blood";
        const color1 = isOrganic ? new BABYLON.Color4(0.8, 0, 0, 1) : new BABYLON.Color4(1, 1, 0.5, 1);
        const color2 = isOrganic ? new BABYLON.Color4(0.5, 0, 0, 1) : new BABYLON.Color4(1, 0.5, 0, 1);

        // Create a particle system
        var particleSystem = new BABYLON.ParticleSystem("particles", 50, this.scene);

        // Texture (Internal Babylon texture to avoid external load lag)
        particleSystem.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", this.scene);

        particleSystem.emitter = position; // Where the particles come from

        // Colors
        particleSystem.color1 = color1;
        particleSystem.color2 = color2;
        particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);

        // Size
        particleSystem.minSize = 0.05;
        particleSystem.maxSize = isOrganic ? 0.2 : 0.1;

        // Life time
        particleSystem.minLifeTime = 0.2;
        particleSystem.maxLifeTime = 0.5;

        // Emission rate
        particleSystem.emitRate = 100;

        // Speed
        particleSystem.minEmitPower = 1;
        particleSystem.maxEmitPower = 3;
        particleSystem.updateSpeed = 0.02;

        // Gravity
        particleSystem.gravity = new BABYLON.Vector3(0, -10, 0);

        // Burst Mode
        particleSystem.manualEmitCount = isOrganic ? 20 : 10;

        // Start
        particleSystem.start();

        // Auto dispose
        setTimeout(() => {
            particleSystem.dispose();
        }, 1000);
    }
};
