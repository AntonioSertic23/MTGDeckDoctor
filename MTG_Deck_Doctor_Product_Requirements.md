# MTG Deck Doctor — Product Requirements & Technical Specification

## 1. Product overview

**Product name:** MTG Deck Doctor

**Core idea:** A tool that diagnoses Commander/MTG decks, explains their strengths and weaknesses, suggests cuts and additions, and helps the player manage shared physical cards across multiple decks.

### Brand direction

Primary slogan:

> **Bitno je brinuti se o svojim deckovima.**

Alternative / more playful line:

> **Važno je s vremena na vrijeme odvesti deck na pregled.**

The product should feel like a friendly combination of:
- a deck doctor,
- a debugger,
- and a small card inventory manager.

The application should **not** try to replace Archidekt, Scryfall or EDHREC. Its value is in analysis, diagnosis, recommendations and practical deck/collection management.

---

# 2. Product goals

## Primary goals

1. Let a user import or create a deck.
2. Analyze the deck automatically.
3. Present a clear **DECK HEALTH** report.
4. Explain concrete problems rather than only displaying statistics.
5. Suggest cards to cut.
6. Suggest cards to add.
7. Explain what the deck is trying to do.
8. Track which physical cards are shared between decks.
9. Make it obvious where a card is currently being used.
10. Help the user decide whether they need another copy of an expensive card.

## Non-goals for the MVP

The first version should NOT attempt to become:
- a full deck builder replacement,
- an online marketplace,
- a card scanner,
- a complete collection management platform,
- an EDHREC replacement,
- a social network,
- an automated tournament tracker.

---

# 3. Target user

Primary user:

> A Commander player with multiple decks who regularly changes, tunes and upgrades decks and owns a limited number of physical copies of expensive cards.

Typical problem:

> "I know I own this card, but I don't remember which deck it is in."

Another common problem:

> "This deck is not performing well, but I don't know exactly what is wrong with it."

The application should answer both questions.

---

# 4. Core product modules

The application consists of five major modules:

1. **Deck Doctor**
2. **Deck Debugger / DECK HEALTH**
3. **Problems**
4. **Suggested Cuts / Suggested Additions**
5. **Shared Cards / Deck Inventory**
6. **Explain My Deck**

The Shared Cards module should be treated as a first-class feature, not an afterthought.

---

# 5. Main user flow

## Flow A — Analyze a deck

1. User creates/imports a deck.
2. Application resolves cards against Scryfall/card database.
3. Analysis engine classifies cards by roles.
4. Analysis engine calculates deck statistics.
5. Analysis engine calculates DECK HEALTH.
6. Application identifies problems.
7. Application proposes cuts.
8. Application proposes additions.
9. Application generates an explanation of the deck.

Example:

```text
MTG DECK DOCTOR

Muldrotha, the Gravetide

DECK HEALTH
━━━━━━━━━━━━━━━━━━━━━━━━

Ramp           8/10
Card Draw      9/10
Interaction    5/10
Removal        6/10
Board Wipes    3/10
Win Conditions 8/10
Mana Base      7/10

Overall Health
██████████████░░░░ 78/100
```

Then:

```text
PROBLEMS

⚠ Low instant-speed interaction
⚠ Very high average mana value
⚠ Several cards overlap heavily in function
⚠ Deck is vulnerable when the graveyard is shut down
```

---

# 6. Deck Doctor / DECK HEALTH

## 6.1 Required health categories

MVP should support at least:

- Ramp
- Card draw / card advantage
- Removal
- Interaction
- Board wipes
- Win conditions
- Mana base
- Creature density
- Average mana value / curve
- Synergy
- Graveyard support
- Tutors

Not every category must contribute equally to the final score.

The system should be designed so that additional categories can be added later without rewriting the entire analyzer.

---

# 7. Analysis engine

The analysis engine should be deterministic and explainable.

Avoid making the MVP depend on an LLM for the actual diagnosis.

The system should first calculate structured facts such as:

```text
landCount
creatureCount
instantCount
sorceryCount
artifactCount
enchantmentCount
planeswalkerCount

averageManaValue
medianManaValue

rampCount
drawCount
removalCount
boardWipeCount
tutorCount
graveyardInteractionCount
winConditionCount
```

