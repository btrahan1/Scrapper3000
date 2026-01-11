window.Scrapper3000 = {
    canvas: null,
    engine: null,
    scene: null,
    camera: null,
    dotNetHelper: null,
    interactables: [],
    animTimer: 0,
    player: null,
    keys: {},
    isWhacking: false,
    playerLimbs: {},
    attackPower: 10,
    currentWeaponMesh: null,
    currentArmorMesh: null,
    scrapPiles: [],
    rats: [],
    wolves: [],
    isPaused: false,
    tempVector: new BABYLON.Vector3.Zero(),
    isWhackKeyDown: false,
    autoWhackTimer: 0,

    init: function (dotNetHelper, canvasId) {
        this.dotNetHelper = dotNetHelper;
        this.canvas = document.getElementById(canvasId);
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = new BABYLON.Scene(this.engine);

        // Core Environment - Atmospheric Shed
        this.scene.clearColor = new BABYLON.Color4(0.01, 0.01, 0.02, 1);

        // Low ambient + sharp spotlight
        var ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), this.scene);
        ambient.intensity = 0.2;

        var spot = new BABYLON.PointLight("spot", new BABYLON.Vector3(0, 4, 1), this.scene);
        spot.intensity = 0.8;
        spot.diffuse = new BABYLON.Color3(1, 0.9, 0.7);

        // Ground (Dirty Junk Yard Floor)
        var ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, this.scene);
        var groundMat = new BABYLON.StandardMaterial("groundMat", this.scene);
        groundMat.diffuseColor = new BABYLON.Color3(0.1, 0.08, 0.05);
        ground.material = groundMat;

        // Shed Walls
        this.buildShed();

        // 1st Person Camera (Initial)
        this.camera = new BABYLON.UniversalCamera("UniversalCamera", new BABYLON.Vector3(0, 1.7, -3.5), this.scene);
        this.camera.setTarget(new BABYLON.Vector3(0, 1, 2));
        this.camera.attachControl(this.canvas, true);
        this.camera.speed = 0.1;
        this.camera.angularSensibility = 2000;

        // Collisions & Gravity
        this.scene.collisionsEnabled = true;
        this.scene.gravity = new BABYLON.Vector3(0, -0.15, 0);

        // Ground Collision
        ground.checkCollisions = true;

        // Start Loop
        this.engine.runRenderLoop(() => {
            if (this.scene && this.scene.activeCamera) {
                this.scene.render();
            }
        });

        window.addEventListener("resize", () => {
            this.engine.resize();
        });

        this.spawnIntroItems();

        console.log("Scrapper 3000: Shed Initialized.");
    },

    playDeathAnimation: function () {
        if (this.player && !this.isPlayerDead) {
            this.isPlayerDead = true;

            // Disable Collisions to prevent physics "pop" or "float"
            this.player.checkCollisions = false;

            // Stop any walking animations
            this.scene.stopAnimation(this.player);

            // "Fall over" animation
            // Loop mode 2 = CONSTANT (Stops at end)
            BABYLON.Animation.CreateAndStartAnimation("death_fall", this.player, "rotation.x", 60, 30, this.player.rotation.x, -Math.PI / 2, 2, null, () => {
                console.log("Death rotation complete.");
                this.player.rotation.x = -Math.PI / 2;
            });

            // Adjust height (Don't rise)
            BABYLON.Animation.CreateAndStartAnimation("death_drop", this.player, "position.y", 60, 30, this.player.position.y, 0.1, 2, null);

            console.log("DEATH SEQUENCE STARTED. Collisions disabled.");

            // Reset Mob Aggression
            this.rats.forEach(r => {
                if (r.aiState === "AGGRESSIVE") {
                    r.aiState = "PICK";
                    r.currentTarget = null;
                }
            });
            this.wolves.forEach(w => {
                if (w.aiState === "AGGRESSIVE") {
                    w.aiState = "PICK";
                    w.currentTarget = null;
                }
            });
        }
    },

    respawnPlayer: function () {
        if (this.player) {
            this.isPlayerDead = false;

            // Reset Rotation (Stand up)
            this.player.rotation.x = 0;
            this.player.rotation.z = 0;

            // Re-enable collisions
            this.player.checkCollisions = true;

            // Teleport to Medic Tent area (approx coords)
            this.player.position = new BABYLON.Vector3(5, 0.4, 15);
            this.dotNetHelper.invokeMethodAsync('SetDialogue', "The medic drags you back to consciousness. 'Close call, Scrapper.'");
        }
    },

    dispose: function () {
        // Dispose of all scene resources
        this.scene.dispose();
        this.engine.dispose();
        this.canvas = null;
        this.engine = null;
        this.scene = null;
        this.camera = null;
        this.dotNetHelper = null;
        this.interactables = [];
        this.player = null;
        this.keys = {};
        this.playerLimbs = {};
        this.currentWeaponMesh = null;
        this.currentArmorMesh = null;
        this.scrapPiles = [];
        this.rats = [];
        this.wolves = [];
        console.log("Scrapper 3000: Disposed.");
    },

    buildShed: function () {
        var wallMat = new BABYLON.StandardMaterial("wallMat", this.scene);
        wallMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.2);

        // Back Wall
        var backWall = BABYLON.MeshBuilder.CreateBox("backWall", { width: 10, height: 5, depth: 0.2 }, this.scene);
        backWall.position = new BABYLON.Vector3(0, 2.5, 5);
        backWall.material = wallMat;

        // Side Walls
        var lWall = BABYLON.MeshBuilder.CreateBox("lWall", { width: 0.2, height: 5, depth: 10 }, this.scene);
        lWall.position = new BABYLON.Vector3(-5, 2.5, 0);
        lWall.material = wallMat;

        var rWall = lWall.clone("rWall");
        rWall.position.x = 5;

        // Roof
        var roof = BABYLON.MeshBuilder.CreateBox("roof", { width: 10, height: 0.2, depth: 10 }, this.scene);
        roof.position = new BABYLON.Vector3(0, 5, 0);
        roof.material = wallMat;

        // Front Wall (with door opening)
        var fWallL = BABYLON.MeshBuilder.CreateBox("fWallL", { width: 4, height: 5, depth: 0.2 }, this.scene);
        fWallL.position = new BABYLON.Vector3(-3, 2.5, -5);
        fWallL.material = wallMat;
        fWallL.checkCollisions = true;

        var fWallR = BABYLON.MeshBuilder.CreateBox("fWallR", { width: 4, height: 5, depth: 0.2 }, this.scene);
        fWallR.position = new BABYLON.Vector3(3, 2.5, -5);
        fWallR.material = wallMat;
        fWallR.checkCollisions = true;

        var fWallTop = BABYLON.MeshBuilder.CreateBox("fWallTop", { width: 2, height: 2, depth: 0.2 }, this.scene);
        fWallTop.position = new BABYLON.Vector3(0, 4, -5);
        fWallTop.material = wallMat;
        fWallTop.checkCollisions = true;

        // Door Mesh (Visual)
        var door = BABYLON.MeshBuilder.CreateBox("shedDoor", { width: 1.9, height: 3, depth: 0.1 }, this.scene);
        door.position = new BABYLON.Vector3(0, 1.5, -5);
        var doorMat = new BABYLON.StandardMaterial("doorMat", this.scene);
        doorMat.diffuseColor = new BABYLON.Color3(0.3, 0.2, 0.1);
        door.material = doorMat;
        door.checkCollisions = true;
    },

    spawnIntroItems: function () {
        // Crate platforms
        var crateMat = new BABYLON.StandardMaterial("crateMat", this.scene);
        crateMat.diffuseColor = new BABYLON.Color3(0.2, 0.1, 0);

        var createCrate = (name, pos) => {
            var c = BABYLON.MeshBuilder.CreateBox(name, { size: 0.8 }, this.scene);
            c.position = pos;
            c.material = crateMat;
            return c;
        };

        createCrate("c1", new BABYLON.Vector3(-1.5, 0.4, 2));
        createCrate("c2", new BABYLON.Vector3(0, 0.4, 2.5));
        createCrate("c3", new BABYLON.Vector3(1.5, 0.4, 2));

        // Backpack 
        var backpack = BABYLON.MeshBuilder.CreateBox("backpack", { width: 0.4, height: 0.6, depth: 0.2 }, this.scene);
        backpack.position = new BABYLON.Vector3(-1.5, 1.1, 2);
        var bpMat = new BABYLON.StandardMaterial("bpMat", this.scene);
        bpMat.diffuseColor = new BABYLON.Color3(0.3, 0.5, 0.8);
        backpack.material = bpMat;
        this.setupInteractable(backpack, "backpack");

        // Overalls (folded)
        var overalls = BABYLON.MeshBuilder.CreateBox("overalls", { width: 0.5, height: 0.1, depth: 0.4 }, this.scene);
        overalls.position = new BABYLON.Vector3(0, 0.85, 2.5);
        var ovMat = new BABYLON.StandardMaterial("ovMat", this.scene);
        ovMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);
        overalls.material = ovMat;
        this.setupInteractable(overalls, "overalls");

        // Stick
        this.loadModel("data/models/RustyStick.json").then((stick) => {
            if (stick) {
                stick.position = new BABYLON.Vector3(1.5, 0.5, 2);
                stick.rotation.z = Math.PI / 2; // Lie it down
                this.setupInteractable(stick, "stick");
            }
        });
    },

    setupInteractable: function (mesh, type) {
        const meshes = [mesh, ...mesh.getChildMeshes()];

        meshes.forEach(m => {
            m.isInteractable = true;
            m.interactType = type;

            m.actionManager = new BABYLON.ActionManager(this.scene);

            // Hover Highlight (Green for interaction)
            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
                meshes.forEach(tm => {
                    tm.renderOutline = true;
                    tm.outlineColor = new BABYLON.Color3(0.5, 1, 0.2);
                    tm.outlineWidth = 0.05;
                });
            }));
            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
                meshes.forEach(tm => tm.renderOutline = false);
            }));

            // Click to pick up
            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                this.pickUpItem(mesh);
            }));
        });
    },

    exitShed: function () {
        console.log("Scrapper 3000: Exiting Shed...");
        // Fade effect or just teleport
        if (this.player) {
            this.player.position = new BABYLON.Vector3(0, 2.0, 15);
            this.spawnJunkyard();
        }
    },

    jumpToJunkyard: async function (gender, hairLength, hairColor) {
        console.log("Scrapper 3000: Jumping to Junkyard...");
        await this.switchToThirdPerson(gender, hairLength, hairColor);
        this.spawnJunkyard();
        if (this.player) {
            this.player.position = new BABYLON.Vector3(0, 2.0, 15);
        }
    },

    spawnJunkyard: function () {
        // Expand the ground
        var ground = this.scene.getMeshByName("ground");
        if (ground) {
            ground.scaling = new BABYLON.Vector3(20, 1, 20); // 200x200

            // Desert Sand Material (MadMax Style)
            var sandMat = new BABYLON.StandardMaterial("sandMat", this.scene);
            sandMat.diffuseTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/sand.jpg", this.scene);
            sandMat.diffuseTexture.uScale = 50;
            sandMat.diffuseTexture.vScale = 50;
            sandMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
            ground.material = sandMat;

            ground.checkCollisions = true;
        }

        // Brighten Environment
        this.scene.clearColor = new BABYLON.Color4(0.15, 0.1, 0.05, 1); // Dusk/Dawn warm tone

        var sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.5, -1, -0.2), this.scene);
        sun.intensity = 1.2;
        sun.diffuse = new BABYLON.Color3(1, 0.9, 0.7);

        // Update existing lights for exterior
        var ambient = this.scene.getLightByName("ambient");
        if (ambient) ambient.intensity = 0.5;

        // Add Skybox/Fog
        this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
        this.scene.fogDensity = 0.01;
        this.scene.fogColor = new BABYLON.Color3(0.15, 0.1, 0.05);
        this.spawnMedicTent(new BABYLON.Vector3(10, 0, 15));

        // Spawn Scrap Piles
        for (let i = 0; i < 20; i++) {
            const x = (Math.random() - 0.5) * 60;
            const z = (Math.random() - 0.5) * 60 + 30; // Shift forward
            if (Math.abs(x) < 5 && Math.abs(z - 15) < 5) continue; // Don't spawn on player exit

            this.loadModel("data/models/ScrapPile.json").then(pile => {
                if (pile) {
                    pile.position = new BABYLON.Vector3(x, 0, z);
                    pile.isScrapPile = true;
                    this.setupScrapPile(pile);
                    this.scrapPiles.push(pile);
                }
            });
        }

        // Spawn Sam's Kiosk
        this.loadModel("data/models/SamKiosk.json").then(kiosk => {
            if (kiosk) {
                kiosk.position = new BABYLON.Vector3(5, 0, 15);
                kiosk.rotation.y = -Math.PI / 4;
                kiosk.name = "SamKiosk";
                this.setupSamKiosk(kiosk);
            }
        });

        // Background "Junk Mountains"
        for (let j = 0; j < 8; j++) {
            var mnt = BABYLON.MeshBuilder.CreateCylinder("junkMnt", { height: 10 + Math.random() * 20, diameterTop: 0, diameterBottom: 30 }, this.scene);
            const angle = (j / 8) * Math.PI * 2;
            mnt.position = new BABYLON.Vector3(Math.cos(angle) * 50, 0, Math.sin(angle) * 50);
            var mntMat = new BABYLON.StandardMaterial("mntMat", this.scene);
            mntMat.diffuseColor = new BABYLON.Color3(0.1, 0.08, 0.05);
            mnt.material = mntMat;
        }

        this.spawnRats();
        this.spawnWolves();

        console.log("Scrapper 3000: Junkyard Generated.");
    },

    spawnRats: async function () {
        console.log("Scrapper 3000: Releasing the rats...");
        for (let i = 0; i < 5; i++) {
            const rat = await this.loadModel("data/models/ApocRat.json");
            if (rat) {
                rat.position = new BABYLON.Vector3(
                    (Math.random() - 0.5) * 40,
                    0,
                    (Math.random() - 0.5) * 40 + 15
                );
                rat.rotation.y = Math.random() * Math.PI * 2;
                rat.scaling.setAll(0.5); // Scurry size

                // AI State
                rat.aiState = "PICK";
                rat.aiWaitTimer = 0;
                rat.currentTarget = null;

                // Cache Rat Limbs for procedural animation
                const ratChildren = rat.getChildMeshes();
                rat.limbs = {
                    fl: ratChildren.find(m => m.name.includes("arm_FL")),
                    fr: ratChildren.find(m => m.name.includes("arm_FR")),
                    bl: ratChildren.find(m => m.name.includes("leg_BL_thigh")),
                    br: ratChildren.find(m => m.name.includes("leg_BR_thigh"))
                };

                this.rats.push(rat);
                this.setupRatInteractions(rat);

                // Play animations if timeline exists
                if (rat.timeline) {
                    this.playTimeline(rat, rat.timeline);
                }
            }
        }
    },

    spawnWolves: async function () {
        console.log("Scrapper 3000: The wolves are howling...");
        for (let i = 0; i < 3; i++) {
            const wolf = await this.loadModel("data/models/BadlandsWolf.json");
            if (wolf) {
                wolf.position = new BABYLON.Vector3(
                    (Math.random() - 0.5) * 80,
                    0,
                    (Math.random() - 0.5) * 80 + 40 // Further out
                );
                wolf.rotation.y = Math.random() * Math.PI * 2;
                wolf.scaling.setAll(1.5); // Imposing size

                // AI State
                wolf.aiState = "PICK";
                wolf.aiWaitTimer = 0;
                wolf.currentTarget = null;

                // Cache Wolf Limbs
                const children = wolf.getChildMeshes();
                wolf.limbs = {
                    fl: children.find(m => m.name.includes("leg_fl_shoulder")),
                    fr: children.find(m => m.name.includes("leg_fr_shoulder")),
                    bl: children.find(m => m.name.includes("leg_bl_hip")),
                    br: children.find(m => m.name.includes("leg_br_hip"))
                };

                this.wolves.push(wolf);
                this.setupWolfInteractions(wolf);
            }
        }
    },

    setupWolfInteractions: function (wolf) {
        wolf.getChildMeshes().forEach(m => {
            m.isInteractable = true;
            m.isPickable = true; // RESTORE: Mobs need to be hit!
            m.actionManager = new BABYLON.ActionManager(this.scene);

            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
                wolf.getChildMeshes().forEach(wm => {
                    wm.renderOutline = true;
                    wm.outlineColor = new BABYLON.Color3(1, 0.4, 0); // Orange highlight for beasts
                    wm.outlineWidth = 0.08;
                });
            }));
            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
                wolf.getChildMeshes().forEach(wm => wm.renderOutline = false);
            }));

            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                this.whack(wolf);
            }));
        });
    },

    setupRatInteractions: function (rat) {
        rat.getChildMeshes().forEach(m => {
            m.isInteractable = true;
            m.isPickable = true; // RESTORE: Mobs need to be hit!
            m.actionManager = new BABYLON.ActionManager(this.scene);

            // Hover Highlight (Red for hostiles)
            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
                rat.getChildMeshes().forEach(rm => {
                    rm.renderOutline = true;
                    rm.outlineColor = new BABYLON.Color3(1, 0, 0);
                    rm.outlineWidth = 0.05;
                });
            }));
            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
                rat.getChildMeshes().forEach(rm => rm.renderOutline = false);
            }));

            // Click to whack
            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                this.whack(rat);
            }));
        });
    },

    playTimeline: function (root, timeline) {
        if (!timeline || timeline.length === 0) return;

        const meshMap = {};
        root.getChildMeshes().forEach(m => meshMap[m.name] = m);

        timeline.forEach(action => {
            const target = meshMap[action.TargetId];
            if (!target) return;

            const duration = (action.Duration || 0.1) * 1000;
            const toRad = Math.PI / 180;

            // Simple looping animation using Babylon's Animation system
            if (action.Action === "Rotate") {
                const anim = new BABYLON.Animation(target.name + "_rot", "rotation", 30, BABYLON.Animation.ANIMATIONTYPE_VECTOR3, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
                const keys = [
                    { frame: 0, value: target.rotation.clone() },
                    { frame: 60, value: new BABYLON.Vector3(action.Value[0] * toRad, action.Value[1] * toRad, action.Value[2] * toRad) }
                ];
                anim.setKeys(keys);
                target.animations.push(anim);
                this.scene.beginAnimation(target, 0, 60, true, 0.5 + Math.random());
            }
        });
    },

    spawnMedicTent: function (pos) {
        this.loadModel("data/models/MedicTent.json").then((tent) => { // Changed to use async/await pattern
            if (tent) {
                tent.position = pos;
                tent.rotation.y = -Math.PI / 6;
                tent.getChildMeshes().forEach(m => {
                    m.isInteractable = true;
                    m.actionManager = new BABYLON.ActionManager(this.scene);

                    // Hover Highlight (Blue for friendly/utility)
                    m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
                        tent.getChildMeshes().forEach(tm => {
                            tm.renderOutline = true;
                            tm.outlineColor = new BABYLON.Color3(0.2, 0.5, 1.0);
                            tm.outlineWidth = 0.05;
                        });
                    }));
                    m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
                        tent.getChildMeshes().forEach(tm => tm.renderOutline = false);
                    }));

                    m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                        this.dotNetHelper.invokeMethodAsync('HealPlayer');
                    }));
                });
            }
        });
    },

    setupSamKiosk: function (kiosk) {
        kiosk.getChildMeshes().forEach(m => {
            m.isInteractable = true;
            m.actionManager = new BABYLON.ActionManager(this.scene);

            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
                m.renderOutline = true;
                m.outlineColor = new BABYLON.Color3(0, 1, 0.5);
                m.outlineWidth = 0.05;
            }));
            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
                m.renderOutline = false;
            }));

            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                const dist = BABYLON.Vector3.Distance(this.player.position, kiosk.position);
                if (dist < 5) {
                    this.dotNetHelper.invokeMethodAsync('OpenShop');
                } else {
                    this.dotNetHelper.invokeMethodAsync('SetDialogue', "Go talk to Sam! He's at the kiosk.");
                }
            }));
        });

        // Auto-close shop if we walk away
        let shopIsClose = true;
        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (!this.player) return;
            const dist = BABYLON.Vector3.Distance(this.player.position, kiosk.position);
            if (dist > 8) {
                if (!shopIsClose) {
                    this.dotNetHelper.invokeMethodAsync('CloseShop');
                    shopIsClose = true;
                }
            } else {
                shopIsClose = false;
            }
        });
    },

    setupScrapPile: function (pile) {
        pile.getChildMeshes().forEach(m => {
            m.isInteractable = true;
            m.isPickable = true; // RESTORE: Need to hit scrap piles too!
            m.actionManager = new BABYLON.ActionManager(this.scene);

            // Hover Highlight
            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
                m.renderOutline = true;
                m.outlineColor = new BABYLON.Color3(1, 0.6, 0);
                m.outlineWidth = 0.05;
            }));
            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
                m.renderOutline = false;
            }));

            // Click to whack
            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                this.whack(pile);
            }));
        });
    },

    loadModel: async function (path) {
        try {
            const response = await fetch(path);
            const data = await response.json();
            const parts = data.Parts || data.parts;
            const name = data.Name || data.name || "Model";

            let root = new BABYLON.Mesh(name, this.scene);
            let meshMap = {};

            if (parts) {
                // First pass: create all meshes
                parts.forEach(part => {
                    let mesh = this.createPrimitive(part);
                    meshMap[part.Id || part.id || part.name] = mesh;
                    mesh.parent = root;
                });

                // Second pass: establish parenting
                parts.forEach(part => {
                    const id = part.Id || part.id || part.name;
                    const parentId = part.ParentId || part.parentId;
                    if (parentId && meshMap[parentId]) {
                        meshMap[id].parent = meshMap[parentId];
                    }
                });
            } else {
                root = this.createPrimitive(data);
            }

            if (data.Timeline) root.timeline = data.Timeline;
            if (data.Stats) {
                root.stats = JSON.parse(JSON.stringify(data.Stats)); // Clone stats
                root.stats.maxHP = root.stats.HP;
            }

            return root;
        } catch (e) {
            console.error("Error loading model: " + path, e);
            return null;
        }
    },

    createPrimitive: function (data) {
        let mesh;
        const name = data.Id || data.id || data.name || "primitive";
        const shape = (data.Shape || data.shape || data.type || "box").toLowerCase();

        // Material & Color
        const mat = new BABYLON.StandardMaterial(name + "_mat", this.scene);
        if (data.ColorHex) {
            mat.diffuseColor = this.hexToColor(data.ColorHex);
        } else if (data.color) {
            mat.diffuseColor = new BABYLON.Color3(data.color.r, data.color.g, data.color.b);
        }

        if (data.Material === "Glow" || data.material === "Glow") {
            mat.emissiveColor = mat.diffuseColor;
            mat.useAlphaFromDiffuseTexture = true;
        }

        switch (shape) {
            case "box":
                mesh = BABYLON.MeshBuilder.CreateBox(name, {
                    width: data.Scale ? data.Scale[0] : (data.width || data.size || 1),
                    height: data.Scale ? data.Scale[1] : (data.height || data.size || 1),
                    depth: data.Scale ? data.Scale[2] : (data.depth || data.size || 1)
                }, this.scene);
                break;
            case "sphere":
                mesh = BABYLON.MeshBuilder.CreateSphere(name, {
                    diameterX: data.Scale ? data.Scale[0] : (data.diameter || 1),
                    diameterY: data.Scale ? data.Scale[1] : (data.diameter || 1),
                    diameterZ: data.Scale ? data.Scale[2] : (data.diameter || 1)
                }, this.scene);
                break;
            case "cylinder":
                mesh = BABYLON.MeshBuilder.CreateCylinder(name, {
                    height: data.Scale ? data.Scale[1] : (data.height || 1),
                    diameter: data.Scale ? data.Scale[0] : (data.diameter || 1)
                }, this.scene);
                break;
            case "cone":
                mesh = BABYLON.MeshBuilder.CreateCylinder(name, {
                    height: data.Scale ? data.Scale[1] : (data.height || 1),
                    diameterTop: 0,
                    diameterBottom: data.Scale ? data.Scale[0] : (data.diameter || 1)
                }, this.scene);
                break;
            case "torus":
                mesh = BABYLON.MeshBuilder.CreateTorus(name, {
                    diameter: data.Scale ? data.Scale[0] : (data.diameter || 1),
                    thickness: data.Scale ? data.Scale[2] : 0.2
                }, this.scene);
                break;
            case "capsule":
                mesh = BABYLON.MeshBuilder.CreateCapsule(name, {
                    height: data.Scale ? data.Scale[1] : 1,
                    radius: data.Scale ? data.Scale[0] / 2 : 0.5
                }, this.scene);
                break;
        }

        // Transform
        if (data.Position) {
            mesh.position = new BABYLON.Vector3(data.Position[0], data.Position[1], data.Position[2]);
        } else if (data.position) {
            mesh.position = new BABYLON.Vector3(data.position.x, data.position.y, data.position.z);
        }

        if (data.Rotation) {
            // Convert to radians if they look like degrees
            const toRad = Math.PI / 180;
            mesh.rotation = new BABYLON.Vector3(data.Rotation[0] * toRad, data.Rotation[1] * toRad, data.Rotation[2] * toRad);
        } else if (data.rotation) {
            mesh.rotation = new BABYLON.Vector3(data.rotation.x, data.rotation.y, data.rotation.z);
        }

        mesh.material = mat;

        // CRITICAL FIX: Disable physics/picking on ALL model parts by default.
        // This prevents the "Baron Munchausen" effect where the player collides with their own body parts.
        mesh.checkCollisions = false;
        mesh.isPickable = false;

        return mesh;
    },

    hexToColor: function (hex) {
        var r = parseInt(hex.slice(1, 3), 16) / 255;
        var g = parseInt(hex.slice(3, 5), 16) / 255;
        var b = parseInt(hex.slice(5, 7), 16) / 255;
        return new BABYLON.Color3(r, g, b);
    },

    pickUpItem: function (mesh) {
        console.log("Picking up: " + mesh.interactType);
        this.dotNetHelper.invokeMethodAsync('OnItemPickedUp', mesh.interactType);
        mesh.dispose();
    },

    switchToThirdPerson: async function (gender, hairLength, hairColor) {
        console.log("Scrapper 3000: Switching to 3rd Person...");

        // 1. Keep Old Camera until new one is ready
        var oldCamera = this.camera;

        // 2. Load Scrapper Mesh from JSON based on gender
        const path = gender === "Female" ? "data/models/ScrapperFemale.json" : "data/models/ScrapperMale.json";
        const player = await this.loadModel(path);

        // Update hair on initial load
        this.updateHairOnMesh(player, hairLength, hairColor);

        this.player = player;

        // Player Collision
        player.checkCollisions = true; // Use ellipsoid for world collisions
        player.ellipsoid = new BABYLON.Vector3(0.3, 0.9, 0.3); // H=1.8, W=0.6, D=0.6
        player.ellipsoidOffset = new BABYLON.Vector3(0, 0.9, 0); // Center at pivot + 0.9 (feet at 0, top at 1.8)

        this.cachePlayerLimbs();

        // 3. Attach Backpack to Torso (Upper Back)
        const backpack = await this.loadModel("data/models/Backpack.json");
        if (backpack) {
            backpack.checkCollisions = false; // CRITICAL: Prevent self-collision/rising
            // Also recursively disable for children just in case
            backpack.getChildMeshes().forEach(m => m.checkCollisions = false);

            if (this.playerLimbs.torso) {
                backpack.parent = this.playerLimbs.torso;
                // Adjust for chest (Box) vs Spine. 
                // Chest is box. Back is usually -Z or +Z depending on modeling. 
                // Assuming standard: 0, 0, -0.2 (behind).
                // Local to Chest transform.
                backpack.position = new BABYLON.Vector3(0, 0, -0.15);
                backpack.rotation = new BABYLON.Vector3(0, 0, 0);
            } else {
                // Fallback if no torso found
                backpack.parent = player;
                backpack.position = new BABYLON.Vector3(0, 1.2, -0.2);
            }
        }

        // 4. Create 3rd Person Camera
        var camera = new BABYLON.ArcRotateCamera("ThirdPersonCam", -Math.PI / 2, Math.PI / 2.5, 4, player.position, this.scene);
        camera.setTarget(player);
        camera.attachControl(this.canvas, true);
        camera.lowerRadiusLimit = 2;
        camera.upperRadiusLimit = 10;

        this.camera = camera;

        // Initial Gear
        this.updateGear("Rusty Stick", "Basic Overalls");

        // 5. Cleanup Old Camera
        if (oldCamera) {
            oldCamera.dispose();
        }

        // 6. Setup Controls & Movement
        this.setupThirdPersonControls();

        this.scene.onBeforeRenderObservable.add(() => {
            if (this.isPaused) return;
            this.updateRats();
            this.updateWolves();
        });
    },

    setupControls: function () {
        var inputMap = {};
        this.scene.actionManager = new BABYLON.ActionManager(this.scene);
        this.scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, function (evt) {
            inputMap[evt.sourceEvent.key.toLowerCase()] = evt.sourceEvent.type == "keydown";
        }));
        this.scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, function (evt) {
            inputMap[evt.sourceEvent.key.toLowerCase()] = evt.sourceEvent.type == "keydown";
        }));

        this.scene.onBeforeRenderObservable.add(() => {
            if (!this.player || this.isPaused) return;
        });
    },

    setupThirdPersonControls: function () {
        this.inputMap = {};

        // Ensure ActionManager exists
        if (!this.scene.actionManager) {
            this.scene.actionManager = new BABYLON.ActionManager(this.scene);
        }

        this.scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, (evt) => {
            this.inputMap[evt.sourceEvent.key.toLowerCase()] = evt.sourceEvent.type == "keydown";
        }));
        this.scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, (evt) => {
            this.inputMap[evt.sourceEvent.key.toLowerCase()] = evt.sourceEvent.type == "keydown";
        }));

        // Keep Window listeners as backup/alternatives if ActionManager loses focus
        window.addEventListener("keydown", (e) => { this.inputMap[e.key.toLowerCase()] = true; });
        window.addEventListener("keyup", (e) => { this.inputMap[e.key.toLowerCase()] = false; });

        // Attack Trigger
        window.addEventListener("mousedown", (e) => {
            if (e.button === 0) {
                this.isWhackKeyDown = true;
                this.whack();
            }
        });
        window.addEventListener("mouseup", (e) => {
            if (e.button === 0) this.isWhackKeyDown = false;
        });

        window.addEventListener("keydown", (e) => {
            if (e.code === "Space") {
                this.isWhackKeyDown = true;
                this.whack();
            }
        });
        window.addEventListener("keyup", (e) => {
            if (e.code === "Space") this.isWhackKeyDown = false;
        });

        // Mouse Look (handled by ArcRotateCamera)

        this.scene.onBeforeRenderObservable.add(() => {
            if (!this.player || !this.camera || this.isPaused || this.isPlayerDead) return;

            const dt = this.engine.getDeltaTime() / 1000;

            // Auto-Whack check
            if (this.autoWhackTimer > 0) {
                this.autoWhackTimer -= dt;
            } else if (this.isWhackKeyDown) {
                this.whack();
            }

            const moveSpeed = 0.08;
            const turnSpeed = 0.04;
            const gravity = -0.15; // Vertical force

            // 1. Rotation (A/D) using inputMap
            if (this.inputMap["a"]) {
                this.player.rotation.y -= turnSpeed;
            }
            if (this.inputMap["d"]) {
                this.player.rotation.y += turnSpeed;
            }

            // 2. Movement (W/S) using inputMap
            let moveVector = BABYLON.Vector3.Zero();

            // Forward vector is based on mesh rotation
            var forward = this.player.forward;

            if (this.inputMap["w"]) {
                moveVector.addInPlace(forward.scale(moveSpeed));
            }
            if (this.inputMap["s"]) {
                moveVector.addInPlace(forward.scale(-moveSpeed * 0.5)); // Slower backward
            }

            // 3. Apply Gravity (Constant downward force)
            moveVector.y = gravity;

            // 4. Final Move
            this.player.moveWithCollisions(moveVector);

            // 5. Walking Animation
            const isMoving = this.inputMap["w"] || this.inputMap["s"];
            this.animateWalk(this.engine.getDeltaTime() / 1000, isMoving);
        });
    },

    animateWalk: function (dt, isMoving) {
        if (!this.player) return;

        const limbs = this.playerLimbs;

        if (isMoving) {
            this.animTimer += dt * 10;
            const sin = Math.sin(this.animTimer);

            if (limbs.legL) limbs.legL.rotation.x = sin * 0.6;
            if (limbs.legR) limbs.legR.rotation.x = -sin * 0.6;
            if (limbs.armL) limbs.armL.rotation.x = -sin * 0.4;

            // Don't animate Right Arm if whacking
            if (!this.isWhacking && limbs.armR) {
                limbs.armR.rotation.x = sin * 0.4;
            }

            // Subtle Bobbing
            if (limbs.torso && this.initialTorsoY !== undefined) {
                limbs.torso.position.y = this.initialTorsoY + Math.sin(this.animTimer * 2) * 0.05;
            }
        } else {
            // Reset to Idle
            const lerp = 0.15;
            if (limbs.legL) limbs.legL.rotation.x = BABYLON.Scalar.LerpAngle(limbs.legL.rotation.x, 0, lerp);
            if (limbs.legR) limbs.legR.rotation.x = BABYLON.Scalar.LerpAngle(limbs.legR.rotation.x, 0, lerp);
            if (limbs.armL) limbs.armL.rotation.x = BABYLON.Scalar.LerpAngle(limbs.armL.rotation.x, 0, lerp);

            if (!this.isWhacking && limbs.armR) {
                limbs.armR.rotation.x = BABYLON.Scalar.LerpAngle(limbs.armR.rotation.x, 0, lerp);
            }

            if (limbs.torso && this.initialTorsoY !== undefined) {
                limbs.torso.position.y = BABYLON.Scalar.Lerp(limbs.torso.position.y, this.initialTorsoY, lerp);
            }
        }
    },

    whack: function (target) {
        if (this.isWhacking || !this.player || this.isPaused || this.isPlayerDead) return;
        this.isWhacking = true;
        this.currentClickTarget = target;
        this.currentWhackDamage = this.attackPower;
        this.autoWhackTimer = 3.0; // Reset auto-whack timer
        console.log("Scrapper 3000: WHACK!");

        const armR = this.playerLimbs.armR;

        if (armR) {
            this.scene.stopAnimation(armR);
            const originalRot = 0;

            BABYLON.Animation.CreateAndStartAnimation("whack_swing", armR, "rotation.x", 60, 6, armR.rotation.x, -1.5, 2, null, () => {
                this.checkForScrapHit();
                BABYLON.Animation.CreateAndStartAnimation("whack_reset", armR, "rotation.x", 60, 10, -1.5, originalRot, 2, null, () => {
                    this.isWhacking = false;
                });
            });
        } else {
            this.isWhacking = false;
        }
    },

    checkForScrapHit: function () {
        let target = this.currentClickTarget;
        this.currentClickTarget = null;
        const damage = this.currentWhackDamage;

        if (!target) {
            const ray = new BABYLON.Ray(this.player.position.add(new BABYLON.Vector3(0, 0.5, 0)), this.player.forward, 3.0);
            const hit = this.scene.pickWithRay(ray);
            target = hit && hit.pickedMesh ? hit.pickedMesh : null;
        }

        if (target) {
            let originalTarget = target;
            while (target.parent && !target.name.includes("ScrapPile") && !target.name.includes("PostApocRat") && !target.name.includes("BadlandsWolf")) {
                target = target.parent;
            }

            if (target && target.name.includes("ScrapPile")) {
                const dist = BABYLON.Vector3.Distance(this.player.position, target.getAbsolutePosition() || target.position);
                if (dist < 3.5) {
                    this.onScrapPileHit(target, damage);
                }
            } else if (target && target.name.includes("PostApocRat")) {
                const dist = BABYLON.Vector3.Distance(this.player.position, target.getAbsolutePosition() || target.position);
                if (dist < 3.5) {
                    this.onRatHit(target, damage);
                }
            } else if (target && target.name.includes("BadlandsWolf")) {
                const dist = BABYLON.Vector3.Distance(this.player.position, target.getAbsolutePosition() || target.position);
                if (dist < 4.5) { // Wolves are bigger, slightly longer reach
                    this.onWolfHit(target, damage);
                }
            }
        }
    },

    onRatHit: function (rat, damage) {
        if (!rat.stats) return;
        console.log("Rat Hit! HP: " + rat.stats.HP);

        const netDamage = Math.max(1, damage - Math.floor((rat.stats.DEF || 0) / 2));
        rat.stats.HP -= netDamage;

        this.showFloatingDamage(rat.position.clone(), netDamage, "#ff0000");
        rat.aiState = "AGGRESSIVE"; // Enrage the rat!

        // Create/Update Health Bar
        this.updateRatHealthBar(rat);

        // Jiggle feedback
        const originalY = rat.position.y;
        BABYLON.Animation.CreateAndStartAnimation("rat_jiggle", rat, "position.y", 60, 4, originalY, originalY + 0.1, 2, null, () => {
            BABYLON.Animation.CreateAndStartAnimation("rat_reset", rat, "position.y", 60, 4, rat.position.y, originalY, 2);
        });

        if (rat.stats.HP <= 0) {
            const pos = rat.position.clone();
            this.rats = this.rats.filter(r => r !== rat);

            if (rat.healthBar) rat.healthBar.dispose();

            // Grant EXP
            this.dotNetHelper.invokeMethodAsync('AddExperience', rat.stats.ExpReward || 10);
            rat.dispose();

            this.dotNetHelper.invokeMethodAsync('SetDialogue', "Rat neutralized.");

            // Drop 1-3 materials
            const count = 1 + Math.floor(Math.random() * 3);
            const mats = ["Rubber", "Plastic", "Wood", "Cloth", "Metal"];
            for (let i = 0; i < count; i++) {
                const type = mats[Math.floor(Math.random() * mats.length)];
                this.spawnLoot(pos, type);
            }
        }

        // Show Floating Damage (Red for Hostiles)
        this.showFloatingDamage(rat.getAbsolutePosition() || rat.position, damage, "#ff0000");
    },

    updateRatHealthBar: function (rat) {
        if (!rat.healthBar) {
            // Container
            rat.healthBar = new BABYLON.TransformNode("hp_root_" + rat.name, this.scene);
            rat.healthBar.parent = rat;
            rat.healthBar.position.y = 1.0; // Float above
            rat.healthBar.scaling.setAll(2.0); // Adjust size (rat is 0.5 scaled)

            // Background (Red)
            const bg = BABYLON.MeshBuilder.CreatePlane("hp_bg", { width: 0.5, height: 0.05 }, this.scene);
            bg.parent = rat.healthBar;
            const bgMat = new BABYLON.StandardMaterial("hp_bg_mat", this.scene);
            bgMat.diffuseColor = new BABYLON.Color3(0.5, 0, 0);
            bgMat.emissiveColor = bgMat.diffuseColor;
            bg.material = bgMat;

            // Foreground (Green)
            const fg = BABYLON.MeshBuilder.CreatePlane("hp_fg", { width: 0.5, height: 0.05 }, this.scene);
            fg.parent = rat.healthBar;
            fg.position.z = -0.01;
            const fgMat = new BABYLON.StandardMaterial("hp_fg_mat", this.scene);
            fgMat.diffuseColor = new BABYLON.Color3(0, 0.8, 0);
            fgMat.emissiveColor = fgMat.diffuseColor;
            fg.material = fgMat;

            rat.hpIndicator = fg;
        }

        // Scale Green Bar
        const pct = Math.max(0, rat.stats.HP / rat.stats.maxHP);
        rat.hpIndicator.scaling.x = pct;
        rat.hpIndicator.position.x = (1 - pct) * -0.25; // Keep anchored to left
    },

    onScrapPileHit: function (pile, damage) {
        console.log("Hit Scrap Pile: " + pile.name + " (DMG: " + damage + ")");

        // Capture base position on first hit to prevent drift
        if (pile.hp === undefined) {
            pile.hp = 12; // Base HP
            pile.baseY = pile.position.y;
        }
        pile.hp -= damage;

        // Stop any current jiggle to prevent displacement accumulation
        this.scene.stopAnimation(pile);

        // Jiggle up and back to baseY
        const targetY = pile.baseY + 0.15;
        BABYLON.Animation.CreateAndStartAnimation("jiggle", pile, "position.y", 60, 4, pile.position.y, targetY, 2, null, () => {
            BABYLON.Animation.CreateAndStartAnimation("jiggle_reset", pile, "position.y", 60, 6, pile.position.y, pile.baseY, 2);
        });

        if (pile.hp <= 0) {
            this.popScrapPile(pile);
        }

        // Show Floating Damage (White for scrap)
        this.showFloatingDamage(pile.position, damage, "#ffffff");
    },

    popScrapPile: function (pile) {
        const pos = pile.getAbsolutePosition().clone();

        // Remove from AI tracking
        this.scrapPiles = this.scrapPiles.filter(p => p !== pile);

        pile.dispose();

        // Spawn 3-5 pieces of loot
        const mats = ["Rubber", "Plastic", "Wood", "Cloth", "Metal"];
        const count = 3 + Math.floor(Math.random() * 3);

        for (let i = 0; i < count; i++) {
            const type = mats[Math.floor(Math.random() * mats.length)];
            this.spawnLoot(pos, type);
        }
    },

    spawnLoot: function (pos, type) {
        const loot = BABYLON.MeshBuilder.CreateBox("loot_" + type, { size: 0.3 }, this.scene);
        loot.position = pos.add(new BABYLON.Vector3((Math.random() - 0.5) * 1, 0.5, (Math.random() - 0.5) * 1));

        const colors = {
            "Rubber": new BABYLON.Color3(0.1, 0.1, 0.1),
            "Plastic": new BABYLON.Color3(0.8, 0.8, 0.8),
            "Wood": new BABYLON.Color3(0.4, 0.2, 0.1),
            "Cloth": new BABYLON.Color3(0.6, 0.2, 0.6),
            "Metal": new BABYLON.Color3(0.7, 0.7, 0.8)
        };

        const mat = new BABYLON.StandardMaterial("loot_mat", this.scene);
        mat.diffuseColor = colors[type] || new BABYLON.Color3(1, 1, 1);
        loot.material = mat;

        // Animate floating
        const startY = loot.position.y;
        let t = Math.random() * 10;
        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (loot.isDisposed()) {
                this.scene.onBeforeRenderObservable.remove(obs);
                return;
            }
            t += 0.05;
            loot.position.y = startY + Math.sin(t) * 0.1;
            loot.rotation.y += 0.02;

            // Pick up check
            if (BABYLON.Vector3.Distance(this.player.position, loot.position) < 1.5) {
                console.log("Picked up: " + type);
                this.dotNetHelper.invokeMethodAsync('OnItemPickedUp', type);
                loot.dispose();
            }
        });
    },

    updateStats: function (atk) {
        if (this.attackPower === atk) return;
        this.attackPower = atk;
        console.log("Scrapper 3000: Stats updated. ATK=" + this.attackPower);
    },

    setPaused: function (isPaused) {
        this.isPaused = isPaused;
    },

    updateAvatar: function (gender, hairLength, hairColor) {
        if (this.player) {
            this.updateHairOnMesh(this.player, hairLength, hairColor);
        }
    },

    cachePlayerLimbs: function () {
        if (!this.player) return;
        const children = this.player.getChildMeshes();

        // Helper to find best match
        const findMesh = (keywords) => {
            // keywords is array of priority strings. FIRST match in array wins.
            for (let k of keywords) {
                const match = children.find(m => m.name.toLowerCase().includes(k.toLowerCase()));
                if (match) return match;
            }
            return null;
        };

        this.playerLimbs = {
            // Support old "leg_l" OR new "thigh_L" / "leg_upper_left" styles
            legL: findMesh(["leg_upper_left", "thigh_l", "leg_l"]),
            legR: findMesh(["leg_upper_right", "thigh_r", "leg_r"]),
            armL: findMesh(["arm_upper_l", "arm_l"]),
            armR: findMesh(["arm_upper_r", "arm_r"]),

            // Prioritize CHEST (Upper) over SPINE/WAIST (Lower) for correct backpack placement
            torso: findMesh(["chest", "torso", "spine"]),

            head: findMesh(["head"])
        };

        if (this.playerLimbs.torso) {
            this.initialTorsoY = this.playerLimbs.torso.position.y;
        }

        console.log("Scrapper 3000: Limbs cached for Model: " + (this.playerLimbs.torso ? "Success" : "Partial Failure"));
    },


    updateGear: async function (weaponName, armorName) {
        if (!this.player || !this.playerLimbs.armR) return;

        // HELPER: Prevent the "Elevator Glitch"
        const disableCollisions = (mesh) => {
            if (!mesh) return;
            mesh.checkCollisions = false;
            mesh.isPickable = false; // Optimization
            if (mesh.getChildMeshes) {
                mesh.getChildMeshes().forEach(m => {
                    m.checkCollisions = false;
                    m.isPickable = false;
                });
            }
        };

        // Guard: Only reload if the names have actually changed
        if (this.lastEquippedWeapon === weaponName && this.lastEquippedArmor === armorName) {
            return;
        }

        console.log("Updating Gear: " + weaponName + " / " + armorName);
        this.lastEquippedWeapon = weaponName;
        this.lastEquippedArmor = armorName;

        // 1. Weapon Swap
        if (this.currentWeaponMesh) {
            this.currentWeaponMesh.dispose();
            this.currentWeaponMesh = null;
        }

        // Determine path based on name (e.g. "Heavy Spiked Mace" -> "HeavySpikedMace.json")
        let cleanName = weaponName.replace(/\s/g, "");
        let weaponPath = `data/models/${cleanName}.json`;

        let weapon = await this.loadModel(weaponPath);

        // Fallback to Stick.json if specific model missing
        if (!weapon) {
            weapon = await this.loadModel("data/models/Stick.json");
        }

        if (weapon) {
            disableCollisions(weapon); // <--- ADDED
            weapon.parent = this.playerLimbs.armR;

            // Adjust to fit in hand
            weapon.position = new BABYLON.Vector3(0, -0.4, 0.1);
            weapon.rotation.x = Math.PI / 2;
            weapon.rotation.z = Math.PI / 4;

            this.currentWeaponMesh = weapon;

            // Apply visual variations ONLY if we fell back to the generic stick
            if (weaponPath.includes("Stick.json")) {
                if (weaponName.includes("Spiked")) {
                    weapon.scaling.setAll(1.2);
                    weapon.getChildMeshes().forEach(m => {
                        if (m.material) m.material.diffuseColor = new BABYLON.Color3(0.6, 0.3, 0.2);
                    });
                }
            }

            // Special metal material for metal weapons
            if (weaponName.includes("Metal") || weaponName.includes("Rebar") || weaponName.includes("Mace")) {
                weapon.getChildMeshes().forEach(m => {
                    if (m.material && (m.material.name.includes("metal") || m.material.name.includes("Plate"))) {
                        m.material.metallic = 1.0;
                        m.material.roughness = 0.3;
                    }
                });
            }
        }

        // 2. Armor/Backpack Logic
        if (this.currentArmorParts) {
            this.currentArmorParts.forEach(p => p.dispose());
            this.currentArmorParts = [];
        }

        if (armorName.includes("Overalls") && this.player) {
            // Determine material logic or model loading
            const isFaded = armorName.includes("Faded");
            const armorPath = isFaded ? "data/models/DustyFadedOveralls.json" : null;

            if (armorPath) {
                const overalls = await this.loadModel(armorPath);

                if (overalls) {
                    disableCollisions(overalls); // <--- ADDED
                    // Detach parts
                    const parts = overalls.getChildMeshes();
                    // ... (rest of overall logic) ...
                    const hips = parts.find(m => m.name.includes("hips"));
                    const torso = parts.find(m => m.name.includes("torso"));
                    const leftLeg = parts.find(m => m.name.includes("left_leg"));
                    const rightLeg = parts.find(m => m.name.includes("right_leg"));

                    if (this.playerLimbs.torso) {
                        if (hips) {
                            hips.setParent(this.playerLimbs.torso);
                            hips.position = new BABYLON.Vector3(0, -0.4, 0);
                            hips.rotation = new BABYLON.Vector3(0, 0, 0);
                            this.currentArmorParts.push(hips);
                        }
                        if (torso) {
                            torso.setParent(this.playerLimbs.torso);
                            torso.position = new BABYLON.Vector3(0, 0, 0);
                            torso.rotation = new BABYLON.Vector3(0, 0, 0);
                            this.currentArmorParts.push(torso);
                        }
                    }
                    if (this.playerLimbs.legL && leftLeg) {
                        leftLeg.setParent(this.playerLimbs.legL);
                        leftLeg.position = new BABYLION.Vector3(0, 0, 0);
                        leftLeg.rotation = new BABYLON.Vector3(0, 0, 0);
                        this.currentArmorParts.push(leftLeg);
                    }
                    if (this.playerLimbs.legR && rightLeg) {
                        rightLeg.setParent(this.playerLimbs.legR);
                        rightLeg.position = new BABYLON.Vector3(0, 0, 0);
                        rightLeg.rotation = new BABYLON.Vector3(0, 0, 0);
                        this.currentArmorParts.push(rightLeg);
                    }

                    overalls.dispose();
                }
            }
        }
        else if (armorName.includes("Helmet")) {
            const helmetName = armorName.replace(/\s/g, "");
            const helmet = await this.loadModel(`data/models/${helmetName}.json`);

            if (helmet && this.playerLimbs.head) {
                disableCollisions(helmet); // <--- ADDED
                helmet.parent = this.playerLimbs.head;
                // Zero out transforms - the model is built around the head center
                helmet.position = new BABYLON.Vector3(0, 0, 0);
                helmet.rotation = new BABYLON.Vector3(0, 0, 0);
                this.currentArmorParts.push(helmet);
            }
        } else if (armorName.includes("Boots")) {
            // Boots Logic - Split model into Left/Right and attach to legs
            const bootName = armorName.replace(/\s/g, "");
            const boots = await this.loadModel(`data/models/${bootName}.json`);

            if (boots) {
                disableCollisions(boots); // <--- ADDED
                const parts = boots.getChildMeshes();
                const leftBoot = parts.find(m => m.name.includes("Left"));
                const rightBoot = parts.find(m => m.name.includes("Right"));

                // If the JSON structure has these as roots (parents of other parts), we can just attach them
                // We need to detach them from the main "boots" empty container first

                if (leftBoot && this.playerLimbs.legL) {
                    leftBoot.setParent(this.playerLimbs.legL);
                    // Leg is 0.9 high, pivot at 0.45. Bottom is -0.45.
                    leftBoot.position = new BABYLON.Vector3(0, -0.45, 0);
                    leftBoot.rotation = new BABYLON.Vector3(0, 0, 0);
                    this.currentArmorParts.push(leftBoot);
                }

                if (rightBoot && this.playerLimbs.legR) {
                    rightBoot.setParent(this.playerLimbs.legR);
                    rightBoot.position = new BABYLON.Vector3(0, -0.45, 0);
                    rightBoot.rotation = new BABYLON.Vector3(0, 0, 0);
                    this.currentArmorParts.push(rightBoot);
                }

                boots.dispose(); // Cleanup container
            }
        } else if (armorName.includes("Vest")) {
            // Vest Logic - Attach to Torso
            const vestName = armorName.replace(/\s/g, "");
            const vest = await this.loadModel(`data/models/${vestName}.json`);

            if (vest && this.playerLimbs.torso) {
                disableCollisions(vest); // <--- ADDED
                vest.parent = this.playerLimbs.torso;
                this.currentArmorParts.push(vest);
            }
        } else if (armorName.includes("Gloves")) {
            // Gloves Logic - Split Left/Right, attach to Arms
            const gloveName = armorName.replace(/\s/g, "");
            const gloves = await this.loadModel(`data/models/${gloveName}.json`);

            if (gloves) {
                disableCollisions(gloves); // <--- ADDED
                const parts = gloves.getChildMeshes();
                const cuffL = parts.find(m => m.name.includes("L_Wrist_Cuff"));
                const cuffR = parts.find(m => m.name.includes("R_Wrist_Cuff"));

                if (cuffL && this.playerLimbs.armL) {
                    cuffL.setParent(this.playerLimbs.armL);
                    // Arm height ~0.7. Hand should be at bottom ~ -0.35 if pivoted center
                    cuffL.position = new BABYLON.Vector3(0, -0.35, 0);
                    cuffL.rotation = new BABYLON.Vector3(0, 0, 0);
                    this.currentArmorParts.push(cuffL);
                }

                if (cuffR && this.playerLimbs.armR) {
                    cuffR.setParent(this.playerLimbs.armR);
                    cuffR.position = new BABYLON.Vector3(0, -0.35, 0);
                    cuffR.rotation = new BABYLON.Vector3(0, 0, 0);
                    this.currentArmorParts.push(cuffR);
                }

                gloves.dispose();
            }
        } else if (armorName.includes("Leggings")) {
            // Leggings Logic - Split Waist/Legs
            const legName = armorName.replace(/\s/g, "");
            const leggings = await this.loadModel(`data/models/${legName}.json`);

            if (leggings) {
                disableCollisions(leggings); // <--- ADDED
                const parts = leggings.getChildMeshes();
                const waist = parts.find(m => m.name.includes("waist_band"));
                const legL = parts.find(m => m.name.includes("leg_upper_left"));
                const legR = parts.find(m => m.name.includes("leg_upper_right"));

                if (waist && this.playerLimbs.torso) {
                    waist.setParent(this.playerLimbs.torso);
                    // Waist (belt) is at 1.05. Torso pivot is center.
                    // Need to bring it down to hips. ~ -0.4
                    waist.position = new BABYLON.Vector3(0, -0.40, 0);
                    waist.rotation = new BABYLON.Vector3(0, 0, 0);
                    this.currentArmorParts.push(waist);
                }

                if (legL && this.playerLimbs.legL) {
                    legL.setParent(this.playerLimbs.legL);
                    // Leg mesh starts at -0.25 Y relative to root.
                    // Bone Pivot is top. So we need to position it so top is at 0.
                    // Leg mesh center is roughly -0.25 down.
                    // We might need to adjust based on visual fit.
                    legL.position = new BABYLON.Vector3(0, -0.4, 0);
                    legL.rotation = new BABYLON.Vector3(0, 0, 0);
                    this.currentArmorParts.push(legL);
                }

                if (legR && this.playerLimbs.legR) {
                    legR.setParent(this.playerLimbs.legR);
                    legR.position = new BABYLON.Vector3(0, -0.4, 0);
                    legR.rotation = new BABYLON.Vector3(0, 0, 0);
                    this.currentArmorParts.push(legR);
                }
                leggings.dispose();
            }
        } else if (armorName.includes("Sleeves")) {
            // Sleeves Logic - Split L/R, attach to Arms
            const sleeveName = armorName.replace(/\s/g, "");
            const sleeves = await this.loadModel(`data/models/${sleeveName}.json`);

            if (sleeves) {
                disableCollisions(sleeves); // <--- ADDED
                const parts = sleeves.getChildMeshes();
                const shoulderL = parts.find(m => m.name.includes("L_Shoulder_Cap"));
                const shoulderR = parts.find(m => m.name.includes("R_Shoulder_Cap"));

                if (shoulderL && this.playerLimbs.armL) {
                    shoulderL.setParent(this.playerLimbs.armL);
                    // Shoulder cap should be at top of arm (0.0 or slightly up)
                    // Arm pivot is usually top.
                    shoulderL.position = new BABYLON.Vector3(0, 0, 0);
                    shoulderL.rotation = new BABYLON.Vector3(0, 0, 0);
                    this.currentArmorParts.push(shoulderL);
                }

                if (shoulderR && this.playerLimbs.armR) {
                    shoulderR.setParent(this.playerLimbs.armR);
                    shoulderR.position = new BABYLON.Vector3(0, 0, 0);
                    shoulderR.rotation = new BABYLON.Vector3(0, 0, 0);
                    this.currentArmorParts.push(shoulderR);
                }
                sleeves.dispose();
            }
        }
        if (this.playerLimbs.torso) {
            // Ensure backpack (if any) is parented to torso for better movement
            const backpack = this.player.getChildren().find(c => c.name === "Backpack");
            if (backpack) {
                backpack.parent = this.playerLimbs.torso;
                backpack.position = new BABYLON.Vector3(0, 0, -0.2); // Relative to torso
            }
        }
    },

    updateHair: function (length, color) {
        if (!this.player) return;
        this.updateHairOnMesh(this.player, length, color);
    },

    updatePlayer: function () {
        if (!this.player || this.isPlayerDead) return;

        var deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

        // Player Input / Movement Logic would usually be here or handled via onBeforeRender
        // Current implementation handles input via scene.actionManager in setupControls
    },

    updateRats: function () {
        var deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

        this.rats.forEach(rat => {
            if (!rat || rat._isDisposed) return;

            // 1. Initial / State Check
            if (rat.aiState === "PICK") {
                if (this.scrapPiles.length > 0) {
                    rat.currentTarget = this.scrapPiles[Math.floor(Math.random() * this.scrapPiles.length)];
                    rat.aiState = "MOVE";
                }
                return;
            }

            // 2. Validate Target
            if (!rat.currentTarget || rat.currentTarget._isDisposed) {
                rat.aiState = "PICK";
                return;
            }

            // 3. Distance Check
            const dist = BABYLON.Vector3.Distance(rat.position, rat.currentTarget.position);

            if (rat.aiState === "MOVE") {
                if (dist < 1.5) {
                    rat.aiState = "WAIT";
                    rat.aiWaitTimer = 10; // Pause for 10 seconds
                    return;
                }

                // Smooth Rotation
                rat.currentTarget.position.subtractToRef(rat.position, this.tempVector);
                const targetRotation = Math.atan2(this.tempVector.x, this.tempVector.z);
                let rotationDiff = targetRotation - rat.rotation.y;

                // Keep diff in -PI to PI range
                while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
                while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;

                rat.rotation.y += rotationDiff * 0.1; // Smooth turn

                // Forward Movement
                this.tempVector.set(Math.sin(rat.rotation.y), 0, Math.cos(rat.rotation.y));
                rat.position.addInPlace(this.tempVector.scaleInPlace(0.04));

                // Procedural Walk
                this.animateRatWalk(rat);
            }
            else if (rat.aiState === "WAIT") {
                rat.aiWaitTimer -= deltaTime;
                if (rat.aiWaitTimer <= 0) {
                    rat.aiState = "PICK";
                }
                // Reset legs when stopping
                this.resetRatLegs(rat);
            }
            else if (rat.aiState === "AGGRESSIVE") {
                if (this.isPlayerDead) {
                    rat.aiState = "PICK";
                    rat.currentTarget = null;
                    return;
                }

                // Chase Player
                this.player.position.subtractToRef(rat.position, this.tempVector);
                const dist = this.tempVector.length();

                // Rotation
                const targetRotation = Math.atan2(this.tempVector.x, this.tempVector.z);
                let rotationDiff = targetRotation - rat.rotation.y;
                while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
                while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
                rat.rotation.y += rotationDiff * 0.15;

                if (dist > 1.2) {
                    this.tempVector.set(Math.sin(rat.rotation.y), 0, Math.cos(rat.rotation.y));
                    rat.position.addInPlace(this.tempVector.scaleInPlace(0.06)); // Chase speed
                    this.animateRatWalk(rat);
                } else {
                    // Attack
                    this.resetRatLegs(rat);
                    rat.aiWaitTimer -= deltaTime;
                    if (rat.aiWaitTimer <= 0) {
                        const ratAtk = rat.stats ? rat.stats.ATK : 2;
                        this.dotNetHelper.invokeMethodAsync('TakeDamage', ratAtk);
                        rat.aiWaitTimer = rat.stats ? rat.stats.AtkSpeed : 2.5;

                        // Attack visual (quick lunge)
                        this.tempVector.set(Math.sin(rat.rotation.y), 0, Math.cos(rat.rotation.y));
                        const lunge = this.tempVector.scaleInPlace(0.3).clone(); // Clone once for animation target
                        BABYLON.Animation.CreateAndStartAnimation("rat_lunge", rat, "position", 60, 5, rat.position, rat.position.add(lunge), 2, null, () => {
                            BABYLON.Animation.CreateAndStartAnimation("rat_lunge_back", rat, "position", 60, 10, rat.position, rat.position.subtract(lunge), 2);
                        });
                    }
                }
            }

            // Health Bar Billboarding
            if (rat.healthBar && this.camera) {
                rat.healthBar.lookAt(this.camera.position);
            }
        });
    },

    onWolfHit: function (wolf, damage) {
        if (!wolf.stats) return;

        const netDamage = Math.max(1, damage - Math.floor((wolf.stats.DEF || 0) / 2));
        wolf.stats.HP -= netDamage;

        this.showFloatingDamage(wolf.position.clone(), netDamage, "#ff0000");
        wolf.aiState = "AGGRESSIVE";

        this.updateWolfHealthBar(wolf);

        // Feedback
        const originalY = wolf.position.y;
        BABYLON.Animation.CreateAndStartAnimation("wolf_hit", wolf, "position.y", 60, 4, originalY, originalY + 0.2, 2, null, () => {
            BABYLON.Animation.CreateAndStartAnimation("wolf_hit_reset", wolf, "position.y", 60, 4, wolf.position.y, originalY, 2);
        });

        if (wolf.stats.HP <= 0) {
            const pos = wolf.position.clone();
            this.wolves = this.wolves.filter(w => w !== wolf);
            if (wolf.healthBar) wolf.healthBar.dispose();

            // Grant EXP
            this.dotNetHelper.invokeMethodAsync('AddExperience', wolf.stats.ExpReward || 50);
            wolf.dispose();

            this.dotNetHelper.invokeMethodAsync('SetDialogue', "Great Wolf neutralized.");

            // Wolves drop more loot
            const count = 3 + Math.floor(Math.random() * 4);
            const mats = ["Rubber", "Plastic", "Wood", "Cloth", "Metal"];
            for (let i = 0; i < count; i++) {
                this.spawnLoot(pos, mats[Math.floor(Math.random() * mats.length)]);
            }
        }

        this.showFloatingDamage(wolf.getAbsolutePosition() || wolf.position, damage, "#ff4400"); // Brighter red/orange
    },

    updateWolfHealthBar: function (wolf) {
        if (!wolf.healthBar) {
            wolf.healthBar = new BABYLON.TransformNode("hp_root_" + wolf.name, this.scene);
            wolf.healthBar.parent = wolf;
            wolf.healthBar.position.y = 1.2;
            wolf.healthBar.scaling.setAll(0.8); // Wolf is already scaled up

            const bg = BABYLON.MeshBuilder.CreatePlane("hp_bg", { width: 1, height: 0.1 }, this.scene);
            bg.parent = wolf.healthBar;
            const bgMat = new BABYLON.StandardMaterial("hp_bg_mat", this.scene);
            bgMat.diffuseColor = BABYLON.Color3.Red();
            bg.material = bgMat;

            const fg = BABYLON.MeshBuilder.CreatePlane("hp_fg", { width: 1, height: 0.1 }, this.scene);
            fg.parent = wolf.healthBar;
            fg.position.z = -0.01;
            const fgMat = new BABYLON.StandardMaterial("hp_fg_mat", this.scene);
            fgMat.diffuseColor = BABYLON.Color3.FromHexString("#ffff00"); // Yellow for elites
            fg.material = fgMat;
            wolf.hpIndicator = fg;
        }

        const pct = Math.max(0, wolf.stats.HP / wolf.stats.maxHP);
        wolf.hpIndicator.scaling.x = pct;
        wolf.hpIndicator.position.x = (1 - pct) * -0.5;
    },

    updateWolves: function () {
        const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

        this.wolves.forEach(wolf => {
            if (!wolf || wolf._isDisposed) return;

            const distToPlayer = BABYLON.Vector3.Distance(wolf.position, this.player.position);

            if (distToPlayer < 10) { // Player is within aggro range
                wolf.aiState = "AGGRESSIVE";
            }

            if (wolf.aiState === "AGGRESSIVE") {
                if (this.isPlayerDead) {
                    wolf.aiState = "PICK";
                    wolf.currentTarget = null;
                    return;
                }

                // Chase logic (use scratch vector)
                this.player.position.subtractToRef(wolf.position, this.tempVector);
                const targetRotation = Math.atan2(this.tempVector.x, this.tempVector.z);
                let rotationDiff = targetRotation - wolf.rotation.y;
                while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
                while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
                wolf.rotation.y += rotationDiff * 0.1;

                if (distToPlayer > 2.2) {
                    this.tempVector.set(Math.sin(wolf.rotation.y), 0, Math.cos(wolf.rotation.y));
                    wolf.position.addInPlace(this.tempVector.scaleInPlace(0.08)); // Faster than rat
                    this.animateWolfWalk(wolf);
                } else {
                    this.resetWolfLegs(wolf);
                    wolf.aiWaitTimer -= deltaTime;
                    if (wolf.aiWaitTimer <= 0) {
                        this.dotNetHelper.invokeMethodAsync('TakeDamage', wolf.stats.ATK || 16);
                        wolf.aiWaitTimer = wolf.stats.AtkSpeed || 1.5;

                        // Bite visual (Fixed Scaling Bug)
                        const originalScale = wolf.scaling.clone();
                        const biteScale = originalScale.scale(1.1);

                        BABYLON.Animation.CreateAndStartAnimation("wolf_bite", wolf, "scaling", 60, 5, originalScale, biteScale, 2, null, () => {
                            // Reset to ORIGINAL scaling, not the current modified one
                            BABYLON.Animation.CreateAndStartAnimation("wolf_bite_reset", wolf, "scaling", 60, 5, biteScale, originalScale, 2, null, () => {
                                wolf.scaling.copyFrom(originalScale); // Hard reset to ensure drift doesn't happen
                            });
                        });
                    }
                }
            } else {
                // Idle Wander
                if (wolf.aiState === "PICK") {
                    wolf.currentTarget = new BABYLON.Vector3((Math.random() - 0.5) * 100, 0, (Math.random() - 0.5) * 100 + 40);
                    wolf.aiState = "MOVE";
                }

                if (wolf.aiState === "MOVE") {
                    wolf.currentTarget.subtractToRef(wolf.position, this.tempVector);
                    if (this.tempVector.length() < 2) {
                        wolf.aiState = "WAIT";
                        wolf.aiWaitTimer = 5;
                    } else {
                        const targetRotation = Math.atan2(this.tempVector.x, this.tempVector.z);
                        wolf.rotation.y += (targetRotation - wolf.rotation.y) * 0.05;
                        this.tempVector.set(Math.sin(wolf.rotation.y), 0, Math.cos(wolf.rotation.y));
                        wolf.position.addInPlace(this.tempVector.scaleInPlace(0.03));
                        this.animateWolfWalk(wolf);
                    }
                } else if (wolf.aiState === "WAIT") {
                    this.resetWolfLegs(wolf);
                    wolf.aiWaitTimer -= deltaTime;
                    if (wolf.aiWaitTimer <= 0) wolf.aiState = "PICK";
                }
            }

            if (wolf.healthBar && this.camera) {
                wolf.healthBar.lookAt(this.camera.position);
            }
        });
    },

    animateWolfWalk: function (wolf) {
        if (!wolf.limbs || !wolf.limbs.fl) return;
        const time = performance.now() * 0.01;
        const swing = Math.sin(time) * 0.3;

        wolf.limbs.fl.rotation.x = swing;
        wolf.limbs.br.rotation.x = swing;
        wolf.limbs.fr.rotation.x = -swing;
        wolf.limbs.bl.rotation.x = -swing;
    },

    resetWolfLegs: function (wolf) {
        if (!wolf.limbs || !wolf.limbs.fl) return;
        wolf.limbs.fl.rotation.x = 0;
        wolf.limbs.fr.rotation.x = 0;
        wolf.limbs.bl.rotation.x = 0;
        wolf.limbs.br.rotation.x = 0;
    },

    animateRatWalk: function (rat) {
        if (!rat.limbs || !rat.limbs.fl) return;
        const time = performance.now() * 0.015;
        const swing = Math.sin(time) * 0.4;

        // Diagonally synchronized walk (FL + BR, FR + BL)
        rat.limbs.fl.rotation.x = swing;
        rat.limbs.br.rotation.x = swing;

        rat.limbs.fr.rotation.x = -swing;
        rat.limbs.bl.rotation.x = -swing;
    },

    resetRatLegs: function (rat) {
        if (!rat.limbs || !rat.limbs.fl) return;
        rat.limbs.fl.rotation.x = 0;
        rat.limbs.fr.rotation.x = 0;
        rat.limbs.bl.rotation.x = 0;
        rat.limbs.br.rotation.x = 0;
    },
    updateHairOnMesh: function (root, length, color) {
        const meshes = root.getChildMeshes();
        const anchor = meshes.find(m => m.name.includes("hair_anchor"));

        if (anchor) {
            const hColor = BABYLON.Color3.FromHexString(color);
            if (anchor.material) anchor.material.diffuseColor = hColor;

            let hair = anchor.getChildren().find(c => c.name === "hair_geometry");
            if (!hair) {
                hair = BABYLON.MeshBuilder.CreateBox("hair_geometry", { width: 0.47, height: 0.2, depth: 0.47 }, this.scene);
                hair.parent = anchor;
                hair.position.y = -0.1;
                hair.material = new BABYLON.StandardMaterial("hair_mat", this.scene);

                // FIX: Disable Hair Collision
                hair.checkCollisions = false;
                hair.isPickable = false;
            }
            hair.material.diffuseColor = hColor;
            hair.scaling.y = 1 + length * 3;
            hair.position.y = -(hair.scaling.y * 0.1);
        }
    },

    showFloatingDamage: function (pos, amount, color = "#ffffff") {
        const plane = BABYLON.MeshBuilder.CreatePlane("dmg_" + amount, { size: 1 }, this.scene);
        plane.position = pos.clone();
        plane.position.y += 1.5; // Start above head
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        const texture = new BABYLON.DynamicTexture("dmg_tex_" + amount, { width: 128, height: 128 }, this.scene);
        const mat = new BABYLON.StandardMaterial("dmg_mat", this.scene);
        mat.diffuseTexture = texture;
        mat.useAlphaFromDiffuseTexture = true;
        mat.opacityTexture = texture;
        mat.emissiveColor = BABYLON.Color3.White();
        plane.material = mat;

        texture.drawText(amount.toString(), null, null, "bold 60px Arial", color, "transparent", true);

        // Rise and Fade Animation (3 seconds)
        const frameRate = 60;
        const riseAnim = new BABYLON.Animation("dmg_rise", "position.y", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        const fadeAnim = new BABYLON.Animation("dmg_fade", "visibility", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);

        const keysR = [{ frame: 0, value: plane.position.y }, { frame: frameRate * 2.5, value: plane.position.y + 1.5 }];
        const keysF = [{ frame: 0, value: 1 }, { frame: frameRate * 1.5, value: 1 }, { frame: frameRate * 2.5, value: 0 }];

        riseAnim.setKeys(keysR);
        fadeAnim.setKeys(keysF);

        plane.animations.push(riseAnim);
        plane.animations.push(fadeAnim);

        this.scene.beginAnimation(plane, 0, frameRate * 2.5, false, 1, () => {
            plane.dispose();
        });
    },

    debugPhysics: function () {
        console.log("=== Scrapper 3000 Physics Debug ===");
        if (!this.player) {
            console.log("No player found!");
            return;
        }

        console.log("Player Position: " + this.player.position);
        console.log("Ellipsoid: " + this.player.ellipsoid);
        console.log("Ellipsoid Offset: " + this.player.ellipsoidOffset);
        console.log("CheckCollisions (Root): " + this.player.checkCollisions);

        // Check Limbs
        console.log("-- Children & Collision State --");
        this.player.getChildMeshes().forEach(m => {
            if (m.checkCollisions) {
                console.warn("COLLISION ACTIVE: " + m.name);
            } else {
                console.log("OK (No Collision): " + m.name);
            }
        });

        // Check nearby environment
        console.log("-- Nearby Environment (Potential Floor) --");
        const nearby = this.scene.meshes.filter(m => {
            return m !== this.player &&
                !m.isDescendantOf(this.player) &&
                m.checkCollisions &&
                m.isEnabled() &&
                m.isVisible &&
                BABYLON.Vector3.Distance(this.player.position, m.getAbsolutePosition()) < 5.0;
        });

        nearby.forEach(m => {
            console.log("Floor Candidate: " + m.name + " at " + m.getAbsolutePosition());
        });

        console.log("===================================");
    }
};
