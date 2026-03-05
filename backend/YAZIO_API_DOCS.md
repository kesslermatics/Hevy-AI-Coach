# Yazio API — Reverse-Engineered Endpoint Documentation

> **Base URL:** `https://yzapi.yazio.com/v15`  
> **Auth:** OAuth2 Bearer Token via `POST /oauth/token`  
> **Versions tested:** v7–v18 (all respond; v15 is the primary version)

---

## Authentication

### `POST /oauth/token`
Login and obtain a bearer token.

```json
{
  "client_id": "1_4hiybetvfksgw40o0sog4s884kwc840wwso8go4k8c04goo4c",
  "client_secret": "6rok2m65xuskgkgogw40wkkk8sw0osg84s8cggsc4woos4s8o",
  "username": "<email>",
  "password": "<password>",
  "grant_type": "password"
}
```

**Response:**
```json
{
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "scope": null
}
```

---

## ✅ Working Endpoints (v15)

### 1. User Profile

#### `GET /user`
Full user profile.

**Response keys:** `first_name`, `last_name`, `sex`, `city`, `country`, `language`, `timezone_offset`, `food_database_country`, `goal` (`gain`/`build_muscle`/`lose_weight`/etc.), `activity_degree`, `weight_change_per_week`, `unit_length`, `unit_mass`, `unit_energy`, `unit_glucose`, `unit_serving`, `diet` (`name`, `carb_percentage`, `fat_percentage`, `protein_percentage`), `registration_date`, `profile_image`, `premium_type`, `start_weight`, `uuid`, `body_height`, `date_of_birth`, `email`, `tags`, `pal`, `last_active_date`

---

### 2. User Settings

#### `GET /user/settings`
Notification and tracker settings.

**Response:**
```json
{
  "has_water_tracker": true,
  "has_diary_tipps": true,
  "has_meal_reminders": true,
  "has_usage_reminders": false,
  "has_weight_reminders": true,
  "has_water_reminders": false,
  "consume_activity_calories": true,
  "has_feelings": false,
  "has_fasting_tracker_reminders": false,
  "has_fasting_stage_reminders": false
}
```

---

### 3. Daily Summary Widget (already used)

#### `GET /user/widgets/daily-summary?date=YYYY-MM-DD`
Aggregated daily nutrition summary per meal type with goals.

**Response keys:** `activity_energy`, `consume_activity_energy`, `steps`, `water_intake`, `goals`, `units`, `meals`, `user`, `active_fasting_countdown_template_key`

- `meals.{breakfast,lunch,dinner,snack}.nutrients` — aggregated macros per meal type
- `goals` — daily targets (energy, protein, carb, fat)
- `user` — `current_weight`, `start_weight`, `goal`, `sex`

---

### 4. 🆕 Consumed Items (Individual Food Items!)

#### `GET /user/consumed-items?date=YYYY-MM-DD`
**THE KEY ENDPOINT** — Returns every individual tracked food item for a date.

**Response structure:**
```json
{
  "products": [
    {
      "id": "uuid",              // entry ID
      "date": "2026-03-04 16:42:22",  // timestamp of when it was logged
      "daytime": "breakfast",    // breakfast | lunch | dinner | snack
      "type": "product",
      "product_id": "uuid",      // → resolve via GET /products/{id}
      "amount": 150,             // amount in grams (base_unit)
      "serving": "beaker",       // serving type used
      "serving_quantity": 1      // number of servings
    }
  ],
  "recipe_portions": [
    {
      "id": "uuid",
      "date": "2026-03-04 12:00:00",
      "daytime": "lunch",
      "type": "recipe_portion",
      "recipe_id": "uuid",       // → resolve via GET /recipes/{id}
      "amount": 1,
      "serving": "portion",
      "serving_quantity": 1
    }
  ],
  "simple_products": [
    // Manually entered foods without product_id
  ]
}
```

**Note:** The `meal` and `meal_type` query params are accepted but don't seem to filter — all items for the date are returned regardless.

---

### 5. 🆕 Product Details (Resolve product_id → Name + Macros)

#### `GET /products/{product_id}`
Lookup individual product by UUID. Returns name, producer, nutrients per gram, servings.

**Response:**
```json
{
  "name": "Hähnchen-Geschnetzeltes (Gyros Art)",
  "is_verified": false,
  "is_private": false,
  "is_deleted": false,
  "has_ean": true,
  "category": "poultry",
  "producer": "Metzgerfrisch (Lidl)",
  "nutrients": {
    "energy.energy": 1.17,           // kcal per 1g
    "nutrient.protein": 0.18,        // grams protein per 1g
    "nutrient.carb": 0.0,            // grams carbs per 1g
    "nutrient.fat": 0.05,            // grams fat per 1g
    "nutrient.salt": 0.014,
    "nutrient.saturated": 0.018,
    "nutrient.sugar": 0.0,
    "nutrient.dietaryfiber": 0.0
  },
  "updated_at": "2024-12-17 10:27:21",
  "servings": [
    {"serving": "portion", "amount": 200.0}
  ],
  "base_unit": "g",
  "eans": ["4335619135031"],
  "language": "de",
  "countries": ["DE"]
}
```

**⚠️ IMPORTANT:** Nutrients are **per 1 gram**! Multiply by `amount` from consumed-items to get the actual values for the tracked item.

**Calculating macros for a consumed item:**
```python
actual_kcal = product["nutrients"]["energy.energy"] * consumed_item["amount"]
actual_protein = product["nutrients"]["nutrient.protein"] * consumed_item["amount"]
actual_carbs = product["nutrients"]["nutrient.carb"] * consumed_item["amount"]
actual_fat = product["nutrients"]["nutrient.fat"] * consumed_item["amount"]
```

