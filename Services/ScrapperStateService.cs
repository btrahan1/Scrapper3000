using System;
using System.Collections.Generic;
using Microsoft.JSInterop;

namespace Scrapper3000.Services
{
    public class ScrapperStateService
    {
        public event Action? OnStateChanged; // Triggers Save
        public event Action? OnEquipmentChanged;
        public event Action OnVisualUpdate; // Triggers Re-render only
        public event Action OnRespawnTriggered; // Triggers JS Respawn
        public event Action OnPlayerDied; // Triggers JS Death Anim
        public event Action OnSlotsLoadedEvt; // For UI refresh

        // --- Core Stats ---
        public int Level { get; private set; } = 1;
        public int CurrentExp { get; private set; } = 0;
        public int NextLevelExp { get; private set; } = 100;

        public int Credits { get; private set; } = 0;
        public int HP { get; private set; } = 100;
        public int MaxHP { get; private set; } = 100;
        public int AttackPower { get; private set; } = 10;
        public int Defense { get; private set; } = 5;
        
        // Multi-Slot Equipment System
        public Dictionary<string, string> EquippedSlots { get; private set; } = new()
        {
            { "Weapon", "Rusty Stick" },
            { "Head", "None" },
            { "Chest", "Basic Overalls" },
            { "Legs", "None" },
            { "Feet", "None" },
            { "Arms", "None" },
            { "Gloves", "None" },
            { "Bot", "None" }
        };

        // --- View State ---
        public bool IsFirstPerson { get; private set; } = true;
        public bool IntroComplete { get; private set; } = false;
        public bool IsCustomizing { get; private set; } = false;
        public string DialogueText { get; private set; } = "";

        // --- Customization ---
        public string Gender { get; private set; } = "Male"; // Male, Female
        public float HairLength { get; private set; } = 0.5f; // 0 to 1
        public string HairColor { get; private set; } = "#4b301a"; // Dark Brown
        public string SkinColor { get; private set; } = "#bd9a7a"; // Default Skin
        public string PlayerName { get; private set; } = "Scrapper";
        public bool IsNaming { get; private set; } = false;
        public bool IsShopOpen { get; private set; } = false;
        public bool IsLandingPage { get; private set; } = false;
        public bool IsLoading { get; private set; } = true;
        public bool HasExistingSave { get; private set; } = false;
        public bool IsPaused { get; private set; } = false;
        public bool IsDead { get; private set; } = false;
        public int SelectedSlotId { get; private set; } = 1;
        public bool IsSelectingSlot { get; private set; } = false;

        // --- Equipment ---
        public bool HasBackpack { get; private set; } = false;
        public bool HasOveralls { get; private set; } = false;
        public bool HasStick { get; private set; } = false;

        public Dictionary<string, int> Inventory { get; private set; } = new()
        {
            { "Rubber", 0 },
            { "Plastic", 0 },
            { "Wood", 0 },
            { "Cloth", 0 },
            { "Metal", 0 }
        };

        public Dictionary<string, int> MaterialPrices { get; private set; } = new()
        {
            { "Rubber", 5 },
            { "Plastic", 8 },
            { "Wood", 10 },
            { "Cloth", 12 },
            { "Metal", 25 }
        };

