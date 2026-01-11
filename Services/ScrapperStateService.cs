using System;
using System.Collections.Generic;

namespace Scrapper3000.Services
{
    public class ScrapperStateService
    {
        public event Action OnUIChange;

        // --- Core Stats ---
        public int Credits { get; private set; } = 0;
        public int HP { get; private set; } = 100;
        public int MaxHP { get; private set; } = 100;

        // --- View State ---
        public bool IsFirstPerson { get; private set; } = true;
        public bool IntroComplete { get; private set; } = false;
        public bool IsCustomizing { get; private set; } = false;
        public string DialogueText { get; private set; } = "Welcome scrapper, I see you could use a few things...";

        // --- Customization ---
        public string Gender { get; private set; } = "Male"; // Male, Female
        public float HairLength { get; private set; } = 0.5f; // 0 to 1
        public string HairColor { get; private set; } = "#4b301a"; // Dark Brown
        public string PlayerName { get; private set; } = "Scrapper";
        public bool IsNaming { get; private set; } = false;

        // --- Equipment ---
        public bool HasBackpack { get; private set; } = false;
        public bool HasOveralls { get; private set; } = false;
        public bool HasStick { get; private set; } = false;

        // --- Inventory ---
        public Dictionary<string, int> Inventory { get; private set; } = new()
        {
            { "Rubber", 0 },
            { "Plastic", 0 },
            { "Wood", 0 },
            { "Cloth", 0 },
            { "Metal", 0 }
        };

        public void AddCredits(int amount)
        {
            Credits += amount;
            NotifyUIChange();
        }

        public void SetDialogue(string text)
        {
            DialogueText = text;
            NotifyUIChange();
        }

        public void EquipItem(string item)
        {
            switch (item.ToLower())
            {
                case "backpack": HasBackpack = true; break;
                case "overalls": HasOveralls = true; break;
                case "stick": HasStick = true; break;
            }

            int count = (HasBackpack ? 1 : 0) + (HasOveralls ? 1 : 0) + (HasStick ? 1 : 0);

            if (count == 1) SetDialogue("Good. Now grab the others.");
            else if (count == 2) SetDialogue("Almost there. One more thing left.");
            else if (count == 3)
            {
                IsCustomizing = true;
                SetDialogue("So, let's have a look at you! Use that mirror and fix yourself up.");
            }
            
            NotifyUIChange();
            SaveState();
        }

        public void UpdateCustomization(string gender, float hairLength, string hairColor)
        {
            Gender = gender;
            HairLength = hairLength;
            HairColor = hairColor;
            NotifyUIChange();
        }

        public void CompleteCustomization()
        {
            IsCustomizing = false;
            IntroComplete = true;
            IsFirstPerson = false;
            IsNaming = true; // Trigger name prompt after exiting shed
            NotifyUIChange();
            SaveState();
        }

        public void SetPlayerName(string name)
        {
            if (!string.IsNullOrWhiteSpace(name))
            {
                PlayerName = name;
                IsNaming = false;
                NotifyUIChange();
                SaveState();
            }
        }

        public void AddInventory(string material, int amount)
        {
            if (Inventory.ContainsKey(material))
            {
                Inventory[material] += amount;
                NotifyUIChange();
                SaveState();
            }
        }

        public string GetSerializedState()
        {
            return System.Text.Json.JsonSerializer.Serialize(new
            {
                credits = Credits,
                hp = HP,
                maxHp = MaxHP,
                hasBackpack = HasBackpack,
                hasOveralls = HasOveralls,
                hasStick = HasStick,
                introComplete = IntroComplete,
                inventory = Inventory,
                gender = Gender,
                hairLength = HairLength,
                hairColor = HairColor,
                playerName = PlayerName
            });
        }

        public void LoadFromState(string stateJson)
        {
            try
            {
                var options = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var state = System.Text.Json.JsonSerializer.Deserialize<ScrapperData>(stateJson, options);
                if (state != null)
                {
                    Credits = state.Credits;
                    HP = state.Hp;
                    MaxHP = state.MaxHp;
                    HasBackpack = state.HasBackpack;
                    HasOveralls = state.HasOveralls;
                    HasStick = state.HasStick;
                    IntroComplete = state.IntroComplete;
                    Inventory = state.Inventory ?? Inventory;
                    Gender = state.Gender ?? Gender;
                    HairLength = state.HairLength;
                    HairColor = state.HairColor ?? HairColor;
                    PlayerName = state.PlayerName ?? PlayerName;

                    // If they are outside but haven't named themselves, show the dialog
                    if (IntroComplete && PlayerName == "Scrapper")
                    {
                        IsNaming = true;
                    }

                    NotifyUIChange();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error parsing state: " + ex.Message);
            }
        }

        private void SaveState()
        {
            // This will be called by UI components to trigger JS bridge
        }

        private void NotifyUIChange() => OnUIChange?.Invoke();

        private class ScrapperData
        {
            public int Credits { get; set; }
            public int Hp { get; set; }
            public int MaxHp { get; set; }
            public bool HasBackpack { get; set; }
            public bool HasOveralls { get; set; }
            public bool HasStick { get; set; }
            public bool IntroComplete { get; set; }
            public string Gender { get; set; }
            public float HairLength { get; set; }
            public string HairColor { get; set; }
            public string PlayerName { get; set; }
            public Dictionary<string, int> Inventory { get; set; }
        }
    }
}
