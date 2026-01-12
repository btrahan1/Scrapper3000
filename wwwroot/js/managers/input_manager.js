class InputManager {
    constructor(scene, canvas) {
        this.scene = scene;
        this.canvas = canvas;
        this.keys = {};
        this.inputMap = {};
        this.leftJoystick = null;
        this.isWhackKeyDown = false;

        // Store the bound functions so we can remove them later
        this._mouseDownHandler = (e) => { if (e.button === 0) this.isWhackKeyDown = true; };
        this._mouseUpHandler = (e) => { if (e.button === 0) this.isWhackKeyDown = false; };

        this.setupInputs();
    }

    dispose() {
        console.log("InputManager disposed.");
        if (this.leftJoystick) {
            this.leftJoystick.releaseCanvas();
            this.leftJoystick = null;
        }
        if (this.gui) {
            this.gui.dispose();
            this.gui = null;
        }
        if (this.scene && this.scene.actionManager) {
            this.scene.actionManager.dispose();
        }

        window.removeEventListener("mousedown", this._mouseDownHandler);
        window.removeEventListener("mouseup", this._mouseUpHandler);

        this.keys = {};
        this.inputMap = {};
        this.scene = null;
        this.canvas = null;
    }

    setupInputs() {
        this.scene.actionManager = new BABYLON.ActionManager(this.scene);

        this.scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, (evt) => {
            this.inputMap[evt.sourceEvent.key.toLowerCase()] = evt.sourceEvent.type === "keydown";
            this.keys[evt.sourceEvent.key.toLowerCase()] = true; // Duplicate for robust checking

            // Specific Actions
            if (evt.sourceEvent.code === "Space") {
                this.isWhackKeyDown = true;
            }
        }));

        this.scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, (evt) => {
            this.inputMap[evt.sourceEvent.key.toLowerCase()] = evt.sourceEvent.type === "keydown";
            this.keys[evt.sourceEvent.key.toLowerCase()] = false;

            if (evt.sourceEvent.code === "Space") {
                this.isWhackKeyDown = false;
            }
        }));

        // Mouse Whack
        window.addEventListener("mousedown", this._mouseDownHandler);
        window.addEventListener("mouseup", this._mouseUpHandler);

        // Touch / Joystick
        const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
        if (isTouch) {
            console.log("InputManager: Touch device detected. Enabling Joystick.");
            this.gui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

            this.leftJoystick = new BABYLON.GUI.VirtualJoystick(true); // Left = true
            this.leftJoystick.setJoystickSensibility(0.02);
            BABYLON.GUI.VirtualJoystick.Canvas = this.canvas;

            // Whack Button (Right Side)
            var button = BABYLON.GUI.Button.CreateSimpleButton("btnWhack", "WHACK!");
            button.width = "120px";
            button.height = "120px";
            button.color = "white";
            button.background = "red";
            button.cornerRadius = 60;
            button.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
            button.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
            button.left = "-50px";
            button.top = "-50px";

            button.onPointerDownObservable.add(() => {
                this.isWhackKeyDown = true;
            });
            button.onPointerUpObservable.add(() => {
                this.isWhackKeyDown = false;
            });

            this.gui.addControl(button);
        }
    }

    // The Engine calls this to get simple -1 to 1 values
    getMovementInput() {
        let x = 0; // Rotation
        let y = 0; // Forward/Back

        // Keyboard mappings
        if (this.keys["a"] || this.keys["arrowleft"]) x = -1;
        if (this.keys["d"] || this.keys["arrowright"]) x = 1;
        if (this.keys["w"] || this.keys["arrowup"]) y = 1;
        if (this.keys["s"] || this.keys["arrowdown"]) y = -1;

        // Joystick Override
        if (this.leftJoystick && this.leftJoystick.pressed) {
            x = this.leftJoystick.deltaPosition.x;
            y = this.leftJoystick.deltaPosition.y;
        }
        return { x, y };
    }

    // Helper to check action keys
    isAttackPressed() {
        return this.isWhackKeyDown;
    }
}
window.InputManager = InputManager;
