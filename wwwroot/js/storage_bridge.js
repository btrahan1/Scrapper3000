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

    savePlayerState: async function (stateJson, slotId = 1) {
        const key = `scrapper3000_save_${slotId}`;
        if (this.storageMode === "local") {
            try {
                localStorage.setItem(key, stateJson);
                console.log(`Player state saved to LocalStorage slot ${slotId}.`);
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
            const docId = `${this.playerId}_slot_${slotId}`;
            await this.db.collection("players").doc(docId).set({
                ...state,
                slotId: slotId,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Player state saved to Firestore slot ${slotId}.`);
        } catch (e) {
            console.error("Error saving to Firestore:", e);
        }
    },

    deletePlayerState: async function (slotId) {
        const key = `scrapper3000_save_${slotId}`;
        if (this.storageMode === "local") {
            try {
                localStorage.removeItem(key);
                console.log(`Player state deleted from LocalStorage slot ${slotId}.`);
            } catch (e) {
                console.error("Error deleting from LocalStorage:", e);
            }
            return;
        }

        if (!this.db) {
            console.warn("Firestore not available, deleting local only.");
            localStorage.removeItem(key);
            return;
        }

        try {
            const docId = `${this.playerId}_slot_${slotId}`;
            await this.db.collection("players").doc(docId).delete();
            console.log(`Player state deleted from Firestore slot ${slotId}.`);
        } catch (e) {
            console.error("Error deleting from Firestore:", e);
        }
    },

    loadPlayerState: async function (dotNetHelper, slotId = 1) {
        const key = `scrapper3000_save_${slotId}`;
        if (this.storageMode === "local") {
            try {
                const saved = localStorage.getItem(key);
                if (saved) {
                    console.log(`Player state loaded from LocalStorage slot ${slotId}.`);
                    dotNetHelper.invokeMethodAsync('OnPlayerStateLoaded', saved);
                } else {
                    console.log(`No LocalStorage save found in slot ${slotId}.`);
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
            const saved = localStorage.getItem(key);
            dotNetHelper.invokeMethodAsync('OnPlayerStateLoaded', saved || null);
            return;
        }

        try {
            const docId = `${this.playerId}_slot_${slotId}`;
            const doc = await this.db.collection("players").doc(docId).get();
            if (doc.exists) {
                const data = doc.data();
                delete data.lastUpdated;
                dotNetHelper.invokeMethodAsync('OnPlayerStateLoaded', JSON.stringify(data));
                console.log(`Player state loaded from Firestore slot ${slotId}.`);
            } else {
                console.log(`No cloud save found in slot ${slotId}.`);
                dotNetHelper.invokeMethodAsync('OnPlayerStateLoaded', null);
            }
        } catch (e) {
            console.error("Error loading from Firestore:", e);
            dotNetHelper.invokeMethodAsync('OnPlayerStateLoaded', null);
        }
    },

    getAvailableSlots: async function (dotNetHelper) {
        const slots = [];
        for (let i = 1; i <= 5; i++) {
            let data = null;
            if (this.storageMode === "local") {
                const saved = localStorage.getItem(`scrapper3000_save_${i}`);
                if (saved) data = JSON.parse(saved);
            } else if (this.db) {
                const docId = `${this.playerId}_slot_${i}`;
                const doc = await this.db.collection("players").doc(docId).get();
                if (doc.exists) data = doc.data();
            }

            if (data) {
                slots.push({
                    slotId: i,
                    playerName: data.playerName || data.PlayerName,
                    level: data.level || data.Level,
                    gender: data.gender || data.Gender,
                    hp: data.hp || data.HP,
                    maxHp: data.maxHp || data.MaxHP,
                    lastUpdated: data.lastUpdated || null
                });
            } else {
                slots.push({ slotId: i, isEmpty: true });
            }
        }
        dotNetHelper.invokeMethodAsync('OnSlotsLoaded', JSON.stringify(slots));
    }
};