Then rules can generate findings.

Example rule:

```text
IF averageManaValue > threshold
AND rampCount < recommendedRamp
THEN create problem:
"Deck may be too slow."
```

Example:

```text
IF instantSpeedInteraction < minimum
THEN create problem:
"Deck has limited ability to interact during opponents' turns."
```

Every diagnostic should contain:

- `type`
- `severity`
- `title`
- `description`
- `evidence`
- `affectedCards`
- optional `suggestedFix`

Example:

```json
{
  "type": "LOW_INTERACTION",
  "severity": "warning",
  "title": "Low interaction",
  "description": "The deck has relatively few cards that interact at instant speed.",
  "evidence": {
    "instantInteraction": 4,
    "recommendedMinimum": 8
  }
}
```

This makes the UI explainable.

---

# 8. Health score

Use a normalized 0–100 score.

Suggested structure:

```text
Overall Health =
  15% Mana Base
+ 15% Ramp
+ 15% Card Advantage
+ 15% Interaction
+ 10% Removal
+ 10% Win Conditions
+ 10% Curve
+ 10% Synergy
```

The exact weights should live in configuration rather than being hard-coded in UI components.

Example:

```ts
const HEALTH_WEIGHTS = {
  manaBase: 0.15,
  ramp: 0.15,
  cardAdvantage: 0.15,
  interaction: 0.15,
  removal: 0.10,
  winConditions: 0.10,
  curve: 0.10,
  synergy: 0.10,
};
```

Important:

The health score is a **diagnostic heuristic**, not an objective measure of whether a deck is good.

The UI should communicate this subtly.

---

# 9. Problems

The Problems section should answer:

> "What could be improved?"

Problems should be ranked by importance.

Example:

```text
PROBLEMS

🔴 Critical
Your deck has only 3 board wipes.

🟠 Warning
Your average mana value is 3.91 while your ramp package is relatively small.

🟡 Notice
7 cards perform very similar roles.
```

Each problem must be actionable.

Bad:

> "Your deck has 36 lands."

Good:

> "Your deck has 36 lands and a high average mana value. Consider testing one additional mana source or reducing several high-cost cards."

---

# 10. Suggested Cuts

The system should rank cards that are candidates for removal.

Important:

The application should never simply say:

> "Cut these cards."

It should say:

> "These are your strongest candidates to consider cutting."

Each candidate gets a **Cut Score**.

Suggested model:

```text
Cut Score =
  LowSynergy
+ RoleRedundancy
+ CurvePenalty
+ LowDeckRelevance
+ LowCommanderSynergy
+ ProblemContribution
- ComboImportance
- CoreRoleImportance
```

Normalize the result to 0–100.

Example UI:

```text
SUGGESTED CUTS

1. Card A
   Cut Score: 91
   Why:
   • Low commander synergy
   • Expensive relative to impact
   • Several cards already perform the same role

2. Card B
   Cut Score: 84
   Why:
   • Low synergy
   • Redundant effect
```

Every score must have human-readable reasons.

---

# 11. Suggested Additions

The application should recommend cards based on **what the deck lacks**, not merely globally popular cards.

Recommendation pipeline:

```text
1. Detect missing roles
2. Find candidate cards
3. Filter by commander/color identity/format legality
4. Calculate synergy
5. Remove redundant candidates
6. Rank
7. Explain why
```

Example:

```text
SUGGESTED ADDITIONS

Card X
+12 expected synergy

Why:
• Provides instant-speed interaction
• Fits commander strategy
• Low mana value
• Works with 7 existing cards
```

The recommendation engine should be provider-agnostic.

Possible sources later:

- Scryfall
- user-owned collection
- user history
- manually configured card pools
- external recommendation datasets where permitted

---

# 12. Explain My Deck

This is the narrative part of the product.

The application should derive a structured deck profile first:

```json
{
  "primaryArchetype": "Graveyard Midrange",
  "secondaryArchetype": "Value",
  "keyMechanics": [
    "Graveyard",
    "Recursion",
    "Sacrifice"
  ],
  "mainGameplan": "Generate value by repeatedly reusing permanents from the graveyard.",
  "winConditions": [],
  "weaknesses": []
}
```

