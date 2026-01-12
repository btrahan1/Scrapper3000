class BotManager {
    constructor(scene, assets, player, mobs, dotNetHelper) {
        this.scene = scene;
        this.assets = assets;
        this.player = player;
        this.mobs = mobs;
        this.dotNetHelper = dotNetHelper;
        this.botMesh = null;
        this.botName = "None";
        this.followDistance = 1.8;
        this.followHeight = 1.7;
        this.lerpSpeed = 0.04;
        this.pickupRadius = 6.0; // Slightly larger for MK4
        this.pickupCooldown = 0;
    }

    async updateBot(botName) {
        if (this.botName === botName) return;
        this.botName = botName;

        if (this.botMesh) {
            this.botMesh.dispose();
            this.botMesh = null;
        }

        if (botName === "None") return;

        console.log("BotManager: Equipping " + botName);

        // Load Bot Model (Sanitize name)
        const modelName = botName.replace(/\s/g, '');
        const path = `data/models/${modelName}.json`;

        this.botMesh = await this.assets.loadModel(path);

        if (this.botMesh) {
            this.botMesh.position = this.player.mesh.position.clone();
            this.botMesh.position.y += 2;
        }
    }

    update(dt) {
        if (!this.botMesh || !this.player.mesh) return;

        // 1. Follow Logic
        const targetPos = this.player.mesh.position.clone();

        // Position bot behind and to the left of the player
        const back = this.player.mesh.forward.scale(-1.5);
        const left = this.player.mesh.right.scale(-1.2);
        targetPos.addInPlace(back).addInPlace(left);

        // Hover height with bobbing
        targetPos.y = this.followHeight + Math.sin(performance.now() * 0.002) * 0.15;

        // Smooth position transition
        this.botMesh.position = BABYLON.Vector3.Lerp(this.botMesh.position, targetPos, this.lerpSpeed);

        // Smooth rotation to look where the player is looking
        this.botMesh.rotationQuaternion = null; // Use Euler for simplicity
        const targetRot = this.player.mesh.rotation.y;
        this.botMesh.rotation.y = BABYLON.Scalar.LerpAngle(this.botMesh.rotation.y, targetRot, 0.1);

        // 2. Pickup Logic
        if (this.pickupCooldown > 0) {
            this.pickupCooldown -= dt;
        } else {
            this.scanAndCollect();
        }
    }

    scanAndCollect() {
        if (!this.botMesh) return;

        // Find all loot boxes in the scene
        const lootBoxes = this.scene.meshes.filter(m => m.name.startsWith("loot_"));

        for (let box of lootBoxes) {
            if (!box || box.isDisposed()) continue;

            const dist = BABYLON.Vector3.Distance(this.botMesh.position, box.position);
            if (dist < this.pickupRadius) {
                this.executePickup(box);
                this.pickupCooldown = 0.8; // Prevent instant vacuuming
                break;
            }
        }
    }

    executePickup(box) {
        console.log("🤖 [BOT] Collecting loot: " + (box.itemType || "Unknown"));

        // Visual Beam
        const points = [
            this.botMesh.position.clone(),
            box.position.clone()
        ];
        const beam = BABYLON.MeshBuilder.CreateLines("bot_beam", { points: points }, this.scene);
        beam.color = new BABYLON.Color3(0, 0.8, 1);

        // Quick fade/dispose
        setTimeout(() => beam.dispose(), 300);

        // Notify MobManager to pickup (if it has the method) or handle directly
        if (this.mobs && this.mobs.collectLoot) {
            this.mobs.collectLoot(box);
        } else {
            // Fallback direct pickup
            if (box.itemType) {
                this.dotNetHelper.invokeMethodAsync('OnItemPickedUp', box.itemType);
            }
            box.dispose();
        }

        // Particle FX at bot
        if (window.Scrapper3000) {
            window.Scrapper3000.createParticleSystem("spark", this.botMesh.position);
        }
    }
}

window.BotManager = BotManager;
