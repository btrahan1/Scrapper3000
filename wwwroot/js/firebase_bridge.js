window.FirebaseBridge = {
    db: null,
    playerId: "player_one", // Placeholder for now

    init: function (configJson) {
        try {
            const firebaseConfig = JSON.parse(configJson);
            firebase.initializeApp(firebaseConfig);
            this.db = firebase.firestore();
            console.log("Firebase initialized successfully.");
        } catch (e) {
            console.error("Firebase init failed:", e);
        }
    },

    savePlayerState: async function (stateJson) {
        if (!this.db) return;
        const state = JSON.parse(stateJson);
        try {
            await this.db.collection("players").doc(this.playerId).set({
                ...state,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("Player state saved to Firestore.");
        } catch (e) {
            console.error("Error saving state:", e);
        }
    },

    loadPlayerState: async function (dotNetHelper) {
        if (!this.db) return;
        try {
            const doc = await this.db.collection("players").doc(this.playerId).get();
            if (doc.exists) {
                const data = doc.data();
                // Remove timestamp before sending back to Blazor
                delete data.lastUpdated;
                await dotNetHelper.invokeMethodAsync('OnPlayerStateLoaded', JSON.stringify(data));
                console.log("Player state loaded from Firestore.");
            } else {
                console.log("No player found, starting fresh.");
            }
        } catch (e) {
            console.error("Error loading state:", e);
        }
    }
};