Then the UI can turn this into natural language.

Example:

> This deck is primarily a graveyard-based midrange deck. It uses the commander as a recurring value engine and tries to generate incremental advantage by replaying permanents from the graveyard. Its strongest turns tend to happen after the early game, while graveyard hate and fast combo decks are potential weaknesses.

For MVP, this text can be generated from templates.

An LLM can be added later.

---

# 13. Shared Cards — key additional feature

## Problem

A user may own only one physical copy of an expensive card.

Example:

```text
Rhystic Study

Deck A  → currently used
Deck B  → also wants it
Deck C  → also contains it
```

The application should make this immediately visible.

The user's real-world question is:

> "Where is my copy of this card?"

and:

> "Which decks are fighting over the same physical card?"

---

# 14. Shared Cards dashboard

Create a top-level screen:

# SHARED CARDS

Example:

```text
Your decks share 37 cards.

Most contested cards:

Rhystic Study
━━━━━━━━━━━━━━━━━━━━
Used in:
• Atraxa
• Muldrotha
• Nekusar

Copies owned: 1
Copies required: 3
Status: ⚠️ Conflict

Cyclonic Rift
━━━━━━━━━━━━━━━━━━━━
Used in:
• Talrand
• Wilhelt

Copies owned: 1
Copies required: 2
Status: ⚠️ Conflict
```

The exact "copies owned" functionality can be MVP+; the initial MVP can simply detect that a card appears in multiple decks.

---

# 15. Shared card matrix

Provide a matrix view:

```text
                    Atraxa   Muldrotha   Talrand   Wilhelt
----------------------------------------------------------
Sol Ring              ✓          ✓          ✓
Rhystic Study          ✓          ✓
Cyclonic Rift          ✓                     ✓
Command Tower          ✓          ✓          ✓          ✓
```

This lets the user immediately identify overlapping staples.

For a larger number of decks, the UI should support:
- search
- sorting by number of decks
- filtering to cards shared by 2+ decks
- filtering by expensive cards
- filtering by cards with insufficient owned copies

---

# 16. Card detail → "Where is it used?"

Every card should have a cross-deck usage view.

Example:

```text
RHYSTIC STUDY

Used in 3 decks

✓ Atraxa
✓ Muldrotha
✓ Nekusar

Owned copies: 1

Potential conflict:
You have fewer physical copies than active decks.
```

This should be accessible from:
- card search,
- deck detail,
- shared cards dashboard,
- collection view.

---

# 17. "Move card" workflow

A future but important workflow:

```text
Move Rhystic Study

FROM:
Atraxa

TO:
Nekusar

[Move]
[Cancel]
```

Moving a card should update the physical-card allocation without necessarily removing the card from the logical decklist.

This distinction is important.

The system should separate:

### Decklist membership

> "Rhystic Study belongs in this deck."

from:

### Physical allocation

> "My physical copy is currently inside this deck."

This is a core data-model decision.

---

# 18. Physical inventory model

MVP can start simple:

```text
Card:
- oracleId
- name

InventoryItem:
- userId
- oracleId
- quantity
```

Then add physical allocation:

```text
CardAllocation:
- inventoryItemId
- deckId
- quantity
```

Example:

```text
Inventory
Rhystic Study
quantity = 1

Allocation
Rhystic Study → Muldrotha = 1
```

The decklist can still contain Rhystic Study in multiple decks.

That means:

```text
Deck membership:
Muldrotha       = yes
Atraxa          = yes
Nekusar         = yes

Physical allocation:
Muldrotha       = 1
Atraxa          = 0
Nekusar         = 0
```

This solves the actual problem.

---

# 19. Data model

Recommended initial entities:

```text
User
Deck
DeckCard
Card
InventoryItem
CardAllocation
Analysis
Problem
Recommendation
```

Suggested relationships:

```text
User
 ├── Deck
 │    └── DeckCard ── Card
 │
 └── InventoryItem ── Card
                     │
                     └── CardAllocation ── Deck
```

---

# 20. Cards

The Card entity should store only the data needed by the application locally.

Suggested fields:

