class AssetManager {
    constructor(scene) {
        this.scene = scene;
    }

    async loadModel(path) {
        try {
            console.log("AssetManager: Loading " + path);
            const response = await fetch(path);
            if (!response.ok) throw new Error("File not found: " + path);

            const data = await response.json();
            return this.buildFromJSON(data);
        } catch (e) {
            console.error("Asset Load Error:", path, e);
            return null;
        }
    }

    buildFromJSON(data) {
        // Handle "Parts" array (complex models) or single root
        const parts = data.Parts || data.parts;
        const name = data.Name || data.name || "Model";
        let root;
        let meshMap = {};

        if (parts) {
            // 1. Create container
            root = new BABYLON.Mesh(name, this.scene);
            root.isPickable = false; // CONTAINER SHOULD NEVER BLOCK CHILDREN 🛡️

            // 2. Create all parts
            parts.forEach(part => {
                let mesh = this.createPrimitive(part);
                const id = part.Id || part.id || part.name;
                meshMap[id] = mesh;
                mesh.parent = root; // Default to root
            });

            // 3. Re-parent based on hierarchy
            parts.forEach(part => {
                const id = part.Id || part.id || part.name;
                const parentId = part.ParentId || part.parentId;

                if (parentId && meshMap[parentId]) {
                    meshMap[id].parent = meshMap[parentId];
                }
            });
        } else {
            // Single Primitive
            root = this.createPrimitive(data);
        }

        // Attach Metadata
        if (data.Timeline) root.timeline = data.Timeline;
        if (data.Stats) {
            root.stats = JSON.parse(JSON.stringify(data.Stats)); // Deep copy
            if (root.stats.HP && !root.stats.maxHP) root.stats.maxHP = root.stats.HP;
        }

        return root;
    }

    createPrimitive(data) {
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

        // Emissive check
        if (data.Material === "Glow" || data.material === "Glow") {
            mat.emissiveColor = mat.diffuseColor;
            mat.useAlphaFromDiffuseTexture = true;
        }

        // Geometry Construction
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
            default:
                // Fallback to box
                mesh = BABYLON.MeshBuilder.CreateBox(name, { size: 1 }, this.scene);
                break;
        }

        // Transform
        if (data.Position) {
            mesh.position = new BABYLON.Vector3(data.Position[0], data.Position[1], data.Position[2]);
        } else if (data.position) {
            mesh.position = new BABYLON.Vector3(data.position.x, data.position.y, data.position.z);
        }

        if (data.Rotation) {
            const toRad = Math.PI / 180;
            mesh.rotation = new BABYLON.Vector3(data.Rotation[0] * toRad, data.Rotation[1] * toRad, data.Rotation[2] * toRad);
        } else if (data.rotation) {
            mesh.rotation = new BABYLON.Vector3(data.rotation.x, data.rotation.y, data.rotation.z);
        }

        mesh.material = mat;

        // GLOBAL RULE: Disable Physics on Model primitives to prevent "Baron Munchausen" bug
        // Specific entities (like Mobs/Scrap) will override this to TRUE in their managers.
        mesh.checkCollisions = false;
        mesh.isPickable = false;

        return mesh;
    }

    hexToColor(hex) {
        if (!hex || hex.length < 7) return BABYLON.Color3.White();
        var r = parseInt(hex.slice(1, 3), 16) / 255;
        var g = parseInt(hex.slice(3, 5), 16) / 255;
        var b = parseInt(hex.slice(5, 7), 16) / 255;
        return new BABYLON.Color3(r, g, b);
    }
}
window.AssetManager = AssetManager;
