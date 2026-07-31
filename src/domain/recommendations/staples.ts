import type { CardRole, Color, ThemeId } from "@/domain/types";

/**
 * Candidate pool for Suggested Additions (PRD §11).
 *
 * The MVP recommends from a curated list of widely-played Commander cards
 * rather than scraping an external recommendation dataset. Names are resolved
 * against Scryfall only when the user opens the tab, so this file stays a
 * plain, reviewable data source.
 *
 * `colorIdentity: ""` means colorless and therefore legal in every deck.
 */
export interface StapleEntry {
  name: string;
  colorIdentity: string;
  roles: CardRole[];
  manaValue: number;
  themes?: ThemeId[];
  /** Short, human-readable justification shown in the UI. */
  note: string;
}

export const STAPLES: StapleEntry[] = [
  // --- Ramp: colorless -----------------------------------------------------
  { name: "Sol Ring", colorIdentity: "", roles: ["RAMP"], manaValue: 1, note: "Fastest mana rock in the format" },
  { name: "Arcane Signet", colorIdentity: "", roles: ["RAMP", "FIXING"], manaValue: 2, note: "Two-mana rock that fixes your colours" },
  { name: "Fellwar Stone", colorIdentity: "", roles: ["RAMP", "FIXING"], manaValue: 2, note: "Cheap rock that usually fixes in multiplayer" },
  { name: "Mind Stone", colorIdentity: "", roles: ["RAMP", "CARD_DRAW"], manaValue: 2, note: "Ramps early, cashes in for a card later" },
  { name: "Thought Vessel", colorIdentity: "", roles: ["RAMP"], manaValue: 2, note: "Ramp plus no maximum hand size" },
  { name: "Commander's Sphere", colorIdentity: "", roles: ["RAMP", "FIXING", "CARD_DRAW"], manaValue: 3, note: "Fixes in any deck and replaces itself" },
  { name: "Wayfarer's Bauble", colorIdentity: "", roles: ["RAMP", "FIXING"], manaValue: 1, note: "Land ramp in any colour identity" },
  { name: "Solemn Simulacrum", colorIdentity: "", roles: ["RAMP", "FIXING", "CARD_DRAW"], manaValue: 4, note: "Ramps, blocks and draws a card on death" },
  { name: "Burnished Hart", colorIdentity: "", roles: ["RAMP", "FIXING"], manaValue: 3, note: "Colourless two-land ramp" },

  // --- Ramp: green ---------------------------------------------------------
  { name: "Cultivate", colorIdentity: "G", roles: ["RAMP", "FIXING"], manaValue: 3, note: "Ramps and fixes at the same time" },
  { name: "Kodama's Reach", colorIdentity: "G", roles: ["RAMP", "FIXING"], manaValue: 3, note: "Functional copy of Cultivate for redundancy" },
  { name: "Nature's Lore", colorIdentity: "G", roles: ["RAMP", "FIXING"], manaValue: 2, note: "Untapped dual land on turn two" },
  { name: "Three Visits", colorIdentity: "G", roles: ["RAMP", "FIXING"], manaValue: 2, note: "Second copy of Nature's Lore" },
  { name: "Farseek", colorIdentity: "G", roles: ["RAMP", "FIXING"], manaValue: 2, note: "Fetches non-basic duals" },
  { name: "Rampant Growth", colorIdentity: "G", roles: ["RAMP", "FIXING"], manaValue: 2, note: "Cheapest reliable land ramp" },
  { name: "Sakura-Tribe Elder", colorIdentity: "G", roles: ["RAMP", "FIXING"], manaValue: 2, themes: ["SACRIFICE"], note: "Blocks once, then ramps" },
  { name: "Birds of Paradise", colorIdentity: "G", roles: ["RAMP", "FIXING"], manaValue: 1, note: "Turn-one mana in every colour" },
  { name: "Llanowar Elves", colorIdentity: "G", roles: ["RAMP"], manaValue: 1, note: "Turn-one acceleration" },
  { name: "Wood Elves", colorIdentity: "G", roles: ["RAMP", "FIXING"], manaValue: 3, themes: ["BLINK"], note: "Fetches a Forest onto the battlefield" },
  { name: "Skyshroud Claim", colorIdentity: "G", roles: ["RAMP", "FIXING"], manaValue: 4, note: "Two untapped lands at once" },
  { name: "Explosive Vegetation", colorIdentity: "G", roles: ["RAMP", "FIXING"], manaValue: 4, note: "Double land ramp" },

  // --- Card advantage ------------------------------------------------------
  { name: "Rhystic Study", colorIdentity: "U", roles: ["CARD_DRAW"], manaValue: 3, note: "Taxes every opponent's spell into cards" },
  { name: "Mystic Remora", colorIdentity: "U", roles: ["CARD_DRAW"], manaValue: 1, note: "Draws several cards in the early turns" },
  { name: "Phyrexian Arena", colorIdentity: "B", roles: ["CARD_DRAW"], manaValue: 3, note: "An extra card every turn" },
  { name: "Night's Whisper", colorIdentity: "B", roles: ["CARD_DRAW"], manaValue: 2, note: "Cheap two-for-one" },
  { name: "Read the Bones", colorIdentity: "B", roles: ["CARD_DRAW"], manaValue: 3, note: "Digs deep and filters" },
  { name: "Painful Truths", colorIdentity: "B", roles: ["CARD_DRAW"], manaValue: 3, note: "Three cards in a multicolour deck" },
  { name: "Esper Sentinel", colorIdentity: "W", roles: ["CARD_DRAW"], manaValue: 1, note: "White's answer to Rhystic Study" },
  { name: "Welcoming Vampire", colorIdentity: "W", roles: ["CARD_DRAW"], manaValue: 3, themes: ["TOKENS", "GO_WIDE"], note: "Draws whenever a small creature arrives" },
  { name: "Harmonize", colorIdentity: "G", roles: ["CARD_DRAW"], manaValue: 4, note: "Straightforward three cards" },
  { name: "Beast Whisperer", colorIdentity: "G", roles: ["CARD_DRAW", "VALUE_ENGINE"], manaValue: 4, note: "A card for every creature you cast" },
  { name: "Guardian Project", colorIdentity: "G", roles: ["CARD_DRAW", "VALUE_ENGINE"], manaValue: 4, note: "Refills on every non-token creature" },
  { name: "Return of the Wildspeaker", colorIdentity: "G", roles: ["CARD_DRAW"], manaValue: 5, themes: ["BIG_CREATURES"], note: "Huge draw in a creature deck" },
  { name: "Skullclamp", colorIdentity: "", roles: ["CARD_DRAW"], manaValue: 1, themes: ["TOKENS", "SACRIFICE"], note: "Turns small creatures into two cards each" },
  { name: "Mind's Eye", colorIdentity: "", roles: ["CARD_DRAW"], manaValue: 5, note: "Colourless repeatable draw" },
  { name: "Endless Atlas", colorIdentity: "", roles: ["CARD_DRAW"], manaValue: 3, note: "Repeatable draw for mostly mono-coloured decks" },
  { name: "Deadly Dispute", colorIdentity: "B", roles: ["CARD_DRAW"], manaValue: 2, themes: ["SACRIFICE", "TREASURE"], note: "Cheap draw that wants a sacrifice" },
  { name: "Village Rites", colorIdentity: "B", roles: ["CARD_DRAW"], manaValue: 1, themes: ["SACRIFICE"], note: "Instant-speed draw off a dying creature" },
  { name: "Fact or Fiction", colorIdentity: "U", roles: ["CARD_DRAW"], manaValue: 4, note: "Instant-speed card advantage" },
  { name: "Midnight Clock", colorIdentity: "U", roles: ["RAMP", "CARD_DRAW"], manaValue: 3, note: "Ramps early and refills your hand later" },

  // --- Spot removal --------------------------------------------------------
  { name: "Swords to Plowshares", colorIdentity: "W", roles: ["SPOT_REMOVAL"], manaValue: 1, note: "The most efficient removal spell in white" },
  { name: "Path to Exile", colorIdentity: "W", roles: ["SPOT_REMOVAL"], manaValue: 1, note: "One-mana instant-speed exile" },
  { name: "Generous Gift", colorIdentity: "W", roles: ["SPOT_REMOVAL"], manaValue: 3, note: "Answers literally any permanent" },
  { name: "Beast Within", colorIdentity: "G", roles: ["SPOT_REMOVAL"], manaValue: 3, note: "Green's catch-all answer" },
  { name: "Chaos Warp", colorIdentity: "R", roles: ["SPOT_REMOVAL"], manaValue: 3, note: "Red's only clean answer to enchantments" },
  { name: "Go for the Throat", colorIdentity: "B", roles: ["SPOT_REMOVAL"], manaValue: 2, note: "Cheap instant-speed creature removal" },
  { name: "Infernal Grasp", colorIdentity: "B", roles: ["SPOT_REMOVAL"], manaValue: 2, note: "Unconditional two-mana kill spell" },
  { name: "Anguished Unmaking", colorIdentity: "WB", roles: ["SPOT_REMOVAL"], manaValue: 3, note: "Instant-speed exile for any nonland permanent" },
  { name: "Assassin's Trophy", colorIdentity: "BG", roles: ["SPOT_REMOVAL"], manaValue: 2, note: "Two-mana answer to anything" },
  { name: "Putrefy", colorIdentity: "BG", roles: ["SPOT_REMOVAL"], manaValue: 3, note: "Creature or artifact, no regeneration" },
  { name: "Bedevil", colorIdentity: "BR", roles: ["SPOT_REMOVAL"], manaValue: 3, note: "Hits creatures, artifacts and planeswalkers" },
  { name: "Pongify", colorIdentity: "U", roles: ["SPOT_REMOVAL"], manaValue: 1, note: "Blue's cheapest creature answer" },
  { name: "Rapid Hybridization", colorIdentity: "U", roles: ["SPOT_REMOVAL"], manaValue: 1, note: "Second copy of Pongify" },
  { name: "Cyclonic Rift", colorIdentity: "U", roles: ["SPOT_REMOVAL", "BOARD_WIPE"], manaValue: 2, note: "One-sided reset that often ends the game" },
  { name: "Krosan Grip", colorIdentity: "G", roles: ["SPOT_REMOVAL"], manaValue: 3, note: "Split second artifact and enchantment removal" },
  { name: "Nature's Claim", colorIdentity: "G", roles: ["SPOT_REMOVAL"], manaValue: 1, note: "One mana for any artifact or enchantment" },
  { name: "Return to Dust", colorIdentity: "W", roles: ["SPOT_REMOVAL"], manaValue: 4, note: "Two-for-one artifact and enchantment exile" },
  { name: "Vandalblast", colorIdentity: "R", roles: ["SPOT_REMOVAL", "BOARD_WIPE"], manaValue: 1, themes: ["ARTIFACTS"], note: "One-sided artifact wipe when overloaded" },

  // --- Board wipes ---------------------------------------------------------
  { name: "Wrath of God", colorIdentity: "W", roles: ["BOARD_WIPE"], manaValue: 4, note: "Clean four-mana sweeper" },
  { name: "Damnation", colorIdentity: "B", roles: ["BOARD_WIPE"], manaValue: 4, note: "Black's Wrath of God" },
  { name: "Toxic Deluge", colorIdentity: "B", roles: ["BOARD_WIPE"], manaValue: 3, note: "Scalable sweeper that beats indestructible" },
  { name: "Blasphemous Act", colorIdentity: "R", roles: ["BOARD_WIPE"], manaValue: 9, note: "Usually costs one mana on a full board" },
  { name: "Austere Command", colorIdentity: "W", roles: ["BOARD_WIPE"], manaValue: 6, note: "Modal sweeper you can aim around your own board" },
  { name: "Farewell", colorIdentity: "W", roles: ["BOARD_WIPE"], manaValue: 6, themes: ["GRAVEYARD"], note: "Exiles graveyards as well as boards" },
  { name: "Crux of Fate", colorIdentity: "B", roles: ["BOARD_WIPE"], manaValue: 5, note: "Choose which half of the board dies" },
  { name: "Merciless Eviction", colorIdentity: "WB", roles: ["BOARD_WIPE"], manaValue: 6, note: "Exiles a whole permanent type" },

  // --- Counterspells & protection -----------------------------------------
  { name: "Counterspell", colorIdentity: "U", roles: ["COUNTERSPELL"], manaValue: 2, note: "The baseline two-mana counter" },
  { name: "Swan Song", colorIdentity: "U", roles: ["COUNTERSPELL"], manaValue: 1, note: "One mana to stop a key spell" },
  { name: "An Offer You Can't Refuse", colorIdentity: "U", roles: ["COUNTERSPELL"], manaValue: 1, note: "Cheap answer to combo pieces" },
  { name: "Arcane Denial", colorIdentity: "U", roles: ["COUNTERSPELL", "CARD_DRAW"], manaValue: 2, note: "Counter that replaces itself" },
  { name: "Dovin's Veto", colorIdentity: "WU", roles: ["COUNTERSPELL"], manaValue: 2, note: "Uncounterable answer to noncreature spells" },
  { name: "Heroic Intervention", colorIdentity: "G", roles: ["PROTECTION"], manaValue: 2, note: "Saves your board from a sweeper" },
  { name: "Teferi's Protection", colorIdentity: "W", roles: ["PROTECTION"], manaValue: 3, note: "Blanks an entire turn cycle aimed at you" },
  { name: "Flawless Maneuver", colorIdentity: "W", roles: ["PROTECTION"], manaValue: 3, note: "Often free protection for your board" },
  { name: "Snakeskin Veil", colorIdentity: "G", roles: ["PROTECTION"], manaValue: 1, themes: ["PLUS_ONE_COUNTERS"], note: "One mana to protect the commander" },
  { name: "Lightning Greaves", colorIdentity: "", roles: ["PROTECTION"], manaValue: 2, themes: ["EQUIPMENT"], note: "Haste and shroud for the commander" },
  { name: "Swiftfoot Boots", colorIdentity: "", roles: ["PROTECTION"], manaValue: 2, themes: ["EQUIPMENT"], note: "Hexproof and haste for the commander" },

  // --- Recursion & graveyard ----------------------------------------------
  { name: "Eternal Witness", colorIdentity: "G", roles: ["RECURSION", "GRAVEYARD"], manaValue: 3, themes: ["GRAVEYARD", "BLINK"], note: "Buys back your best card" },
  { name: "Regrowth", colorIdentity: "G", roles: ["RECURSION", "GRAVEYARD"], manaValue: 2, themes: ["GRAVEYARD"], note: "Cheap card recursion" },
  { name: "Sun Titan", colorIdentity: "W", roles: ["RECURSION", "GRAVEYARD"], manaValue: 6, themes: ["GRAVEYARD", "BLINK"], note: "Repeatable recursion on a body" },
  { name: "Animate Dead", colorIdentity: "B", roles: ["RECURSION", "GRAVEYARD"], manaValue: 2, themes: ["GRAVEYARD"], note: "Two-mana reanimation" },
  { name: "Reanimate", colorIdentity: "B", roles: ["RECURSION", "GRAVEYARD"], manaValue: 1, themes: ["GRAVEYARD"], note: "One-mana reanimation" },
  { name: "Victimize", colorIdentity: "B", roles: ["RECURSION", "GRAVEYARD"], manaValue: 3, themes: ["GRAVEYARD", "SACRIFICE"], note: "Trades one creature for two" },
  { name: "Bojuka Bog", colorIdentity: "B", roles: ["LAND", "GRAVEYARD"], manaValue: 0, themes: ["GRAVEYARD"], note: "Free graveyard hate on a land" },

  // --- Tutors --------------------------------------------------------------
  { name: "Demonic Tutor", colorIdentity: "B", roles: ["TUTOR"], manaValue: 2, note: "Finds your best card" },
  { name: "Vampiric Tutor", colorIdentity: "B", roles: ["TUTOR"], manaValue: 1, note: "Instant-speed tutor to the top" },
  { name: "Diabolic Intent", colorIdentity: "B", roles: ["TUTOR"], manaValue: 2, themes: ["SACRIFICE"], note: "Tutor that turns a spare token into value" },
  { name: "Enlightened Tutor", colorIdentity: "W", roles: ["TUTOR"], manaValue: 1, themes: ["ARTIFACTS", "ENCHANTMENTS"], note: "Finds artifacts and enchantments" },
  { name: "Idyllic Tutor", colorIdentity: "W", roles: ["TUTOR"], manaValue: 3, themes: ["ENCHANTMENTS"], note: "Finds any enchantment" },
  { name: "Green Sun's Zenith", colorIdentity: "G", roles: ["TUTOR"], manaValue: 1, note: "Scalable creature tutor straight to the battlefield" },
  { name: "Worldly Tutor", colorIdentity: "G", roles: ["TUTOR"], manaValue: 1, note: "Instant-speed creature tutor" },

  // --- Win conditions ------------------------------------------------------
  { name: "Craterhoof Behemoth", colorIdentity: "G", roles: ["WIN_CONDITION"], manaValue: 8, themes: ["GO_WIDE", "BIG_CREATURES", "TOKENS"], note: "Converts a wide board into lethal damage" },
  { name: "Triumph of the Hordes", colorIdentity: "G", roles: ["WIN_CONDITION"], manaValue: 4, themes: ["GO_WIDE", "TOKENS"], note: "Infect finisher for token boards" },
  { name: "Overwhelming Stampede", colorIdentity: "G", roles: ["WIN_CONDITION"], manaValue: 5, themes: ["GO_WIDE", "BIG_CREATURES"], note: "Alternative Craterhoof effect" },
  { name: "Finale of Devastation", colorIdentity: "G", roles: ["TUTOR", "WIN_CONDITION"], manaValue: 2, themes: ["GO_WIDE"], note: "Tutor early, finisher late" },
  { name: "Torment of Hailfire", colorIdentity: "B", roles: ["WIN_CONDITION"], manaValue: 3, themes: ["DRAIN"], note: "Ends the game once you have mana" },
  { name: "Exsanguinate", colorIdentity: "B", roles: ["WIN_CONDITION"], manaValue: 2, themes: ["DRAIN", "LIFEGAIN"], note: "Drains the whole table at once" },
  { name: "Approach of the Second Sun", colorIdentity: "W", roles: ["WIN_CONDITION"], manaValue: 7, note: "Alternative win that dodges board stalls" },
  { name: "Insurrection", colorIdentity: "R", roles: ["WIN_CONDITION"], manaValue: 8, note: "Steals every creature for a lethal swing" },
  { name: "Aetherflux Reservoir", colorIdentity: "", roles: ["WIN_CONDITION", "LIFEGAIN"], manaValue: 4, themes: ["LIFEGAIN"], note: "Turns lifegain into a kill" },

  // --- Lands & fixing ------------------------------------------------------
  { name: "Command Tower", colorIdentity: "", roles: ["LAND", "FIXING"], manaValue: 0, note: "Perfect fixing in every commander deck" },
  { name: "Exotic Orchard", colorIdentity: "", roles: ["LAND", "FIXING"], manaValue: 0, note: "Usually taps for what you need in multiplayer" },
  { name: "Path of Ancestry", colorIdentity: "", roles: ["LAND", "FIXING"], manaValue: 0, note: "Fixing plus incidental scry for tribal decks" },
  { name: "Reliquary Tower", colorIdentity: "", roles: ["LAND"], manaValue: 0, themes: ["GRAVEYARD"], note: "No maximum hand size for draw-heavy decks" },
  { name: "Myriad Landscape", colorIdentity: "", roles: ["LAND", "RAMP", "FIXING"], manaValue: 0, note: "Colourless land ramp" },
  { name: "Rogue's Passage", colorIdentity: "", roles: ["LAND", "WIN_CONDITION"], manaValue: 0, note: "Pushes a big creature through blockers" },

  // --- Theme payoffs -------------------------------------------------------
  { name: "Anointed Procession", colorIdentity: "W", roles: ["VALUE_ENGINE"], manaValue: 4, themes: ["TOKENS", "GO_WIDE"], note: "Doubles every token you make" },
  { name: "Parallel Lives", colorIdentity: "G", roles: ["VALUE_ENGINE"], manaValue: 4, themes: ["TOKENS", "GO_WIDE"], note: "Green token doubler" },
  { name: "Ashnod's Altar", colorIdentity: "", roles: ["SACRIFICE_OUTLET", "RAMP"], manaValue: 3, themes: ["SACRIFICE", "TOKENS"], note: "Free sacrifice outlet that also ramps" },
  { name: "Viscera Seer", colorIdentity: "B", roles: ["SACRIFICE_OUTLET"], manaValue: 1, themes: ["SACRIFICE"], note: "One-mana free sacrifice outlet" },
  { name: "Zulaport Cutthroat", colorIdentity: "B", roles: ["WIN_CONDITION"], manaValue: 2, themes: ["SACRIFICE", "DRAIN"], note: "Turns sacrificed creatures into damage" },
  { name: "Blood Artist", colorIdentity: "B", roles: ["WIN_CONDITION"], manaValue: 2, themes: ["SACRIFICE", "DRAIN", "LIFEGAIN"], note: "Drains the table off every death" },
  { name: "Hardened Scales", colorIdentity: "G", roles: ["VALUE_ENGINE"], manaValue: 1, themes: ["PLUS_ONE_COUNTERS"], note: "Cheap counters payoff" },
  { name: "Doubling Season", colorIdentity: "G", roles: ["VALUE_ENGINE"], manaValue: 5, themes: ["TOKENS", "PLUS_ONE_COUNTERS"], note: "Doubles tokens and counters" },
  { name: "Ghostly Flicker", colorIdentity: "U", roles: ["VALUE_ENGINE", "PROTECTION"], manaValue: 3, themes: ["BLINK"], note: "Reuses two enter-the-battlefield triggers" },
  { name: "Sun-Crowned Hunters", colorIdentity: "R", roles: ["WIN_CONDITION"], manaValue: 5, themes: ["SACRIFICE", "DRAIN"], note: "Repeatable damage in sacrifice decks" },
  { name: "Underworld Breach", colorIdentity: "R", roles: ["RECURSION", "GRAVEYARD"], manaValue: 2, themes: ["GRAVEYARD", "SPELLSLINGER"], note: "Recasts spells straight from the graveyard" },
  { name: "Mystic Retrieval", colorIdentity: "U", roles: ["RECURSION", "GRAVEYARD"], manaValue: 3, themes: ["SPELLSLINGER", "GRAVEYARD"], note: "Buys back instants and sorceries" },
  { name: "Sram, Senior Edificer", colorIdentity: "W", roles: ["CARD_DRAW", "VALUE_ENGINE"], manaValue: 2, themes: ["EQUIPMENT", "AURAS"], note: "Draws off every equipment and aura" },
  { name: "Tireless Provisioner", colorIdentity: "G", roles: ["RAMP"], manaValue: 3, themes: ["LANDFALL", "TREASURE"], note: "Turns land drops into treasure" },
  { name: "Felidar Retreat", colorIdentity: "W", roles: ["TOKEN_MAKER", "VALUE_ENGINE"], manaValue: 3, themes: ["LANDFALL", "TOKENS", "PLUS_ONE_COUNTERS"], note: "Landfall payoff that builds a board" },
];

export function parseColorIdentity(identity: string): Color[] {
  return identity.split("").filter((c): c is Color => "WUBRG".includes(c));
}
