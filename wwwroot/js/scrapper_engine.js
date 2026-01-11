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
        var stick = BABYLON.MeshBuilder.CreateCylinder("stick", { height: 1.2, diameter: 0.08 }, this.scene);
        stick.position = new BABYLON.Vector3(1.5, 0.9, 2);
        stick.rotation.x = Math.PI / 2;
        var stMat = new BABYLON.StandardMaterial("stMat", this.scene);
        stMat.diffuseColor = new BABYLON.Color3(0.4, 0.3, 0.2);
        stick.material = stMat;
        this.setupInteractable(stick, "stick");
    },

    setupInteractable: function (mesh, type) {
        mesh.isInteractable = true;
        mesh.interactType = type;

        // Simple highlight on hover
        mesh.actionManager = new BABYLON.ActionManager(this.scene);
        mesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
            mesh.renderOutline = true;
            mesh.outlineWidth = 0.1;
        }));
        mesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
            mesh.renderOutline = false;
        }));

        mesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
            this.pickUpItem(mesh);
        }));
    },

    exitShed: function () {
        console.log("Scrapper 3000: Exiting Shed...");
        // Fade effect or just teleport
        if (this.player) {
            this.player.position = new BABYLON.Vector3(0, 0.1, 15);
            this.spawnJunkyard();
        }
    },

    jumpToJunkyard: async function (gender, hairLength, hairColor) {
        console.log("Scrapper 3000: Jumping to Junkyard...");
        await this.switchToThirdPerson(gender, hairLength, hairColor);
        this.spawnJunkyard();
        if (this.player) {
            this.player.position = new BABYLON.Vector3(0, 0.1, 15);
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

        // Spawn Scrap Piles
        for (let i = 0; i < 20; i++) {
            const x = (Math.random() - 0.5) * 60;
            const z = (Math.random() - 0.5) * 60 + 30; // Shift forward
            if (Math.abs(x) < 5 && Math.abs(z - 15) < 5) continue; // Don't spawn on player exit

            this.loadModel("data/models/ScrapPile.json").then(pile => {
                if (pile) {
                    pile.position = new BABYLON.Vector3(x, 0, z);
                    pile.name = "ScrapPile_" + i;
                    this.setupScrapPile(pile);
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

        console.log("Scrapper 3000: Junkyard Generated.");
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
        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (this.player && BABYLON.Vector3.Distance(this.player.position, kiosk.position) > 8) {
                this.dotNetHelper.invokeMethodAsync('CloseShop');
            }
        });
    },

    setupScrapPile: function (pile) {
        pile.getChildMeshes().forEach(m => {
            m.isInteractable = true;
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

            let root;
            if (data.parts) {
                root = new BABYLON.Mesh(data.name, this.scene);
                data.parts.forEach(part => {
                    let mesh = this.createPrimitive(part);
                    mesh.parent = root;
                });
            } else {
                root = this.createPrimitive(data);
            }
            return root;
        } catch (e) {
            console.error("Error loading model: " + path, e);
            return null;
        }
    },

    createPrimitive: function (data) {
        let mesh;
        const mat = new BABYLON.StandardMaterial(data.name + "_mat", this.scene);
        if (data.color) {
            mat.diffuseColor = new BABYLON.Color3(data.color.r, data.color.g, data.color.b);
        }

        switch (data.type) {
            case "box":
                mesh = BABYLON.MeshBuilder.CreateBox(data.name, {
                    width: data.width || data.size,
                    height: data.height || data.size,
                    depth: data.depth || data.size
                }, this.scene);
                break;
            case "sphere":
                mesh = BABYLON.MeshBuilder.CreateSphere(data.name, {
                    diameter: data.diameter
                }, this.scene);
                break;
            case "cylinder":
                mesh = BABYLON.MeshBuilder.CreateCylinder(data.name, {
                    height: data.height,
                    diameter: data.diameter
                }, this.scene);
                break;
        }

        if (data.position) {
            mesh.position = new BABYLON.Vector3(data.position.x, data.position.y, data.position.z);
        }
        if (data.rotation) {
            mesh.rotation = new BABYLON.Vector3(data.rotation.x, data.rotation.y, data.rotation.z);
        }
        mesh.material = mat;
        return mesh;
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

        // 3. Attach Gear from JSON
        const backpack = await this.loadModel("data/models/Backpack.json");
        backpack.parent = player;
        backpack.position = new BABYLON.Vector3(0, 0.4, -0.2);

        const stick = await this.loadModel("data/models/Stick.json");
        stick.parent = player;
        stick.position = new BABYLON.Vector3(0.4, 0.5, 0.2);
        stick.rotation.x = -Math.PI / 4;

        // Player Collision
        player.checkCollisions = true;
        player.ellipsoid = new BABYLON.Vector3(0.3, 0.9, 0.3);
        player.ellipsoidOffset = new BABYLON.Vector3(0, 0.9, 0);

        this.player = player;

        // 4. Create 3rd Person Camera
        var camera = new BABYLON.ArcRotateCamera("ThirdPersonCam", -Math.PI / 2, Math.PI / 2.5, 4, player.position, this.scene);
        camera.setTarget(player);
        camera.attachControl(this.canvas, true);
        camera.lowerRadiusLimit = 2;
        camera.upperRadiusLimit = 10;

        this.camera = camera;
        this.cachePlayerLimbs();

        // 5. Cleanup Old Camera
        if (oldCamera) {
            oldCamera.dispose();
        }

        // 6. Setup Controls & Movement
        this.setupThirdPersonControls();
    },

    setupThirdPersonControls: function () {
        this.keys = {};
        window.addEventListener("keydown", (e) => { this.keys[e.key.toLowerCase()] = true; });
        window.addEventListener("keyup", (e) => { this.keys[e.key.toLowerCase()] = false; });

        // Attack Trigger
        window.addEventListener("mousedown", (e) => { if (e.button === 0) this.whack(); });
        window.addEventListener("keydown", (e) => { if (e.code === "Space") this.whack(); });

        this.scene.onBeforeRenderObservable.add(() => {
            if (!this.player || !this.camera) return;

            const moveSpeed = 0.08;
            const turnSpeed = 0.04;
            const gravity = -0.15; // Vertical force

            // 1. Rotation (A/D)
            if (this.keys["a"]) {
                this.player.rotation.y -= turnSpeed;
            }
            if (this.keys["d"]) {
                this.player.rotation.y += turnSpeed;
            }

            // 2. Movement (W/S)
            let moveVector = BABYLON.Vector3.Zero();

            // Forward vector is based on mesh rotation
            var forward = this.player.forward;

            if (this.keys["w"]) {
                moveVector.addInPlace(forward.scale(moveSpeed));
            }
            if (this.keys["s"]) {
                moveVector.addInPlace(forward.scale(-moveSpeed * 0.5)); // Slower backward
            }

            // 3. Apply Gravity (Constant downward force)
            moveVector.y = gravity;

            // 4. Final Move
            this.player.moveWithCollisions(moveVector);

            // 5. Walking Animation
            const isMoving = this.keys["w"] || this.keys["s"];
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
            if (limbs.torso) limbs.torso.position.y = 0.9 + Math.sin(this.animTimer * 2) * 0.05;
        } else {
            // Reset to Idle
            const lerp = 0.15;
            if (limbs.legL) limbs.legL.rotation.x = BABYLON.Scalar.LerpAngle(limbs.legL.rotation.x, 0, lerp);
            if (limbs.legR) limbs.legR.rotation.x = BABYLON.Scalar.LerpAngle(limbs.legR.rotation.x, 0, lerp);
            if (limbs.armL) limbs.armL.rotation.x = BABYLON.Scalar.LerpAngle(limbs.armL.rotation.x, 0, lerp);

            if (!this.isWhacking && limbs.armR) {
                limbs.armR.rotation.x = BABYLON.Scalar.LerpAngle(limbs.armR.rotation.x, 0, lerp);
            }

            if (limbs.torso) limbs.torso.position.y = BABYLON.Scalar.Lerp(limbs.torso.position.y, 0.9, lerp);
        }
    },

    whack: function (clickTarget) {
        if (this.isWhacking || !this.player) return;
        this.isWhacking = true;
        this.currentClickTarget = clickTarget;

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

        if (!target) {
            const ray = new BABYLON.Ray(this.player.position.add(new BABYLON.Vector3(0, 0.5, 0)), this.player.forward, 3.0);
            const hit = this.scene.pickWithRay(ray);
            target = hit && hit.pickedMesh ? hit.pickedMesh : null;
        }

        if (target) {
            while (target.parent && !target.name.includes("ScrapPile")) {
                target = target.parent;
            }

            if (target && target.name.includes("ScrapPile")) {
                const dist = BABYLON.Vector3.Distance(this.player.position, target.getAbsolutePosition() || target.position);
                if (dist < 3.5) {
                    this.onScrapPileHit(target);
                } else {
                    console.log("Too far to whack!");
                    this.dotNetHelper.invokeMethodAsync('SetDialogue', "Too far! Get closer.");
                }
            }
        }
    },

    onScrapPileHit: function (pile) {
        console.log("Hit Scrap Pile: " + pile.name);

        // Capture base position on first hit to prevent drift
        if (pile.hp === undefined) {
            pile.hp = 3;
            pile.baseY = pile.position.y;
        }
        pile.hp--;

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
    },

    popScrapPile: function (pile) {
        const pos = pile.getAbsolutePosition().clone();
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

    updateAvatar: async function (gender, hairLength, hairColor) {
        if (!this.player) return;
        const oldPlayer = this.player;

        const path = gender === "Female" ? "data/models/ScrapperFemale.json" : "data/models/ScrapperMale.json";
        const newPlayer = await this.loadModel(path);

        const children = oldPlayer.getChildMeshes(true);
        children.forEach(c => {
            if (c.name.includes("equipped") || c.name === "ScrapperBackpack" || c.name === "ScrapperStick") {
                c.parent = newPlayer;
            }
        });

        this.updateHairOnMesh(newPlayer, hairLength, hairColor);

        if (this.camera && this.camera.setTarget) {
            this.camera.setTarget(newPlayer);
        }

        this.player = newPlayer;
        this.cachePlayerLimbs();
        oldPlayer.dispose();
    },

    cachePlayerLimbs: function () {
        if (!this.player) return;
        const children = this.player.getChildMeshes();
        this.playerLimbs = {
            legL: children.find(m => m.name.includes("leg_l")),
            legR: children.find(m => m.name.includes("leg_r")),
            armL: children.find(m => m.name.includes("arm_l")),
            armR: children.find(m => m.name.includes("arm_r")),
            torso: children.find(m => m.name.includes("torso"))
        };
        console.log("Scrapper 3000: Limbs cached.");
    },

    updateHair: function (length, color) {
        if (!this.player) return;
        this.updateHairOnMesh(this.player, length, color);
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
            }
            hair.material.diffuseColor = hColor;
            hair.scaling.y = 1 + length * 3;
            hair.position.y = -(hair.scaling.y * 0.1);
        }
    }
};
