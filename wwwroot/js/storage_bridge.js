window.StorageBridge = {
    db: null,
    playerId: "player_one",
    storageMode: "local", // "local" or "firebase"

    setStorageMode: function (mode) {
        this.storageMode = mode;
        console.log("StorageBridge: Mode set to " + mode);
    },

    init: function (configJson) {
        try {
            const firebaseConfig = JSON.parse(configJson);
            firebase.initializeApp(firebaseConfig);
            this.db = firebase.firestore();
            console.log("Firebase initialized (available but mode may be local).");
        } catch (e) {
            console.warn("Firebase failed to init, falling back fully to local.");
            this.storageMode = "local";
        }
    },

    savePlayerState: async function (stateJson) {
        if (this.storageMode === "local") {
            try {
                localStorage.setItem("scrapper3000_save", stateJson);
                console.log("Player state saved to LocalStorage.");
            } catch (e) {
                console.error("Error saving to LocalStorage:", e);
            }
            return;
        }

        if (!this.db) {
            console.warn("Firestore not available, skipping cloud save.");
            return;
        }

        const state = JSON.parse(stateJson);
        try {
            await this.db.collection("players").doc(this.playerId).set({
                ...state,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("Player state saved to Firestore.");
        } catch (e) {
            console.error("Error saving to Firestore:", e);
        }
    },

    loadPlayerState: async function (dotNetHelper) {
        if (this.storageMode === "local") {
            try {
                const saved = localStorage.getItem("scrapper3000_save");
                if (saved) {
                    console.log("Player state loaded from LocalStorage.");
                    dotNetHelper.invokeMethodAsync('OnPlayerStateLoaded', saved);
                } else {
                    console.log("No LocalStorage save found.");
                    dotNetHelper.invokeMethodAsync('OnPlayerStateLoaded', null);
                }
            } catch (e) {
                console.error("Error loading from LocalStorage:", e);
                dotNetHelper.invokeMethodAsync('OnPlayerStateLoaded', null);
            }
            return;
        }

        if (!this.db) {
            console.warn("Firestore not available, falling back to local load.");
            const saved = localStorage.getItem("scrapper3000_save");
            dotNetHelper.invokeMethodAsync('OnPlayerStateLoaded', saved || null);
            return;
        }

        try {
            const doc = await this.db.collection("players").doc(this.playerId).get();
            if (doc.exists) {
                const data = doc.data();
                delete data.lastUpdated;
                dotNetHelper.invokeMethodAsync('OnPlayerStateLoaded', JSON.stringify(data));
                console.log("Player state loaded from Firestore.");
            } else {
                console.log("No cloud save found.");
                dotNetHelper.invokeMethodAsync('OnPlayerStateLoaded', null);
            }
        } catch (e) {
            console.error("Error loading from Firestore:", e);
            dotNetHelper.invokeMethodAsync('OnPlayerStateLoaded', null);
        }
    }
};