```ts
Card {
  id
  scryfallId
  oracleId
  name
  manaCost
  manaValue
  typeLine
  oracleText
  colors
  colorIdentity
  keywords
  imageUri
  setCode
  rarity
  prices
  updatedAt
}
```

The application should not repeatedly call the external API for every page load.

Use local persistence/cache.

---

# 21. Deck

Suggested fields:

```ts
Deck {
  id
  userId
  name
  commanderCardId
  format
  description
  createdAt
  updatedAt
}
```

DeckCard:

```ts
DeckCard {
  id
  deckId
  cardId
  quantity
  role
}
```

`role` may initially be nullable and calculated dynamically.

---

# 22. Importing decks

MVP should support plain-text deck import.

Example:

```text
1 Sol Ring
1 Arcane Signet
1 Rhystic Study
1 Swords to Plowshares
...
```

Also support separate commander section where possible.

Later add:
- Archidekt import
- Moxfield import
- other deck URL imports

Important:

Do not make scraping an architectural dependency.

Use an adapter interface:

```ts
interface DeckImporter {
  canHandle(input: string): boolean;
  import(input: string): Promise<ImportedDeck>;
}
```

Then implementations can be added independently.

---

# 23. Scryfall integration

Create a dedicated service:

```ts
interface CardProvider {
  findCard(query: string): Promise<Card>;
  getCardByScryfallId(id: string): Promise<Card>;
  getCardsByOracleIds(ids: string[]): Promise<Card[]>;
}
```

Do not call Scryfall directly from React/UI components.

The backend/service layer should:
- normalize data,
- cache cards,
- handle rate limits/errors,
- store relevant fields.

The rest of the application should depend on `CardProvider`, not on Scryfall-specific APIs.

---

# 24. Card identity

This distinction is important:

### `oracleId`
Identifies the underlying card across different printings.

### `scryfallId`
Identifies a specific printing/card object.

For deck analysis and "same card used in multiple decks", use **oracleId** as the logical card identity.

For physical collection details, future versions may use `scryfallId` because the user may own:
- a specific set printing,
- foil version,
- alternate art,
- promo,
- different language.

MVP can ignore printing-level inventory if that makes implementation simpler.

---

# 25. Analysis architecture

Use an analyzer pipeline.

```text
Deck
 ↓
Card Resolver
 ↓
Card Classifier
 ↓
Statistics Engine
 ↓
Synergy Engine
 ↓
Health Engine
 ↓
Problem Detector
 ↓
Cut Engine
 ↓
Addition Engine
 ↓
Deck Explanation
```

Each step should have a clear TypeScript interface.

Example:

```ts
interface DeckAnalyzer {
  analyze(deck: DeckWithCards): Promise<DeckAnalysis>;
}
```

---

# 26. Card classification

A card can have multiple roles.

Do NOT use a single enum such as:

```ts
role = "RAMP"
```

because a card can simultaneously be:
- ramp,
- interaction,
- sacrifice outlet,
- combo piece.

Use:

```ts
roles: CardRole[]
```

Example:

```ts
[
  "RAMP",
  "FIXING",
  "VALUE_ENGINE"
]
```

The classifier should initially be rule-based.

Possible signals:
- card type
- oracle text
- keywords
- mana value
- known card lists
- commander context

A more advanced classifier can be added later.

---

# 27. Synergy engine

Synergy is the differentiating feature of the application.

At MVP level, implement explainable pairwise/card-to-deck synergy.

Example:

```text
Card A
 ↕
Card B
```

A synergy relationship can be triggered when:
- one card references a mechanic another card provides,
- one card creates a resource another consumes,
- one card's type matches another card's payoff,
- commander ability directly interacts with a card,
- cards share a strategically important role.

Store:

```ts
Synergy {
  cardAId
  cardBId
  score
  reasons[]
}
```

Possible future representation:

```text
Commander
   |
   +--- Card A
   |      \
   |       +--- Card C
   |
   +--- Card B
          \
           +--- Card D
```

This graph can power:
- Suggested Cuts
- Suggested Additions
- Explain My Deck
- deck visualizations

---

# 28. Recommendation engine

Keep recommendation logic separate from analysis.

