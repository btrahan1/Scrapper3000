window.Scrapper3000 = {
    canvas: null,
    engine: null,
    scene: null,

    // Managers
    assets: null,
    input: null,
    player: null,
    mobs: null,
    dotNetHelper: null, // C# Interop
    _isPaused: false,

    debugHealthCheck: function () {
        console.group("🏥 Scrapper 3000 Health Check");
        console.log("AssetManager:", this.assets ? "✅ Ready" : "❌ NULL");
        console.log("InputManager:", this.input ? "✅ Ready" : "❌ NULL");
        console.log("PlayerController:", this.player ? "✅ Ready" : "❌ NULL");
        console.log("MobManager:", this.mobs ? "✅ Ready" : "❌ NULL");
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

        // 1.5 Standby Camera (Prevents "No camera defined" crash)
        const standbyCam = new BABYLON.FreeCamera("StandbyCamera", new BABYLON.Vector3(0, 5, -10), this.scene);
        standbyCam.setTarget(BABYLON.Vector3.Zero());
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
        this.buildShed();

        // 4. Global Event Listeners
        window.addEventListener("playerHit", (e) => {
            if (this.mobs) this.mobs.notifyPlayerHit(e.detail);
        });
    },

    setupEnvironment: function () {
        // Basic lighting
        var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
        light.intensity = 1.0; // Brighter

        // Ambient Light for clarity
        var ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, -1, 0), this.scene);
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
        // Re-implement or move to a WorldManager later. 
        // For now, simple crates.
        const makeCrate = (pos) => {
            const c = BABYLON.MeshBuilder.CreateBox("crate", { size: 0.8 }, this.scene);
            c.position = pos;
        };
        makeCrate(new BABYLON.Vector3(-1.5, 0.4, 2));
        makeCrate(new BABYLON.Vector3(0, 0.4, 2.5));

        // Spawn actual items using AssetManager?
        // Or simple primitives for now to keep refactor safe.
        // Let's rely on the player jumping to junkyard to load real assets.
    },

    // BRIDGE: Called by C# logic to start game
    jumpToJunkyard: async function (gender, hairLength, hairColor) {
        console.log("Scrapper 3000: Jumping to Junkyard...");

        // 1. Expand World
        this.spawnJunkyard();

        // 2. Spawn Player (handles camera too)
        await this.player.updateAvatar(gender, hairLength, hairColor);

        // 2.5 Force Gear Load (Standard Start)
        await this.player.updateGear("Rusty Stick", "None");

        // 3. Spawn Mobs
        this.mobs.spawnRats();
        this.mobs.spawnWolves();
    },

    spawnJunkyard: function () {
        // Expand Ground
        const ground = this.scene.getMeshByName("ground");
        if (ground) {
            ground.scaling = new BABYLON.Vector3(20, 1, 20); // 400x400

            // Desert Texture (BabylonJS Official Asset)
            const groundMat = new BABYLON.StandardMaterial("groundMat", this.scene);
            groundMat.diffuseTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/grass.jpg", this.scene); // Reliable fallback
            groundMat.diffuseTexture.uScale = 60;
            groundMat.diffuseTexture.vScale = 60;
            groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
            ground.material = groundMat;
        }

        // Skybox (Simple inverted sphere)
        const sky = BABYLON.MeshBuilder.CreateSphere("sky", { diameter: 300, segments: 16 }, this.scene);
        const skyMat = new BABYLON.StandardMaterial("skyMat", this.scene);
        skyMat.backFaceCulling = false;
        skyMat.diffuseColor = new BABYLON.Color3(0.6, 0.45, 0.3); // Dusty sunset
        skyMat.emissiveColor = new BABYLON.Color3(0.3, 0.2, 0.15); // Glow a bit
        sky.material = skyMat;
        sky.infiniteDistance = true;

        // Sam's Kiosk (Shop)
        this.assets.loadModel("data/models/SamKiosk.json").then(kiosk => {
            if (kiosk) {
                kiosk.position = new BABYLON.Vector3(-10, 0, 20);
                kiosk.rotation.y = Math.PI / 4;

                // Interaction
                kiosk.getChildMeshes().forEach(m => {
                    m.isInteractable = true;
                    m.isPickable = true;
                    m.actionManager = new BABYLON.ActionManager(this.scene);
                    m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                        console.log("Interact: OpenShop 💰");
                        this.dotNetHelper.invokeMethodAsync('OpenShop');
                    }));
                });
            }
        });

        // Medic Tent (Healing)
        this.assets.loadModel("data/models/MedicTent.json").then(tent => {
            if (tent) {
                tent.position = new BABYLON.Vector3(10, 0, 20);
                tent.rotation.y = -Math.PI / 4;

                // Interaction
                tent.getChildMeshes().forEach(m => {
                    m.isInteractable = true;
                    m.isPickable = true;
                    m.actionManager = new BABYLON.ActionManager(this.scene);
                    m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                        console.log("Interact: HealPlayer 🏥");
                        this.dotNetHelper.invokeMethodAsync('HealPlayer');
                    }));
                });
            }
        });

        // Scrap Piles (Simple Gen)
        for (let i = 0; i < 20; i++) {
            const x = (Math.random() - 0.5) * 60;
            const z = (Math.random() - 0.5) * 60 + 60; // Offset from player spawn
            this.assets.loadModel("data/models/ScrapPile.json").then(pile => {
                if (pile) {
                    pile.position = new BABYLON.Vector3(x, 0, z);
                    this.mobs._enablePicking(pile);
                }
            });
        }
    },

    // BRIDGE: C# Interop Delegations
    updateGear: function (weapon, armor) {
        if (this.player) this.player.updateGear(weapon, armor);
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
            const moveInput = this.input.getMovementInput();
            this.player.updateMovement(dt, moveInput);
            if (this.input.isAttackPressed()) this.whack();
            this.mobs.update(dt);
            this.scene.render();
        });
    },

    debugPhysics: function () {
        if (this.player && this.player.mesh) {
            console.log("Pos: " + this.player.mesh.position);
            console.log("Collisions: " + this.player.mesh.checkCollisions);
        }
    }
};