---

### 6. 🆕 User Saved Meals (Templates)

#### `GET /user/meals`
Returns saved meal templates with their product compositions.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Quarm",
    "recipe_portions": [],
    "products": [
      {
        "product_id": "uuid",
        "amount": 150.0,
        "serving": "beaker",
        "serving_quantity": 1.0,
        "type": "product"
      }
    ],
    "simple_products": []
  }
]
```

---

### 7. 🆕 User Recipes

#### `GET /user/recipes`
Returns list of recipe UUIDs (strings, not objects).

**Response:** `["uuid1", "uuid2", ...]`

#### `GET /recipes/{recipe_id}`
Full recipe details with nutrients per portion and ingredients.

**Response:**
```json
{
  "id": "uuid",
  "name": "One-Pot Hackfleischtopf mit Reis",
  "portion_count": 4,
  "nutrients": {
    "energy.energy": 797.5,         // per portion!
    "nutrient.protein": 40.9,
    "nutrient.carb": 45.725,
    "nutrient.fat": 49.05,
    "nutrient.dietaryfiber": 1.0,
    "nutrient.sugar": 5.6,
    "nutrient.salt": 0.385,
    // ... plus all minerals and vitamins
  },
  "servings": [
    {
      "producer": "Freshona (Lidl)",
      "name": "Dosentomaten, stückig",
      "amount": 800.0,
      "serving": "can",
      "serving_quantity": 2.0,
      "base_unit": "g",
      "product_id": "uuid"
    }
  ]
}
```

---

### 8. 🆕 User Custom Products

#### `GET /user/products`
Returns list of user-created product UUIDs.

**Response:** `["uuid1"]`

---

### 9. 🆕 Exercises / Activity

#### `GET /user/exercises?date=YYYY-MM-DD`
Returns tracked exercises and activity for a date.

**Response:**
```json
{
  "training": [],
  "custom_training": [],
  "activity": {
    "energy": 289.69,        // kcal burned
    "distance": 4836,        // meters
    "duration": 0,
    "source": "fitbit",      // connected tracker
    "gateway": "fitbit",
    "steps": 7006
  }
}
```

---

### 10. 🆕 Water Intake

#### `GET /user/water-intake?date=YYYY-MM-DD`
Returns water intake for a specific date.

**Response:**
```json
{
  "water_intake": 0.0,       // ml
  "gateway": null,
  "source": null
}
```

---

### 11. Subscription

#### `GET /user/subscription`
Returns subscription details (list of subscription objects).

---

## ❌ Endpoints That Do NOT Work

These all returned 404s across all tested API versions:

- `/user/body-data` (all versions, with and without params)
- `/user/body`, `/user/body-entries`, `/user/weights`, `/user/weight`
- `/user/weight-history`, `/user/body-weight`, `/user/body-measurements`
- `/user/diary`, `/user/diary/*`, `/user/food-log`, `/user/food-diary`
- `/user/nutrition`, `/user/consumed`, `/user/entries`
- `/user/activities`, `/user/activity`, `/user/steps`
- `/user/fasting`, `/user/fasting/*`
- `/user/goals`, `/user/challenges`, `/user/achievements`
- `/user/favorites`, `/user/recent-products`
- `/products/search`, `/foods/search`, `/search/*`
- `/health`, `/status`, `/docs`, `/swagger`, `/openapi`

---

## Nutrient Keys Reference

| Key | Description | Unit (per 1g of product) |
|-----|------------|--------------------------|
| `energy.energy` | Calories | kcal |
| `nutrient.protein` | Protein | g |
| `nutrient.carb` | Carbohydrates | g |
| `nutrient.fat` | Fat (total) | g |
| `nutrient.saturated` | Saturated fat | g |
| `nutrient.sugar` | Sugar | g |
| `nutrient.dietaryfiber` | Dietary fiber | g |
| `nutrient.salt` | Salt | g |
| `nutrient.monounsaturated` | Monounsaturated fat | g |
| `nutrient.polyunsaturated` | Polyunsaturated fat | g |
| `nutrient.cholesterol` | Cholesterol | g |
| `nutrient.alcohol` | Alcohol | g |
| `nutrient.sodium` | Sodium | g |
| `nutrient.water` | Water | g |
| `mineral.*` | Various minerals | g |
| `vitamin.*` | Various vitamins | g |

---

## API Version Differences

| Version | Notes |
|---------|-------|
| v7 | Missing `user/consumed-items`, but has `user/meals`. No `user/products` |
| v8–v9 | Same as v7, adds image URLs on products |
| v10 | Adds `is_premium`, `pal`, `locale`, `last_active_date` to /user |
| v11 | Adds `eans` to product details |
| v12 | Adds `activity_degree` to /user |
| v13+ | Adds `food_database_country` to /user |
| v15 | **Primary version** — all endpoints work. `consumed-items` confirmed working |
| v16+ | Goal changed to `build_muscle` (vs `gain` in earlier versions) |
| v18 | Latest tested, all endpoints work |

---

## Typical API Flow for Full Food Diary

```
1. POST /oauth/token          → get access_token
2. GET /user                   → profile, goals, diet
3. GET /user/consumed-items?date=YYYY-MM-DD → all tracked items
4. For each product_id:
     GET /products/{product_id} → name, nutrients per gram
5. Calculate: nutrient_value * amount = actual intake
6. GET /user/widgets/daily-summary?date=YYYY-MM-DD → cross-check totals
7. GET /user/exercises?date=YYYY-MM-DD → activity/steps
8. GET /user/water-intake?date=YYYY-MM-DD → water
```
