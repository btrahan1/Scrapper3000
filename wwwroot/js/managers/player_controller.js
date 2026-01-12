class PlayerController {
    constructor(scene, assetManager, dotNetHelper) {
        this.scene = scene;
        this.assets = assetManager;
        this.dotNetHelper = dotNetHelper;
        this.mesh = null;
        this.playerLimbs = {};
        this.limbGroups = {
            Head: [],
            Chest: [],
            Arms: [],
            Gloves: [],
            Legs: [],
            Feet: []
        };
        this.currentWeaponMesh = null;
        this.currentArmorParts = [];

        // Stats
        this.isPlayerDead = false;
        this.isAttacking = false;
        this.attackCooldown = 0.0;
        this.walkSpeed = 0.10;
        this.runSpeed = 0.20;
        this.attackPower = 10;
        this.defense = 0;

        // Animation State
        this.initialTorsoY = 0;
        this.bobCycle = 0;

        // Camera Management
        this.camera = null;
        this.isFirstPerson = false;

        this.baseSkinColor = "#bd9a7a"; // Default skin
    }

    setupThirdPersonCamera() {
        if (this.camera) this.camera.dispose();

        const cam = new BABYLON.ArcRotateCamera("ThirdPersonCamera", Math.PI / 2, Math.PI / 3, 5, BABYLON.Vector3.Zero(), this.scene);
        cam.lowerRadiusLimit = 2;
        cam.upperRadiusLimit = 15;
        cam.attachControl(this.scene.getEngine().getRenderingCanvas(), true);

        if (this.mesh) {
            cam.lockedTarget = this.mesh;
        }

        this.scene.activeCamera = cam;
        this.camera = cam;
        this.isFirstPerson = false;
    }

    setupFirstPersonCamera() {
        if (this.camera) this.camera.dispose();

        const cam = new BABYLON.FreeCamera("FirstPersonCamera", new BABYLON.Vector3(0, 1.7, 0), this.scene);
        cam.attachControl(this.scene.getEngine().getRenderingCanvas(), true);

        if (this.mesh) {
            cam.parent = this.mesh;
        }

        this.scene.activeCamera = cam;
        this.camera = cam;
        this.isFirstPerson = true;
    }

    async updateAvatar(gender, hairLength, hairColor) {
        if (this.gender !== gender) {
            await this.spawn(gender, hairLength, hairColor);
        } else {
            this.updateHairOnMesh(hairLength, hairColor);
        }

        // Always check camera after spawn/update
        if (!this.camera) {
            this.setupThirdPersonCamera();
        }
    }

    updateHair(length, color) {
        this.updateHairOnMesh(length, color);
    }

    playDeathAnimation() {
        this.isPlayerDead = true;
        // Simple fall over
        if (this.mesh) {
            this.mesh.rotation.z = Math.PI / 2;
            this.mesh.position.y = 0.5;
        }
    }

    respawnPlayer() {
        this.isPlayerDead = false;
        if (this.mesh) {
            this.mesh.rotation.z = 0;
            this.mesh.position = new BABYLON.Vector3(0, 2.0, 15);
        }
    }

    async spawn(gender, hairLength, hairColor) {
        console.log("PlayerController: Spawning " + gender);

        // 1. Dispose old mesh if exists
        if (this.mesh) {
            this.mesh.dispose();
            this.mesh = null;
            this.playerLimbs = {};
        }

        // 2. Load Model
        const path = gender === "Female" ? "data/models/ScrapperFemale.json" : "data/models/ScrapperMale.json";
        this.mesh = await this.assets.loadModel(path);

        if (!this.mesh) {
            console.error("Failed to load player model!");
            return;
        }

        // 3. Setup Physics & Camera Target
        this.mesh.checkCollisions = true;
        this.mesh.ellipsoid = new BABYLON.Vector3(0.3, 1.0, 0.3); // Standardized 2m height collider
        this.mesh.ellipsoidOffset = new BABYLON.Vector3(0, 0.8, 0); // Precise offset to clear -0.20m model sole depth
        this.mesh.position = new BABYLON.Vector3(0, 2.0, 15); // Drop in spawn

        // 3.5 Re-setup camera target if it exists
        if (this.camera && !this.isFirstPerson) {
            this.camera.lockedTarget = this.mesh;
        } else if (this.camera && this.isFirstPerson) {
            this.camera.parent = this.mesh;
        }

        // 4. Cache Limbs, Hair & Face
        this.cachePlayerLimbs();
        this.updateHairOnMesh(hairLength, hairColor);
        this.updateFaceOnMesh();

        // 5. Attach Backpack (Standard Gear)
        const backpack = await this.assets.loadModel("data/models/Backpack.json");
        if (backpack) {
            this._disableCollisions(backpack); // Prevent self-collision
            // Parent to chest for correct height and bobbing
            // Parent to torso/spine for a lower, more natural position on the back
            const backAnchor = this.playerLimbs.torso || this.playerLimbs.chest;
            if (backAnchor) {
                backpack.parent = backAnchor;
                backpack.position = new BABYLON.Vector3(0, 0.1, -0.15); // Sit on lower back/spine
                backpack.scaling.setAll(0.5); // Keep the compact scale

                // Give it a "rough/matte" look (no specular)
                backpack.getChildMeshes().forEach(m => {
                    if (m.material) {
                        m.material.specularColor = new BABYLON.Color3(0, 0, 0);
                        m.material.roughness = 1.0;
                    }
                });
            } else {
                backpack.parent = this.mesh;
                backpack.position = new BABYLON.Vector3(0, 1.2, -0.2);
            }
        }
    }

    updateMovement(dt, input) {
        if (!this.mesh || this.isPlayerDead) return;

        const isMoving = (input.x !== 0 || input.y !== 0);
        let speed = this.walkSpeed;

        // Rotation
        if (input.x !== 0) {
            this.mesh.rotation.y += input.x * 2.0 * dt;
        }

        // Movement
        if (input.y !== 0) {
            const forward = new BABYLON.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));
            const direction = forward.scale(input.y * speed);

            // GRAVITY: -0.5 Y per frame (simple gravity)
            direction.y = -0.5;

            this.mesh.moveWithCollisions(direction);

            // Bobbing Animation
            this.animateWalk(true);
        } else {
            // Apply gravity even when still
            this.mesh.moveWithCollisions(new BABYLON.Vector3(0, -0.5, 0));
            this.animateWalk(false);
        }

        // Attack Cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
            if (this.attackCooldown <= 0) this.isAttacking = false;
        }
    }

    animateWalk(isWalking) {
        if (!this.playerLimbs.armL) return; // Limbs not ready

        if (isWalking) {
            const time = performance.now() * 0.008; // Slightly faster rhythm

            // 1. Limbs Swing (Opposing movement)
            const swing = Math.sin(time);
            this.playerLimbs.armL.rotation.x = swing * 0.5;
            this.playerLimbs.armR.rotation.x = -swing * 0.5;
            this.playerLimbs.legL.rotation.x = -swing * 0.6; // Slightly more leg lift
            this.playerLimbs.legR.rotation.x = swing * 0.6;

            // 2. Double-Bounce Bob
            // Math.abs gives us a peak for every footfall (2 per full limb cycle)
            const bob = Math.abs(swing) * 0.04;
            if (this.playerLimbs.torso) {
                this.playerLimbs.torso.position.y = this.initialTorsoY + bob;
                // 3. Torso Sway (Weight transfer side-to-side)
                this.playerLimbs.torso.rotation.z = swing * 0.04;
            }

            // 4. Head Rhythm
            if (this.playerLimbs.head) {
                this.playerLimbs.head.rotation.y = swing * 0.05;
                this.playerLimbs.head.rotation.z = -swing * 0.02; // Counter-sway
            }

        } else {
            // Reset to Idle Pose
            const lerp = 0.15; // Snappier return
            this.playerLimbs.armL.rotation.x = BABYLON.Scalar.Lerp(this.playerLimbs.armL.rotation.x, 0, lerp);
            this.playerLimbs.armR.rotation.x = BABYLON.Scalar.Lerp(this.playerLimbs.armR.rotation.x, 0, lerp);
            this.playerLimbs.legL.rotation.x = BABYLON.Scalar.Lerp(this.playerLimbs.legL.rotation.x, 0, lerp);
            this.playerLimbs.legR.rotation.x = BABYLON.Scalar.Lerp(this.playerLimbs.legR.rotation.x, 0, lerp);

            if (this.playerLimbs.torso) {
                this.playerLimbs.torso.position.y = BABYLON.Scalar.Lerp(this.playerLimbs.torso.position.y, this.initialTorsoY, lerp);
                this.playerLimbs.torso.rotation.z = BABYLON.Scalar.Lerp(this.playerLimbs.torso.rotation.z, 0, lerp);
            }
            if (this.playerLimbs.head) {
                this.playerLimbs.head.rotation.y = BABYLON.Scalar.Lerp(this.playerLimbs.head.rotation.y, 0, lerp);
                this.playerLimbs.head.rotation.z = BABYLON.Scalar.Lerp(this.playerLimbs.head.rotation.z, 0, lerp);
            }
        }
    }

    whack(target = null) {
        if (!this.mesh || this.isAttacking || this.isPlayerDead || this.attackCooldown > 0) return;

        console.log("Player: Whack!");
        this.isAttacking = true;
        this.attackCooldown = 0.5;

        // Swing Animation (Simple Arm Raise)
        if (this.playerLimbs.armR) {
            const anim = new BABYLON.Animation("whack", "rotation.x", 60, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
            const keys = [
                { frame: 0, value: this.playerLimbs.armR.rotation.x },
                { frame: 10, value: -Math.PI / 2 }, // Up
                { frame: 20, value: Math.PI / 4 },  // Down fast
                { frame: 30, value: 0 } // Return
            ];
            anim.setKeys(keys);
            this.scene.beginDirectAnimation(this.playerLimbs.armR, [anim], 0, 30, false, 1.5);
        }

        // If we have a direct target (from a click), use it. Otherwise raycast.
        if (target) {
            this.handleHit(target, target.absolutePosition);
        } else {
            this.checkForScrapHit();
        }
    }

    handleHit(mesh, point) {
        console.log("HIT: " + mesh.name);

        // 1. Identify Hit Type (Blood vs Sparks)
        const mob = mesh.parentMob || mesh;
        const lowName = (mob.name || mesh.name).toLowerCase();
        const isOrganic = lowName.includes("rat") || lowName.includes("wolf");
        const fxType = isOrganic ? "blood" : "spark";

        // 2. Trigger particles
        this.createHitFX(point, fxType);

        // 3. Emit event for GameEngine/Blazor logic
        const event = new CustomEvent("playerHit", {
            detail: {
                mesh: mesh,
                point: point,
                attackPower: this.attackPower
            }
        });
        window.dispatchEvent(event);
    }

    checkForScrapHit() {
        if (!this.mesh) return;
        const origin = this.mesh.position.clone();
        origin.y += 0.4; // Low enough for rats, high enough for wolves 🐀🐺

        // Use Babylon's built-in forward vector for accuracy
        const forward = this.mesh.forward.clone();
        const length = 3.5;

        const ray = new BABYLON.Ray(origin, forward, length);
        // Visual debug
        // BABYLON.RayHelper.CreateAndShow(ray, this.scene, new BABYLON.Color3(1, 0, 0));

        const hit = this.scene.pickWithRay(ray, (mesh) => {
            if (!mesh.isInteractable) return false;
            // Don't hit self (check up the hierarchy)
            let p = mesh;
            while (p) {
                if (p === this.mesh) return false;
                p = p.parent;
            }
            return true;
        });

        if (hit.pickedMesh) {
            this.handleHit(hit.pickedMesh, hit.pickedPoint);
        }
    }

    createHitFX(pos, type) {
        if (window.Scrapper3000) {
            window.Scrapper3000.createParticleSystem(type, pos);
        }
    }

    async updateGear() {
        if (!this.mesh || !this.dotNetHelper) return;

        try {
            // 1. Fetch full gear metadata from C#
            let equipment = await this.dotNetHelper.invokeMethodAsync("GetEquippedItemsMetadata");
            if (!equipment) return;

            // Parse if it's a JSON string
            if (typeof equipment === 'string') {
                try {
                    equipment = JSON.parse(equipment);
                } catch (e) {
                    console.error("❌ Failed to parse equipment metadata:", e);
                    return;
                }
            }

            console.log("🎭 Updating Hybrid Equipment:", equipment);

            // 2. Clear ONLY 3D attachment models 
            this.currentArmorParts.forEach(p => p.dispose());
            this.currentArmorParts = [];
            if (this.currentWeaponMesh) {
                this.currentWeaponMesh.dispose();
                this.currentWeaponMesh = null;
            }

            // 3. Process each slot
            for (const slot in equipment) {
                const item = equipment[slot];
                const itemName = item.name || item.Name;
                const useModel = item.useModel || item.UseModel;
                const colorHex = item.colorHex || item.ColorHex;

                if (itemName === "None" || !itemName) {
                    // SPECIAL: If bot slot cleared, tell BotManager
                    if (slot === "Bot" && window.Scrapper3000 && window.Scrapper3000.bot) {
                        window.Scrapper3000.bot.updateBot("None");
                    }
                    // Reset limb colors to skin for soft gear slots
                    if (!useModel) this.applyLimbColor(slot, this.baseSkinColor);
                    continue;
                }

                if (useModel) {
                    // SPECIAL: Bot Slot is handled by BotManager
                    if (slot === "Bot") {
                        if (window.Scrapper3000 && window.Scrapper3000.bot) {
                            window.Scrapper3000.bot.updateBot(itemName);
                        }
                        continue;
                    }

                    // HARD GEAR: Load and attach 3D Model
                    const modelPath = `data/models/${itemName.replace(/ /g, "")}.json`;
                    const itemMesh = await this.assets.loadModel(modelPath);
                    if (!itemMesh) continue;

                    this._disableCollisions(itemMesh);

                    if (slot === "Weapon") {
                        itemMesh.parent = this.playerLimbs.handR || this.playerLimbs.armR;
                        itemMesh.position = new BABYLON.Vector3(0, 0, 0); // Reset offset, hand is precise
                        itemMesh.rotation.x = Math.PI / 2;
                        itemMesh.rotation.z = Math.PI / 4;
                        this.currentWeaponMesh = itemMesh;
                    } else if (slot === "Head") {
                        itemMesh.parent = this.playerLimbs.head;
                        itemMesh.position = new BABYLON.Vector3(0, 0, 0);
                        itemMesh.scaling.setAll(1.0);
                        this.currentArmorParts.push(itemMesh);
                        this.toggleHair(false);
                    } else {
                        itemMesh.parent = this.mesh;
                        itemMesh.position = new BABYLON.Vector3(0, 0, 0);
                        this.currentArmorParts.push(itemMesh);
                    }
                } else {
                    // SOFT GEAR: Apply Material/Color swap
                    this.applyLimbColor(slot, colorHex);
                }
            }

            // Helmet check: If no head gear is equipped, show hair
            if (equipment["Head"]?.name === "None" || equipment["Head"]?.Name === "None") {
                this.toggleHair(true);
            }

            console.log(`✅ Hybrid Equipment update complete.`);
        } catch (error) {
            console.error("❌ Fatal error during updateGear:", error);
            // Attempt to restore hair visibility as a fallback
            this.toggleHair(true);
        }
    }

    /**
     * Applies a material color override to a limb group.
     */
    applyLimbColor(slot, colorHex) {
        const meshes = this.limbGroups[slot];
        if (!meshes || meshes.length === 0) return;

        const color = BABYLON.Color3.FromHexString(colorHex);
        meshes.forEach(m => {
            if (m.material) {
                m.material.diffuseColor = color;
            }
        });
        console.log(`🎨 Applied ${colorHex} to ${slot} group (${meshes.length} meshes)`);
    }


    cachePlayerLimbs() {
        const children = this.mesh.getChildMeshes();

        // Helper to categorize meshes
        const categorize = (keywords) => {
            return children.filter(m => {
                const name = m.name.toLowerCase();
                return keywords.some(k => name.includes(k.toLowerCase()));
            });
        };

        // 1. Legacy Limb Mapping for animations
        this.playerLimbs = {
            head: children.find(m => m.name.toLowerCase().includes("head_core")) || children.find(m => m.name.toLowerCase().includes("neck")),
            chest: categorize(["chest_core"])[0], // Explicit chest for gear parenting
            torso: categorize(["pelvis", "spine"])[0],
            armL: categorize(["arm_upper_l", "shoulder_l"])[0],
            armR: categorize(["arm_upper_r", "shoulder_r"])[0],
            handR: categorize(["hand_r", "wrist_r"])[0],
            legL: categorize(["thigh_l"])[0],
            legR: categorize(["thigh_r"])[0]
        };

        // 2. Hybrid System Mapping (Material Groups)
        this.limbGroups = {
            Head: categorize(["head_core", "neck"]),
            Chest: categorize(["chest", "spine", "stomach", "pelvis", "shoulder", "wrap", "shorts", "bust"]), // Added bust
            Arms: categorize(["arm_upper", "arm_lower", "elbow", "sleeve"]),
            Gloves: categorize(["hand", "wrist"]),
            Legs: categorize(["thigh", "calf", "knee"]),
            Feet: categorize(["foot", "boot", "sole"])
        };

        // Cache initial Torso Y for bobbing
        if (this.playerLimbs.torso) {
            this.initialTorsoY = this.playerLimbs.torso.position.y;
        }

        console.log("🧍 Player Limbs Cached & Grouped for Hybrid System", this.limbGroups);
    }

    updateHairOnMesh(length, colorHex) {
        if (!this.playerLimbs.head) return;
        this.lastHairLength = length;
        this.lastHairColor = colorHex;

        const hColor = this.assets.hexToColor(colorHex);

        // PAINTED HAIR: Find "hair_base" (from JSON model) and color it
        const headMeshes = this.playerLimbs.head.getChildMeshes();
        const hairBase = headMeshes.find(m => m.name.toLowerCase().includes("hair_base"));

        if (hairBase && hairBase.material) {
            hairBase.material.diffuseColor = hColor;
            hairBase.material.specularColor = new BABYLON.Color3(0, 0, 0); // Matte

            // Toggle visibility based on length (0 = shaved)
            hairBase.isVisible = length > 0.05;
        }

        // Clean up any old anchor or procedural spikes
        const oldAnchor = headMeshes.find(m => m.name.includes("hair_anchor"));
        if (oldAnchor) oldAnchor.dispose();
    }

    updateFaceOnMesh() {
        if (!this.playerLimbs.head) return;

        // Find or create face anchor
        let anchor = this.playerLimbs.head.getChildMeshes().find(m => m.name.includes("face_anchor"));
        if (!anchor) {
            anchor = new BABYLON.TransformNode("face_anchor", this.scene);
            anchor.parent = this.playerLimbs.head;
            anchor.position.z = 0.085; // Slightly forward
            anchor.position.y = 0.02; // Face center
        }

        // Clean old face parts
        anchor.getChildren().forEach(c => c.dispose());

        const featureMat = new BABYLON.StandardMaterial("face_feature_mat", this.scene);
        featureMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1); // Dark scrapper features
        featureMat.specularColor = new BABYLON.Color3(0, 0, 0);

        // 1. EYES
        [-0.05, 0.05].forEach(x => {
            const eye = BABYLON.MeshBuilder.CreateSphere(`eye_${x > 0 ? 'R' : 'L'}`, {
                diameterX: 0.035,
                diameterY: 0.025,
                diameterZ: 0.01,
                segments: 8
            }, this.scene);
            eye.parent = anchor;
            eye.position.set(x, 0.03, 0);
            eye.material = featureMat;
            this._disableCollisions(eye);
        });

        // 2. NOSE (Tiny scrapper box/slug)
        const nose = BABYLON.MeshBuilder.CreateBox("nose", { width: 0.02, height: 0.03, depth: 0.03 }, this.scene);
        nose.parent = anchor;
        nose.position.set(0, 0, 0);
        nose.material = featureMat;
        this._disableCollisions(nose);

        // 3. MOUTH (Horizontal strip/detail)
        const mouth = BABYLON.MeshBuilder.CreateBox("mouth", { width: 0.05, height: 0.01, depth: 0.01 }, this.scene);
        mouth.parent = anchor;
        mouth.position.set(0, -0.05, 0);
        mouth.material = featureMat;
        this._disableCollisions(mouth);
    }

    toggleHair(show) {
        if (!this.playerLimbs.head) return;
        const hairBase = this.playerLimbs.head.getChildMeshes().find(m => m.name.toLowerCase().includes("hair_base"));
        if (hairBase) hairBase.isVisible = show && (this.lastHairLength > 0.05);
    }

    _disableCollisions(mesh) {
        if (!mesh) return;
        mesh.checkCollisions = false;
        mesh.isPickable = false;
        if (mesh.getChildMeshes) {
            mesh.getChildMeshes().forEach(m => {
                m.checkCollisions = false;
                m.isPickable = false;
            });
        }
    }
}
window.PlayerController = PlayerController;
