# Sugar Rush: Fact Sources

**Rule (Tim, 2026-11-10):** every factual statement in the game comes from **Diabetes Canada** (formerly the Canadian Diabetes Association) or **Health Canada** (Canada's Food Guide and Health Canada nutrient data). Nothing from general knowledge.

**How this file was built (2026-11-10):** the pages below were read with a web-fetch tool. Quotes are short excerpts. Items marked **[partial]** came from parts of long pages the tool only summarized, not quoted word for word; re-check those on the page before relying on them heavily.

In game.js, every Beta Cell has a `src` field holding the IDs below.

---

## Diabetes Canada

| ID | Page |
|---|---|
| DC-T1 | [Type 1 Diabetes](https://www.diabetes.ca/what-is-diabetes/types-of-diabetes/type-1-diabetes) |
| DC-INS | [Getting Started with Insulin](https://www.diabetes.ca/living-with-diabetes/blood-sugar-management/getting-started-with-insulin) |
| DC-AIR | [Air travel](https://www.diabetes.ca/learn-about-diabetes/your-rights/air-travel) |
| DC-CARB | [Carb Counting for Blood Sugar Control](https://www.diabetes.ca/nutrition-fitness/healthy-eating/carb-counting) |
| DC-HANDY | [Handy Portion Guide](https://www.diabetes.ca/nutrition-and-recipes/eating/handy-portion-guide) |
| DC-CPG9 | [CPG ch. 9, Monitoring Glycemic Control](https://www.diabetes.ca/for-professionals/full-guidelines/chapter-9) |
| DC-CPG10 | [CPG ch. 10, Physical Activity](https://www.diabetes.ca/for-professionals/full-guidelines/chapter-10) |
| DC-CPG12 | [CPG ch. 12, Glycemic Management in Adults With Type 1](https://www.diabetes.ca/for-professionals/full-guidelines/chapter-12) |
| DC-CPG14 | [CPG ch. 14, Hypoglycemia](https://www.diabetes.ca/for-professionals/full-guidelines/chapter-14) and [2023 update](https://www.diabetes.ca/for-professionals/full-guidelines/chapter-14-2023-update) |
| DC-CPG15 | [CPG ch. 15, Hyperglycemic Emergencies](https://www.diabetes.ca/for-professionals/full-guidelines/chapter-15) |
| DC-CPG34 | [CPG ch. 34, Type 1 Diabetes in Children and Adolescents](https://www.diabetes.ca/for-professionals/full-guidelines/chapter-34) |

### What T1D is (DC-T1, DC-INS)
- "type 1 diabetes is an autoimmune condition, where your body's immune cells mistakenly attack the cells in the pancreas that make insulin."
- Insulin is "a hormone that helps your body's cells use blood glucose (also known as blood sugar) for energy." "Insulin is a hormone made by the pancreas."
- Type 1 "generally develops in children but can also develop in adults."
- **Not stated** in what was read: the name "beta cells", where the pancreas is, and whether diet or lifestyle cause T1D. (The guidelines' definitions chapter, ch. 3, describes "pancreatic beta cell destruction" [search summary only, not read].)

### Targets for children (DC-CPG34, Table 1)
- Under 18: A1C ≤7.5%; before meals 4.0-8.0 mmol/L; 2 hours after meals 5.0-10.0 mmol/L.
- The game's green zone (5-10) matches the after-meal target.

### Lows (DC-CPG14, DC-CPG34)
- Threshold: "<4.0 mmol/L for people with diabetes treated with insulin" (2018 chapter). The 2023 update uses "<3.9 mmol/L" as the alert value. The children's chapter gives no number. **Game uses 4.0.**
- Symptoms (Table 1): trembling, palpitations, sweating, anxiety, hunger, nausea, tingling; difficulty concentrating, confusion, weakness, drowsiness, vision changes, difficulty speaking, headache, dizziness. "Not all symptoms will be present."
- Treatment amount **for children depends on age** (DC-CPG34, Table 2): under 5 years 5 g, 5-10 years 10 g, over 10 years 15 g. Example: glucose tablet (4 g) 1 / 2 or 3 / 4; juice, regular soft drink or sweet beverage 40 mL / 85 mL / 125 mL. The adult 15 g rule "does not apply to children" [partial].
- Examples of fast-acting carbohydrate (Table 4) [partial]: glucose tablets; table sugar dissolved in water; sugar cubes; juice or regular soft drink; Life Savers; honey.
- "Glucose or sucrose tablets or solution are preferable"; orange juice and glucose gels "are not preferred"; milk and orange juice are slower to raise BG [partial].
- Recheck after 15 minutes; treat again if still low [partial].
- After treatment: "If a meal is >1 hour away, a snack (including 15 g carbohydrate and a protein source) should be consumed." (adult chapter; children's amounts not given)
- "Carry a source of fast-acting carbohydrate with you at all times, such as glucose tablets, Life Savers™ and/or a juice box."
- Nighttime lows "occur frequently during sleep" and are often not felt [partial].
- Severe low, unconscious: glucagon; call emergency services [partial]. Children: glucagon 0.5 mg (5 years and under) or 1 mg (over 5) for severe lows at home.
- **Not stated:** that fat or chocolate slows treatment.

### Highs, sick days, ketones, DKA (DC-CPG9, DC-CPG15, DC-CPG34, DC-T1)
- "When you are sick, your blood glucose levels may fluctuate and be unpredictable." Check "more often than usual (for example, every 2 to 4 hours)." "Drink plenty of sugar-free fluids or water." "Develop a sick-day plan with your diabetes health-care team."
- Children: "Sick-day management includes more frequent SMBG, ketone measurement during hyperglycemia and adjustment of insulin dose in response to monitoring."
- Test ketones during illness with high BG, when pre-meal BG stays above 14.0 mmol/L, or with DKA symptoms [partial]. "Blood ketone testing is preferred over urine testing."
- DKA: "a serious diabetes complication that happens when there is not enough insulin in your body." Warning signs: "feeling very thirsty, feeling very weak, peeing more than usual, shortness of breath, nausea, vomiting, stomach pain and/or high blood sugars." "If you think you are experiencing DKA, please get medical help immediately!"
- Children: "DKA results from failing to take insulin or poor sick-day management."
- Stress raising BG: **not stated** in what was read.

### Monitoring (DC-CPG9)
- A1C: average blood glucose "for the last 2 to 3 months."
- CGM measures glucose "in the interstitial fluid," shows "trending arrows," and gives alarms above or below a set limit [partial]. How often it reads: not stated.

### Insulin (DC-INS, DC-CPG12)
- Bolus (rapid-acting) "Works fast to act on food eaten at meals", taken "0 to 15 minutes before meals" (typical product timing; the game says to ask your team). Basal = long- or intermediate-acting [partial].
- "Insulin is injected by pen, syringe or insulin pump."
- Pumps "deliver insulin 24 hours a day through a small tube under the skin."
- "Change (rotate) where you inject insulin each time. This helps prevent fatty lumps that can make insulin work poorly." Abdomen: stay "2 inches (5 cm)" from the belly button.
- Storage: room temperature "up to 30 days"; discard if "frozen, exposed to temperatures greater than 30ºC, or expired."
- "Always carry a note or card in your wallet or purse that says you have diabetes." MedicAlert bracelets suggested. "It is important in case of emergency that others know you have diabetes."

### Physical activity (DC-CPG10, DC-CPG34)
- Children: activity "≥3 times per week for ≥60 minutes each time should be encouraged."
- After long exercise, insulin sensitivity rises "for up to 48 hours"; exercise late in the day can raise the risk of overnight lows [partial].
- "Increase carbohydrate consumption prior to, during and after exercise, as necessary" [partial]. Insulin changes for exercise are a team decision (not shown in game).
- Brief intense exercise like sprinting can raise glucose [partial].

### Travel (DC-AIR)
- "Always carry your insulin and supplies with you in your carry-on luggage." Liquids to treat lows may exceed 100 mL if declared. Carry a doctor's letter, extra insulin and supplies, glucagon, fast sugar and snacks. In heat use an insulated bag; in cold keep insulin close to your body.

### Carb counting (DC-CARB, DC-HANDY, DC-CPG34)
- Carbs are in "grains and starches, fruits, some vegetables, legumes, milk and milk alternatives, sugary foods and many prepared foods." "Meat and alternatives, most vegetables and fats contain little carbohydrate."
- Labels: "Check the Serving Size"; "Fibre does not raise blood sugar and should be subtracted from the total carbohydrate."
- "Most people aim for 45–60 grams (g) carbohydrate at meals and 15–30 g carbohydrate at snacks." "Your dietitian will help you set a goal."
- Handy Portion Guide: grains, starches, fruit: "the size of your fist"; vegetables: "as much as you can hold in both hands"; meat and alternatives: "the size of the palm of your hand and the thickness of your little finger"; fat: "the size of the tip of your thumb."
- "A fist is about a cup of food": from the carb-counting page's video transcript only (weaker source).
- Children "should follow a healthy diet as recommended for children without diabetes in ... Canada's Food Guide."

### Feelings (DC-CPG34)
- Children and teens with diabetes "have significant risks for psychological problems, including diabetes distress, depression, anxiety, eating disorders." Psychological support helps.

---

## Health Canada

| ID | Page |
|---|---|
| CFG-SNAP | [Food guide snapshot](https://www.canada.ca/en/health-canada/services/food-guide/explore/snapshot.html) |
| CFG-REC | [Healthy eating recommendations](https://www.canada.ca/en/health-canada/services/food-guide/explore/healthy-eating-recommendations.html) |
| CFG-WATER | [Make water your drink of choice](https://www.canada.ca/en/health-canada/services/food-guide/explore/healthy-eating-recommendations/make-water-drink-choice.html) |
| CFG-SUGARY | [Sugary drinks](https://www.canada.ca/en/health-canada/services/food-guide/explore/healthy-eating-recommendations/make-water-drink-choice/sugary-drinks.html) |
| CFG-LABELS | [Use food labels](https://www.canada.ca/en/health-canada/services/food-guide/explore/healthy-eating-recommendations/use-food-labels.html) |
| CFG-PROC | [Limit highly processed foods](https://www.canada.ca/en/health-canada/services/food-guide/explore/healthy-eating-recommendations/limit-highly-processed.html) |
| HC-NV | [Nutrient Value of Some Common Foods (2008)](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html) |

- "Eat a variety of healthy foods each day." "Have plenty of vegetables and fruits," "Eat protein foods," "Choose whole grain foods," "Make water your drink of choice."
- Sugary drinks include fruit juice, soft drinks, sports drinks, energy drinks and sweetened milks like chocolate milk; they "may lead to increased risk of: obesity, type 2 diabetes, cavities in children."
- Healthy drinks: water, "white milk (unsweetened lower fat milk)".
- Snack ideas: "nuts, fruit, carrots, hard-boiled eggs"; "Mix lower fat yogurt with berries."
- Nutrition facts table "provides information on serving size, calories, certain nutrients and % daily values (% DV)." "5% DV or less is a little," "15% DV or more is a lot." The ingredient list "starts with the ingredient that weighs the most."
- Highly processed foods "add excess sodium, sugars or saturated fat."

### Carbohydrate values (HC-NV, 2008). All food numbers in the game come from here.

| Food | Serving | Carb g | Fibre g |
|---|---|---|---|
| Apple, with skin | 1 medium (138 g) | 19 | 2.6 |
| Banana | 1 (118 g) | 27 | 2.1 |
| Orange | 1 (131 g) | 15 | 2.3 |
| Pear, with skin | 1 (166 g) | 26 | 5 |
| Grapes | 20 grapes | 18 | 1.2 |
| Strawberries | 7 | 6 | 1.9 |
| Blueberries | 125 mL (½ cup) | 11 | 2 |
| Peaches, canned in juice | 125 mL | 15 | 1.7 |
| Applesauce, unsweetened | 125 mL | 15 | 1.5 |
| Raisins | 60 mL (¼ cup) | 29 | 1.3 |
| Apple juice | 125 mL | 15 | 0.1 |
| Orange juice | 125 mL | 13 | 0.3 |
| Milk, 2% | 250 mL (1 cup) | 12 | - |
| Chocolate milk (powder + 2%) | 250 mL | 33 | - |
| Yogurt, plain 1-2% | 175 mL (¾ cup) | 13 | - |
| Yogurt, vanilla or fruit 1-2% | 175 mL | 30 | - |
| Cheddar | 50 g | 1 | - |
| Cottage cheese 1% | 125 mL | 3 | - |
| Egg, hard-boiled | 1 large | 1 | - |
| White bread | 1 slice (35 g) | 18 | 0.8 |
| Whole wheat bread | 1 slice (35 g) | 16 | 2.4 |
| Bagel, plain | 1 (10 cm) | 38 | 1.6 |
| English muffin, toasted | 1 | 26 | 1.5 |
| Pita, white | 1 (17 cm) | 33 | 1.3 |
| Tortilla, wheat | 1 (20 cm) | 27 | n/a |
| Tortilla, corn | 1 (15 cm) | 8 | 1.2 |
| Naan | ½ (63 g) | 36 | 1.4 |
| Bannock | 1 medium (37 g) | 19 | 0.5 |
| White rice, cooked | 125 mL (½ cup) | 24 | 0.4 |
| Brown rice, cooked | 125 mL | 24 | 1.5 |
| Wild rice, cooked | 125 mL | 18 | 1.6 |
| Spaghetti, cooked | 250 mL (1 cup) | 42 | 2.5 |
| Egg noodles, cooked | 250 mL | 42 | 1.9 |
| Rice noodles, cooked | 250 mL | 46 | 1.9 |
| Oatmeal, cooked | 175 mL (¾ cup) | 17 | 2.6 |
| Corn Flakes | 250 mL | 23 | 0.7 |
| Cheerios | 250 mL | 18 | 2.2 |
| Granola with raisins, low fat | 125 mL | 46 | 3.5 |
| Pancake, plain homemade | 1 (13 cm) | 11 | 0.5 |
| Waffle, homemade | 1 | 14 | 0.5 |
| Muffin, fruit, homemade | 1 | 23 | 0.9 |
| Saltine crackers | 4 | 9 | tr |
| Whole wheat crackers | 4 | 11 | 1.7 |
| Rice cake, plain | 1 | 7 | 0.4 |
| Popcorn, air-popped | 250 mL (1 cup) | 7 | 1.3 |
| Pretzels, hard | 10 sticks | 4 | 0.2 |
| Potato, baked with skin | 1 | 37 | 3.8 |
| French fries (fast food) | 20-25 fries | 29 | 2.5 |
| Mashed potatoes | 125 mL | 19 | 2.2 |
| Corn, sweet | 125 mL | 19 | 2 |
| Peas, green | 125 mL | 12 | 3.7 |
| Carrots, cooked | 125 mL | 6 | 1.9 |
| Broccoli, cooked | 125 mL | 6 | 2 |
| Chickpeas, canned | 175 mL (¾ cup) | 40 | 7.8 |
| Black beans, canned | 175 mL | 29 | 12.2 |
| Refried beans | 175 mL | 29 | 9.9 |
| Lentils, boiled | 175 mL | 29 | 6.2 |
| Hummus | 60 mL (¼ cup) | 8 | 3.4 |
| Peanut butter | 30 mL (2 tbsp) | 6 | 1.8 |
| Almonds | 60 mL (¼ cup) | 7 | 4.2 |
| Edamame | 125 mL | 8 | 4.3 |
| Pizza with cheese | 1/6 of 12-inch | 25 | 1.5 |
| Hamburger or hot dog bun | 1 | 21 | 0.9 |
| Chocolate chip cookies | 2 | 13 | 0.6 |
| Ice cream, vanilla | 125 mL | 18 | 0.5 |
| Milk chocolate bar | 1 bar (50 g) | 30 | 1.7 |
| Honey | 5 mL (1 tsp) | 6 | tr |
| White sugar | 5 mL (1 tsp) | 4 | 0 |
| Maple syrup | 15 mL (1 tbsp) | 14 | 0 |
| Cola | 250 mL | 28 | 0 |
| Dumpling | 1 | 8 | 0.3 |
| Sushi with fish | 4 pieces | 35 | 0.8 |
| Chicken noodle soup, chunky | 250 mL | 18 | 4.1 |
| Tomato soup (condensed, with water) | 250 mL | 18 | 1.2 |
| Chili con carne | 250 mL | 23 | 4.9 |
| Poutine | 250 mL | 25 | 1.9 |

Not listed: roti/chapati, perogies. Mixed dishes not in this table (curry, stir-fry, burritos, etc.) are added up from the rows above in game.js, with the parts shown so a player can follow the arithmetic.

## Things the game deliberately does NOT state
- Any insulin dose, ratio or correction factor (Tim's rule).
- A specific amount of fast sugar for the player (it depends on age and on the player's diabetes team, per DC-CPG34). The game says the team decides.
- Exercise insulin changes (team decision).