        public record ShopItem(string Name, int Price, string Type, int Value, string Description, string Slot = "Weapon", string ColorHex = "#808080", bool UseModel = false);
        public List<ShopItem> AvailableGear { get; private set; } = new()
        {
            // Starting items
            new ShopItem("Rusty Stick", 0, "weapon", 0, "Your trusty starting weapon.", "Weapon", "#ffffff", true),
            new ShopItem("Basic Overalls", 0, "armor", 5, "Basic protection for scrappers.", "Chest", "#5d7687", false),
            
            // Weapons (UseModel = true)
            new ShopItem("Spiked Stick", 150, "weapon", 3, "A stick with some nasty nails in it.", "Weapon", "#ffffff", true),
            new ShopItem("Metal Pipe", 400, "weapon", 6, "Heavy, cold, and very effective.", "Weapon", "#ffffff", true),
            new ShopItem("Heavy Spiked Mace", 800, "weapon", 15, "A brutal masterpiece of scrap engineering.", "Weapon", "#ffffff", true),
            new ShopItem("Wicked Pipe Weapon", 1200, "weapon", 20, "Jagged, spiked, and utterly lethal.", "Weapon", "#ffffff", true),
            new ShopItem("Heavy Rebar", 1000, "weapon", 12, "Concrete-shattering power.", "Weapon", "#ffffff", true),
            
            // Bots
            new ShopItem("ScavengerBot MK4", 2500, "bot", 1, "A high-fidelity scavenging assistant.", "Bot", "#ffffff", true),

            // Armor - Chest
            new ShopItem("Reinforced Overalls", 200, "armor", 8, "Stitched with scrap leather.", "Chest", "#4a3c31", false),
            new ShopItem("Dusty Faded Overalls", 75, "armor", 2, "Well-worn but reliable. Has knee pads.", "Chest", "#5d7687", false),
            new ShopItem("Scrap Plate Vest", 600, "armor", 20, "Literal metal plates strapped to your chest.", "Chest", "#a1a1a1", false),
            new ShopItem("Simple Leather Vest", 400, "armor", 15, "Tough leather vest. Stylish too.", "Chest", "#5c4033", false),
            
            // Armor - Head (UseModel = true)
            new ShopItem("Vintage Leather Helmet", 350, "armor", 10, "Classic protection. Keeps your ears warm.", "Head", "#4a332a", true),
            
            // Armor - Others (Texture-based)
            new ShopItem("Simple Leather Boots", 250, "armor", 5, "Good treads. Better than barefoot.", "Feet", "#5c4033", false),
            new ShopItem("Simple Leather Gloves", 300, "armor", 5, "Better grip, fewer splinters.", "Gloves", "#4a3b2a", false),
            new ShopItem("Simple Leather Leggings", 350, "armor", 10, "Pants! Finally!", "Legs", "#262626", false),
            new ShopItem("Simple Leather Sleeves", 250, "armor", 8, "Coverage for your arms.", "Arms", "#4a3c31", false)
        };
        
        public record SaveSlotSummary(int SlotId, string PlayerName, int Level, string Gender, int HP, int MaxHP, bool IsEmpty = false);
        public List<SaveSlotSummary> AvailableSlots { get; private set; } = new();
        
        public List<string> OwnedGear { get; private set; } = new() { "Rusty Stick", "Basic Overalls" };

        [JSInvokable]
        public void AddExperience(int amount)
        {
            CurrentExp += amount;
            if (CurrentExp >= NextLevelExp)
            {
                LevelUp();
            }
            else
            {
                NotifyVisualChange(); // Just update bar
            }
        }

        private void LevelUp()
        {
            // Carry over excess EXP
            CurrentExp -= NextLevelExp;
            Level++;
            
            // Geometric Curve: Level 1=100, Level 2=200, Level 3=300...
            NextLevelExp = Level * 100;

            // Stat Boosts (HP+10, ATK+2, DEF+1)
            MaxHP += 10;
            HP = MaxHP; // Full Heal
            
            CalculateStats(); // Updates ATK/DEF based on new Level

            SetDialogue($"LEVEL UP! You are now Level {Level}. (HP+10, ATK+2, DEF+1)");
            NotifyStateChange();
        }

        public void AddCredits(int amount)
        {
            Credits += amount;
            NotifyStateChange();
        }

        [JSInvokable]
        public void TakeDamage(int rawDamage)
        {
            if (HP <= 0 || IsDead) return;

            // Damage is pre-calculated by the caller (MobManager.js) to match visual numbers
            // We just apply the final amount.
            HP = Math.Max(0, HP - Math.Max(1, rawDamage));
            
            if (HP <= 0)
            {
                HP = 0;
                IsDead = true;
                SetDialogue("CRITICAL FAILURE. Systems offline.");
                NotifyStateChange();
                OnPlayerDied?.Invoke(); // Trigger death animation
            }
            else
            {
                NotifyStateChange();
            }
        }

        public void Respawn()
        {
            if (!IsDead) return;

            int revivalCost = 50;
            int costPaid = 0;

            if (Credits >= revivalCost)
            {
                Credits -= revivalCost;
                costPaid = revivalCost;
                SetDialogue($"Revival complete. Service fee: {revivalCost} Credits.");
            }
            else if (Credits > 0)
            {
                costPaid = Credits;
                Credits = 0;
                SetDialogue($"Revival complete. You were drained of your last {costPaid} Credits.");
            }
            else
            {
                SetDialogue("Revival complete. Pro bono service provided for destitute scrapper.");
            }

            HP = MaxHP;
            IsDead = false;
            NotifyStateChange();
            OnRespawnTriggered?.Invoke();
        }