```ts
interface RecommendationEngine {
  suggestCuts(deck: DeckAnalysis): Promise<CutRecommendation[]>;
  suggestAdditions(deck: DeckAnalysis): Promise<AdditionRecommendation[]>;
}
```

This allows future versions to use:
- machine learning,
- user preferences,
- historical deck changes,
- external recommendation data.

---

# 29. UI / route structure

Suggested application navigation:

```text
Dashboard
Decks
  ├── All Decks
  └── Deck Detail

Shared Cards
Collection

Settings
```

Deck detail:

```text
Deck Header
├── Overview
├── Deck Health
├── Problems
├── Suggested Cuts
├── Suggested Additions
├── Explain My Deck
├── Cards
└── Shared Cards
```

---

# 30. Dashboard

The dashboard should answer two questions immediately:

1. Which decks need attention?
2. Which cards are causing inventory conflicts?

Example:

```text
GOOD MORNING, DECK DOCTOR

Your decks

Muldrotha        78/100
Atraxa           91/100
Talrand          64/100 ⚠
Wilhelt          83/100

Inventory alerts

⚠ 7 cards are used in multiple decks
⚠ 3 cards have insufficient copies
💡 12 cards are shared staples
```

---

# 31. UX principles

The product should feel helpful rather than judgmental.

Avoid:

> "Your deck is bad."

Prefer:

> "Your deck may struggle with..."

Avoid:

> "This card is trash."

Prefer:

> "This card is one of the weaker fits based on the current deck strategy."

The application is a **doctor**, not a judge.

---

# 32. MVP definition

The MVP is complete when a user can:

### Deck Doctor
- create a deck,
- import a decklist,
- resolve cards,
- view deck statistics,
- view DECK HEALTH,
- see Problems,
- see Suggested Cuts,
- see Suggested Additions,
- read Explain My Deck.

### Shared Cards
- have multiple decks,
- detect cards appearing in multiple decks,
- view a Shared Cards dashboard,
- search for a card,
- see all decks containing that card,
- optionally record how many copies the user owns,
- identify inventory conflicts.

---

# 33. MVP should NOT require AI

The initial implementation should work without an LLM.

Use:
- deterministic rules,
- card metadata,
- text-based classification,
- configurable heuristics,
- synergy rules.

This gives the project:
- predictable output,
- debuggability,
- testability,
- lower cost,
- easier iteration.

An LLM can later be added only for language generation:

```text
Structured analysis
       ↓
LLM
       ↓
Natural-language explanation
```

Never:

```text
Deck
 ↓
LLM
 ↓
random diagnosis
```

---

# 34. Testing requirements

The project should include unit tests for:

### Card classification
Given card metadata → expected roles.

### Health
Given known deck metrics → expected score.

### Problems
Given metrics → expected problem.

### Cuts
Given mocked card scores → expected ranking.

### Shared cards
Given multiple decklists:

```text
Deck A = [Sol Ring, Rhystic Study]
Deck B = [Sol Ring, Swords]
Deck C = [Rhystic Study]
```

Expected:

```text
Sol Ring → A, B
Rhystic Study → A, C
Swords → B
```

### Inventory conflict

If:

```text
Rhystic Study
Decks using it: 3
Owned copies: 1
```

Expected:

```text
conflict = true
shortage = 2
```

---

# 35. Example API design

Suggested backend endpoints:

```text
GET    /api/decks
POST   /api/decks
GET    /api/decks/:id
PUT    /api/decks/:id
DELETE /api/decks/:id

POST   /api/decks/import
GET    /api/decks/:id/analysis
POST   /api/decks/:id/analyze

GET    /api/decks/:id/problems
GET    /api/decks/:id/cuts
GET    /api/decks/:id/additions
GET    /api/decks/:id/explanation

GET    /api/shared-cards
GET    /api/cards/:oracleId/usage

GET    /api/inventory
POST   /api/inventory
PUT    /api/inventory/:id

GET    /api/inventory/conflicts
POST   /api/inventory/allocations
DELETE /api/inventory/allocations/:id
```

Exact route naming can be changed to match the chosen framework.

---

# 36. Suggested technology baseline

The implementation can use the developer's preferred stack.

