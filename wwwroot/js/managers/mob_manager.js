class MobManager {
    constructor(scene, assetManager, playerController, dotNetHelper) {
        this.scene = scene;
        this.assets = assetManager;
        this.player = playerController; // Need player pos for AI
        this.dotNetHelper = dotNetHelper;

        this.rats = [];
        this.wolves = [];
    }

    notifyPlayerHit(data) {
        // Called when PlayerController detects a hit
        const mesh = data.mesh;
        const mob = mesh.parentMob || mesh;

        // 1. Check for Mobs
        const isValidMob = this.rats.includes(mob) || this.wolves.includes(mob);
        if (isValidMob) {
            this.damageMob(mob, 10);
            return;
        }

        // 2. Check for Scrap Piles (Look at name or parent name)
        const isScrap = mesh.name.toLowerCase().includes("scrap") ||
            (mesh.parent && mesh.parent.name.toLowerCase().includes("scrap")) ||
            (mesh.parentMob && mesh.parentMob.name.toLowerCase().includes("scrap"));

        if (isScrap) {
            this.damageScrap(mesh.parentMob || mesh.parent || mesh, data.point);
        }
    }

    damageScrap(pile, point) {
        if (!pile.stats) pile.stats = { HP: 10 };
        pile.stats.HP -= 10;

        console.log("Scrap Hit! HP: " + pile.stats.HP);
        this.showFloatingDamage(point, "SMASH", "#cccccc");

        if (pile.stats.HP <= 0) {
            // Loot Drop Logic (Simplified)
            this.showFloatingDamage(pile.position, "RESOURCES FOUND", "#00ff66");
            const items = ["Iron", "Copper", "Plastic"];
            const loot = items[Math.floor(Math.random() * items.length)];
            this.dotNetHelper.invokeMethodAsync('OnItemPickedUp', loot);
            pile.dispose();
        }
    }

    damageMob(mob, amount) {
        if (!mob.stats) mob.stats = { HP: 20, maxHP: 20 };

        mob.stats.HP -= amount;
        this.showFloatingDamage(mob.position, amount, "#ff0000");

        // Knockback (Simple)
        const knockDir = mob.position.subtract(this.player.mesh.position).normalize();
        mob.position.addInPlace(knockDir.scale(0.5));

        if (mob.stats.HP <= 0) {
            this.killMob(mob);
        } else {
            // Aggro
            mob.aiState = "ATTACK";
            mob.currentTarget = this.player.mesh;
        }
    }

    killMob(mob) {
        // Remove from list
        this.rats = this.rats.filter(r => r !== mob);
        this.wolves = this.wolves.filter(w => w !== mob);

        // Visuals
        this.showFloatingDamage(mob.position, "XP +10", "#ffff00"); // Yellow XP

        // C# Call
        this.dotNetHelper.invokeMethodAsync('AddExperience', 10);

        // Animation
        // Ideally play death anim, then dispose. For now:
        mob.dispose();
    }

    showFloatingDamage(pos, amount, color) {
        const plane = BABYLON.MeshBuilder.CreatePlane("dmg_" + amount, { width: 4, height: 1 }, this.scene);
        plane.position = pos.clone();
        plane.position.y += 1.5;
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        const texture = new BABYLON.DynamicTexture("dmg_tex_" + amount, { width: 512, height: 128 }, this.scene);
        const mat = new BABYLON.StandardMaterial("dmg_mat", this.scene);
        mat.diffuseTexture = texture;
        mat.useAlphaFromDiffuseTexture = true;
        mat.opacityTexture = texture;
        mat.emissiveColor = BABYLON.Color3.White();
        plane.material = mat;

        texture.drawText(amount.toString(), null, null, "bold 60px Arial", color, "transparent", true);

        const frameRate = 60;
        const riseAnim = new BABYLON.Animation("dmg_rise", "position.y", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        const fadeAnim = new BABYLON.Animation("dmg_fade", "visibility", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);

        riseAnim.setKeys([{ frame: 0, value: plane.position.y }, { frame: 150, value: plane.position.y + 1.5 }]);
        fadeAnim.setKeys([{ frame: 0, value: 1 }, { frame: 90, value: 1 }, { frame: 150, value: 0 }]);

        plane.animations.push(riseAnim);
        plane.animations.push(fadeAnim);

        this.scene.beginAnimation(plane, 0, 150, false, 1, () => plane.dispose());
    }

    async spawnRats() {
        console.log("MobManager: Releasing the rats...");
        for (let i = 0; i < 5; i++) {
            const rat = await this.assets.loadModel("data/models/ApocRat.json");
            if (rat) {
                // IMPORTANT: Override physics disable for mobs so `isPickable` works
                this._enablePicking(rat);

                rat.position = new BABYLON.Vector3(
                    (Math.random() - 0.5) * 40,
                    0,
                    (Math.random() - 0.5) * 40 + 15
                );
                rat.rotation.y = Math.random() * Math.PI * 2;
                rat.scaling.setAll(0.5);

                rat.aiState = "PICK";
                rat.aiWaitTimer = 0;
                rat.biteCooldown = 0;
                rat.limbs = {}; // Cache logic if needed

                this.rats.push(rat);
            }
        }
    }

    async spawnWolves() {
        console.log("MobManager: The wolves are howling...");
        for (let i = 0; i < 3; i++) {
            const wolf = await this.assets.loadModel("data/models/BadlandsWolf.json");
            if (wolf) {
                this._enablePicking(wolf);

                wolf.position = new BABYLON.Vector3(
                    (Math.random() - 0.5) * 80,
                    0,
                    (Math.random() - 0.5) * 80 + 40
                );
                wolf.rotation.y = Math.random() * Math.PI * 2;
                wolf.scaling.setAll(1.5);

                wolf.aiState = "PICK";
                wolf.biteCooldown = 0;
                wolf.stats = { HP: 50, maxHP: 50 }; // Tougher

                this.wolves.push(wolf);
            }
        }
    }

    _enablePicking(root) {
        root.getChildMeshes().forEach(m => {
            m.isInteractable = true;
            m.isPickable = true; // CRITICAL RESTORE
            m.parentMob = root; // LINK BACK FOR HIT DETECTION 🔗
            m.actionManager = new BABYLON.ActionManager(this.scene);

            // Hover (Red outline for mobs, Green/Blue for others?)
            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
                const color = root.name.includes("Scrap") ? new BABYLON.Color3(0, 1, 0) : new BABYLON.Color3(1, 0, 0);
                root.getChildMeshes().forEach(rm => {
                    rm.renderOutline = true;
                    rm.outlineColor = color;
                    rm.outlineWidth = 0.05;
                });
            }));
            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
                root.getChildMeshes().forEach(rm => rm.renderOutline = false);
            }));

            // CLICK/TAP TO WHACK
            m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                // Call the engine's whack logic but targeting this specific mesh
                if (window.Scrapper3000) {
                    window.Scrapper3000.whack(root);
                }
            }));
        });
    }

    update(dt) {
        // AI Loop
        this.wolves.forEach(w => this.updateAI(w, dt));
        this.rats.forEach(r => this.updateAI(r, dt));
    }

    updateAI(mob, dt) {
        if (!mob || mob.isDisposed()) return;

        // STOP ATTACKING IF PLAYER IS DEAD 💀
        if (this.player.isPlayerDead) {
            if (mob.aiState !== "PICK") {
                mob.aiState = "PICK";
                mob.aiWaitTimer = 2.0;
            }
        }

        const playerPos = this.player.mesh ? this.player.mesh.position : new BABYLON.Vector3(0, 0, 0);
        const dist = BABYLON.Vector3.Distance(mob.position, playerPos);

        // Simple State Machine
        if (mob.aiState === "PICK") {
            if (mob.aiWaitTimer > 0) {
                mob.aiWaitTimer -= dt;
            } else {
                mob.aiState = "MOVE";
                mob.targetPos = new BABYLON.Vector3(
                    mob.position.x + (Math.random() - 0.5) * 10,
                    0,
                    mob.position.z + (Math.random() - 0.5) * 10
                );
                mob.lookAt(mob.targetPos);
            }
            if (dist < 10 && this.player.mesh) {
                mob.aiState = "ATTACK"; // Aggro if close
                mob.currentTarget = this.player.mesh;
            }
        }
        else if (mob.aiState === "MOVE") {
            const moveDir = mob.targetPos.subtract(mob.position).normalize();
            mob.position.addInPlace(moveDir.scale(0.04)); // Slow wander

            if (BABYLON.Vector3.Distance(mob.position, mob.targetPos) < 1.0) {
                mob.aiState = "PICK";
                mob.aiWaitTimer = 2.0 + Math.random() * 3.0;
            }
        }
        else if (mob.aiState === "ATTACK") {
            if (this.player.mesh) {
                mob.lookAt(this.player.mesh.position);
                const dir = this.player.mesh.position.subtract(mob.position).normalize();

                if (dist > 1.8) { // Only move if not too close
                    mob.position.addInPlace(dir.scale(0.08)); // Fast run
                }

                if (dist < 2.5) { // Reachable distance for bite
                    this.mobBite(mob, dt);
                }
            }
        }
    }

    mobBite(mob, dt) {
        if (mob.biteCooldown > 0) {
            mob.biteCooldown -= dt;
            return;
        }

        console.log(mob.name + " BITES!");
        mob.biteCooldown = 2.0; // 2s cooldown

        // Calculate Damage
        let dmg = 10;
        if (mob.name.includes("Wolf")) dmg = 15;

        // Visuals
        this.showFloatingDamage(this.player.mesh.position, dmg, "#ff0000");

        // C# Notify
        this.dotNetHelper.invokeMethodAsync('TakeDamage', dmg);
    }
}
window.MobManager = MobManager;