        [JSInvokable]
        public void OnSlotsLoaded(string json)
        {
            try {
                var slots = System.Text.Json.JsonSerializer.Deserialize<List<SaveSlotSummary>>(json, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (slots != null)
                {
                    AvailableSlots = slots;
                    OnSlotsLoadedEvt?.Invoke();
                    NotifyVisualChange();
                }
            } catch (Exception ex) {
                Console.WriteLine("[C#] Error parsing slots: " + ex.Message);
            }
        }

        public void SelectSlot(int slotId)
        {
            SelectedSlotId = slotId;
            IsSelectingSlot = false;
            NotifyVisualChange();
        }

        public void ShowSlotSelection()
        {
            IsSelectingSlot = true;
            IsLandingPage = false;
            NotifyVisualChange();
        }

        [JSInvokable]
        public void LoadingFinished()
        {
            IsLoading = false;
            IsLandingPage = true;
            DialogueText = "Sifting through the scrap... System online.";
            NotifyVisualChange();
        }

        [JSInvokable]
        public void SetDialogue(string text)
        {
            if (DialogueText == text) return;
            DialogueText = text;
            NotifyVisualChange();
        }

        public void EquipItem(string item)
        {
            switch (item.ToLower())
            {
                case "backpack": HasBackpack = true; break;
                case "overalls": HasOveralls = true; break;
                case "stick": HasStick = true; break;
            }

            CalculateStats();

            int count = (HasBackpack ? 1 : 0) + (HasOveralls ? 1 : 0) + (HasStick ? 1 : 0);

            if (count == 1) SetDialogue("Good. Now grab the others.");
            else if (count == 2) SetDialogue("Almost there. One more thing left.");
            else if (count == 3)
            {
                IsCustomizing = true;
                SetDialogue("So, let's have a look at you! Use that mirror and fix yourself up.");
            }
            
            NotifyStateChange();
        }

        public void UpdateCustomization(string gender, float hairLength, string hairColor)
        {
            Gender = gender;
            HairLength = hairLength;
            HairColor = hairColor;
            NotifyVisualChange(); // Visual only until confirmed
        }

        public void CompleteCustomization()
        {
            IsCustomizing = false;
            IntroComplete = true;
            IsFirstPerson = false;
            IsNaming = true; // Trigger name prompt after exiting shed
            NotifyStateChange();
        }

        [JSInvokable]
        public void HealPlayer()
        {
            if (HP >= MaxHP)
            {
                SetDialogue("The medic looks at you. 'You're already in top shape, scrapper! Move along.'");
                return;
            }

            int missingHP = MaxHP - HP;
            int totalCost = missingHP; // 1 credit per HP

            if (Credits >= totalCost)
            {
                Credits -= totalCost;
                HP = MaxHP;
                SetDialogue($"The medic patches you up. You feel revitalized! (-{totalCost} Credits)");
                NotifyStateChange();
            }
            else
            {
                // Partial heal if they have some credits but not enough for full
                if (Credits > 0)
                {
                    int healAmount = Credits;
                    Credits = 0;
                    HP += healAmount;
                    SetDialogue($"The medic does what they can with your meager stash. (+{healAmount} HP)");
                    NotifyStateChange();
                }
                else
                {
                    SetDialogue("The medic sighs. 'No credits, no patch-up. This isn't a charity.'");
                }
            }
        }

        public void StartNewGame()
        {
            // Reset gameplay state but keep customization if desired (or reset all)
            Credits = 0;
            Level = 1;
            CurrentExp = 0;
            NextLevelExp = 100;
            MaxHP = 100;
            HP = 100;
            Inventory = new Dictionary<string, int> { { "Rubber", 0 }, { "Plastic", 0 }, { "Wood", 0 }, { "Cloth", 0 }, { "Metal", 0 } };
            HasBackpack = false;
            HasOveralls = false;
            HasStick = false;
            IntroComplete = false;
            IsFirstPerson = true;
            IsLandingPage = false;
            PlayerName = "Scrapper";
            DialogueText = "You wake up in a dim shed. The smell of rust and old oil is thick in the air. Time to get to work.";
            NotifyStateChange();
        }

        public void ContinueGame()
        {
            IsLandingPage = false;
            IsPaused = false;
            NotifyVisualChange();
        }

        public void TogglePause()
        {
            if (IsLoading || IsLandingPage || IsCustomizing || IsNaming) return;
            IsPaused = !IsPaused;
            NotifyVisualChange();
        }

        public void ExitGame()
        {
            IsPaused = false;
            IsLandingPage = true;
            NotifyVisualChange();
        }

        public void SetPlayerName(string name)
        {
            if (!string.IsNullOrWhiteSpace(name))
            {
                PlayerName = name;
                IsNaming = false;
                NotifyStateChange();
            }
        }

        public void AddInventory(string material, int amount)
        {
            if (Inventory.ContainsKey(material))
            {
                Inventory[material] += amount;
                NotifyStateChange();
            }
        }

        public void SellItem(string itemName)
        {
            if (Inventory.ContainsKey(itemName) && Inventory[itemName] > 0)
            {
                Inventory[itemName]--;
                Credits += MaterialPrices[itemName];
                NotifyStateChange();
                SetDialogue($"Sold 1 {itemName}. Quick credits!");
            }
        }

        public void SellAll(string itemName)
        {
            if (Inventory.ContainsKey(itemName) && Inventory[itemName] > 0)
            {
                int count = Inventory[itemName];
                int totalValue = count * MaterialPrices[itemName];
                Credits += totalValue;
                Inventory[itemName] = 0;
                NotifyStateChange();
                SetDialogue($"Sold {count} {itemName} for {totalValue} credits!");
            }
        }

        public void OpenShop()
        {
            if (IsShopOpen) return;
            IsShopOpen = true;
            NotifyVisualChange();
        }

        public void CloseShop()
        {
            if (!IsShopOpen) return;
            IsShopOpen = false;
            NotifyVisualChange();
        }

        public void BuyItem(string itemName)
        {
            var item = AvailableGear.Find(i => i.Name == itemName);
            if (item != null && Credits >= item.Price && !OwnedGear.Contains(item.Name))
            {
                Credits -= item.Price;
                OwnedGear.Add(item.Name);
                
                // Auto-equip if slot is empty or it's a weapon
                if (item.Slot != "None" && (EquippedSlots[item.Slot] == "None" || item.Type == "weapon"))
                {
                    EquipItem(item.Name, item.Slot);
                }

                CalculateStats();
                NotifyStateChange();
                SetDialogue($"Bought {item.Name}! Stay safe out there.");
            }
        }

        public void EquipItem(string itemName, string slot)
        {
            if (!EquippedSlots.ContainsKey(slot)) return;
            if (!OwnedGear.Contains(itemName)) return;
            
            EquippedSlots[slot] = itemName;
            CalculateStats();
            OnEquipmentChanged?.Invoke();
            NotifyStateChange();
        }

        public void UnequipSlot(string slot)
        {
            if (!EquippedSlots.ContainsKey(slot)) return;
            EquippedSlots[slot] = "None";
            CalculateStats();
            OnEquipmentChanged?.Invoke();
            NotifyStateChange();
        }

        [JSInvokable]
        public string GetEquippedItemsMetadata()
        {
            try 
            {
                var metadata = new Dictionary<string, ShopItem>();
                foreach (var slot in EquippedSlots)
                {
                    var item = AvailableGear.FirstOrDefault(i => i.Name == slot.Value);
                    if (item != null)
                    {
                        metadata[slot.Key] = item;
                    }
                    else
                    {
                        metadata[slot.Key] = new ShopItem("None", 0, "none", 0, "Empty slot", slot.Key, SkinColor, false);
                    }
                }
                return System.Text.Json.JsonSerializer.Serialize(metadata);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[C#] Metadata Error: {ex.Message}");
                return "{}";
            }
        }

        private void CalculateStats()
        {
            // Base stats (Scrapper defaults) + Level Scaling
            int atk = 10 + ((Level - 1) * 2);
            int def = 5 + ((Level - 1) * 1);

            // Add bonuses from equipped gear
            foreach (var slot in EquippedSlots)
            {
                if (slot.Value == "None") continue;
                var item = AvailableGear.Find(i => i.Name == slot.Value);
                if (item != null)
                {
                    if (item.Type == "weapon") atk += item.Value;
                    else if (item.Type == "armor") def += item.Value;
                }
            }

            AttackPower = atk;
            Defense = def;
        }

        public string GetSerializedState()
        {
            return System.Text.Json.JsonSerializer.Serialize(new
            {
                level = Level,
                currentExp = CurrentExp,
                nextLevelExp = NextLevelExp,
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
                playerName = PlayerName,
                skinColor = SkinColor,
                equippedSlots = EquippedSlots,
                ownedGear = OwnedGear
            });
        }

        public void LoadFromState(string? stateJson)
        {
            try
            {
                if (string.IsNullOrEmpty(stateJson))
                {
                    IsLoading = false;
                    NotifyVisualChange();
                    return;
                }

                var options = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var state = System.Text.Json.JsonSerializer.Deserialize<ScrapperData>(stateJson, options);
                if (state != null)
                {
                    Credits = state.Credits;
                    Level = state.Level > 0 ? state.Level : 1;
                    CurrentExp = state.CurrentExp;
                    NextLevelExp = state.NextLevelExp > 0 ? state.NextLevelExp : (Level * 100);
                    HP = state.Hp <= 0 ? 10 : state.Hp; // Prevent death loop on load
                    MaxHP = state.MaxHp > 0 ? state.MaxHp : (100 + ((Level - 1) * 10)); // Recalculate if missing
                    HasBackpack = state.HasBackpack;
                    HasOveralls = state.HasOveralls;
                    HasStick = state.HasStick;
                    IntroComplete = state.IntroComplete;
                    Inventory = state.Inventory ?? new Dictionary<string, int> { { "Rubber", 0 }, { "Plastic", 0 }, { "Wood", 0 }, { "Cloth", 0 }, { "Metal", 0 } };
                    Gender = state.Gender ?? Gender;
                    HairLength = state.HairLength;
                    HairColor = state.HairColor ?? HairColor;
                    SkinColor = state.SkinColor ?? SkinColor;
                    PlayerName = !string.IsNullOrEmpty(state.PlayerName) ? state.PlayerName : PlayerName;
                    
                    // Migrate old saves to new equipment system
                    if (state.EquippedSlots != null)
                    {
                        EquippedSlots = state.EquippedSlots;
                    }
                    else
                    {
                        // Legacy migration: convert old weapon/armor to new slots
                        if (!string.IsNullOrEmpty(state.EquippedWeapon))
                            EquippedSlots["Weapon"] = state.EquippedWeapon;
                        if (!string.IsNullOrEmpty(state.EquippedArmor))
                        {
                            // Determine slot based on item name
                            var armorItem = AvailableGear.Find(i => i.Name == state.EquippedArmor);
                            if (armorItem != null)
                                EquippedSlots[armorItem.Slot] = state.EquippedArmor;
                        }
                    }
                    
                    OwnedGear = state.OwnedGear ?? new List<string> { "Rusty Stick", "Basic Overalls" };

                    CalculateStats();
                    IsLoading = false;
                    if (IntroComplete && PlayerName != "Scrapper")
                    {
                        HasExistingSave = true;
                        IsLandingPage = true;
                    }
                    else if (IntroComplete && PlayerName == "Scrapper")
                    {
                        IsNaming = true;
                    }

                    NotifyVisualChange();
                }
                else
                {
                    IsLoading = false;
                    NotifyVisualChange();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error parsing state: " + ex.Message);
                IsLoading = false;
                NotifyVisualChange();
            }
        }

        private void NotifyStateChange() 
        {
            if (IsLoading) return;
            OnStateChanged?.Invoke();
            OnVisualUpdate?.Invoke();
        }

        private void NotifyVisualChange()
        {
            OnVisualUpdate?.Invoke();
        }

        private class ScrapperData
        {
            public int Level { get; set; }
            public int CurrentExp { get; set; }
            public int NextLevelExp { get; set; }
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
            public string? SkinColor { get; set; }
            public Dictionary<string, string>? EquippedSlots { get; set; }
            // Legacy fields for backward compatibility
            public string? EquippedWeapon { get; set; }
            public string? EquippedArmor { get; set; }
            public List<string> OwnedGear { get; set; }
            public Dictionary<string, int> Inventory { get; set; }
        }
    }
}