Recommended baseline:

```text
Frontend:
Next.js + TypeScript

UI:
Tailwind CSS
shadcn/ui

Backend:
Next.js server/API routes or separate TypeScript backend

Database:
PostgreSQL

ORM:
Drizzle or Prisma

Validation:
Zod

Testing:
Vitest
Playwright

External card data:
Scryfall through an isolated provider service
```

This is a recommendation, not a hard requirement.

---

# 37. Suggested implementation phases

## Phase 1 — Foundation

- project setup
- database
- Card model
- Deck model
- DeckCard model
- Scryfall provider
- deck import
- card resolution

## Phase 2 — Deck Doctor

- deck statistics
- card classification
- health engine
- DECK HEALTH UI
- Problems engine

## Phase 3 — Recommendations

- synergy engine
- Suggested Cuts
- Suggested Additions
- Explain My Deck

## Phase 4 — Shared Cards

- inventory
- shared-card detection
- Shared Cards dashboard
- card usage view
- conflict detection

## Phase 5 — Polish

- responsive UI
- caching
- background analysis
- loading/error states
- tests
- empty states
- performance

---

# 38. Future features

Potential future versions:

### Deck history

Track changes over time.

```text
Average CMC
3.82 → 3.61 → 3.47
```

### Deck comparison

Compare two versions or two decks.

### Physical card allocation

Allow a user to "move" a physical card from one deck to another.

### Collection-aware recommendations

Only recommend cards the user already owns.

### Budget-aware recommendations

Recommend alternatives based on card price.

### Proxy-aware mode

Track cards the user owns physically vs cards they proxy.

### Sideboard / format support

Expand beyond Commander.

### Deck health history

```text
June     71
July     78
August   84
```

### Synergy graph

Interactive graph showing commander → cards → mechanics → win conditions.

### AI explanation

Use structured diagnostics as input to an LLM for more natural explanations.

---

# 39. Product identity

The product should consistently use medical/debugging terminology.

Examples:

```text
Deck Doctor
Deck Health
Diagnosis
Problems
Treatment
Suggested Cuts
Suggested Additions
Follow-up
Deck History
Shared Cards
Inventory Conflicts
```

Potential playful statuses:

```text
Healthy
Needs Attention
Under Observation
Critical
```

Do not overdo the medical theme; clarity is more important than the joke.

---

# 40. Acceptance criteria

A first release should satisfy all of the following:

- A user can import a valid decklist.
- Imported cards are resolved to known card records.
- A deck has a visible analysis.
- The analysis includes a 0–100 DECK HEALTH score.
- Health categories are individually visible.
- Problems are generated from deterministic rules.
- Suggested Cuts are ranked and explainable.
- Suggested Additions are ranked and explainable.
- Explain My Deck is generated from structured analysis.
- Multiple decks can contain the same card.
- Shared Cards identifies cards used by multiple decks.
- A card can show every deck that contains it.
- The user can optionally define owned quantity.
- The application can detect when the number of decks using a card exceeds the number of copies owned.
- No external API is called directly from UI components.
- External card data is cached locally.
- Analysis logic is unit tested.
- Shared-card conflict logic is unit tested.

---

# 41. Development principle

The most important architectural principle is:

> **Separate facts from opinions.**

Facts:

```text
This deck has 35 lands.
This deck contains 7 ramp cards.
This card is in 3 decks.
The user owns 1 copy.
```

Opinions/diagnosis:

```text
The deck may need more ramp.
This card is a strong cut candidate.
This card is causing an inventory conflict.
```

The application should always be able to trace an opinion back to facts.

That will make MTG Deck Doctor much easier to debug, improve and trust.

---

# 42. Suggested first milestone

Build the first vertical slice end-to-end:

```text
Import deck
   ↓
Resolve cards
   ↓
Store deck
   ↓
Calculate statistics
   ↓
Calculate DECK HEALTH
   ↓
Show Problems
   ↓
Show Shared Cards
```

Do not build every feature before showing the first useful result.

The first milestone should already let a user say:

> "I imported my deck, I can see what is wrong with it, and I can immediately see which cards are shared with my other decks."

That is the core value proposition of MTG Deck Doctor.
