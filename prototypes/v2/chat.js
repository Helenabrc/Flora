/* hiflora v2 · chat.js → window.FloraChat
   The Flora conversation screen and the logbook sheet.
   Contract: FloraChat.mount(rootEl); FloraChat.onShow(); FloraChat.onHide();
   Saves entries through FloraApp.saveEntry(entry) and offers FloraApp.show('world', {entry}).
   Plain JS, no libraries, no modules. All CSS is injected and scoped under .fc-root. */
(function () {
  'use strict';

  var GOAL_G = 30; // commonly recommended adult intake (UK SACN 2015: 30 g/day AOAC fibre)

  /* =====================================================================================
     FOOD DICTIONARY
     fibreG = grams of dietary fibre per the typical serving shown. VALUES ARE APPROXIMATE:
     rounded down / conservatively from typical USDA FoodData Central and UK CoFID figures.
     They are estimates for a wellness prototype, not clinical or labelling data.
     fibreTypes use the contract vocabulary; flags: 'high-fat' | 'sugar' | 'fermented'.
     cat is used for clarifying questions and copy only.
     ===================================================================================== */
  function F(id, name, syn, serving, fibreG, fibreTypes, flags, cat) {
    return { id: id, name: name, syn: syn, serving: serving, fibreG: fibreG, fibreTypes: fibreTypes || [], flags: flags || [], cat: cat };
  }
  var BG = 'beta-glucan', RS = 'resistant-starch', INU = 'inulin-fos', GOS = 'gos', PEC = 'pectin',
      AX = 'arabinoxylan', CEL = 'cellulose', POL = 'polyphenols';
  var FAT = 'high-fat', SUG = 'sugar', FER = 'fermented';

  var FOODS = [
    // ---- grains and cereals
    F('oats', 'Porridge oats', ['porridge', 'oatmeal', 'oats', 'rolled oats', 'overnight oats', 'porridge oats', 'oat'], '40 g dry', 4.0, [BG, AX], [], 'grain'),
    F('granola', 'Granola', ['granola'], '45 g', 3.0, [BG, AX], [SUG], 'grain'),
    F('muesli', 'Muesli', ['muesli', 'bircher'], '45 g', 3.5, [BG, AX, CEL], [], 'grain'),
    F('bran', 'Bran flakes', ['bran flakes', 'bran', 'all bran', 'bran cereal', 'weetabix', 'shredded wheat'], '30 g', 4.0, [AX, CEL], [], 'grain'),
    F('cereal', 'Breakfast cereal', ['cereal', 'cornflakes', 'corn flakes', 'rice krispies'], '30 g', 0.8, [], [SUG], 'grain'),
    F('wmbread', 'Wholemeal bread', ['wholemeal bread', 'wholewheat bread', 'whole wheat bread', 'wholegrain bread', 'whole grain bread', 'brown bread', 'seeded bread', 'granary bread', 'wholemeal toast', 'wholegrain toast', 'brown toast', 'wholewheat toast', 'multigrain bread'], '1 slice', 2.0, [AX, CEL], [], 'grain'),
    F('wbread', 'White bread', ['bread', 'toast', 'white bread', 'white toast', 'baguette', 'roll', 'bread roll', 'bun', 'ciabatta', 'pitta', 'pita'], '1 slice', 0.8, [CEL], [], 'grain'),
    F('sourdough', 'Sourdough', ['sourdough', 'sourdough bread', 'sourdough toast'], '1 slice', 1.0, [AX, CEL], [], 'grain'),
    F('rye', 'Rye bread', ['rye bread', 'rye', 'pumpernickel', 'rye toast'], '1 slice', 2.5, [AX, CEL], [], 'grain'),
    F('crispbread', 'Rye crispbread', ['crispbread', 'ryvita', 'rye crackers', 'rye crispbread', 'knackebrod'], '2 crispbreads', 3.0, [AX, CEL], [], 'grain'),
    F('crackers', 'Crackers', ['crackers', 'cracker', 'oatcakes', 'oatcake'], '3 crackers', 1.0, [CEL], [], 'grain'),
    F('sandwich', 'Sandwich', ['sandwich', 'sarnie', 'sub'], '1 sandwich', 2.5, [AX, CEL], [], 'grain'),
    F('wrap', 'Tortilla wrap', ['wrap', 'tortilla', 'tortilla wrap', 'burrito'], '1 wrap', 1.5, [CEL], [], 'grain'),
    F('bagel', 'Bagel', ['bagel'], '1 bagel', 2.0, [CEL], [], 'grain'),
    F('brownrice', 'Brown rice', ['brown rice', 'wholegrain rice', 'wild rice'], '1 cup cooked', 3.0, [CEL, AX], [], 'grain'),
    F('rice', 'White rice', ['rice', 'white rice', 'basmati', 'jasmine rice', 'risotto', 'fried rice'], '1 cup cooked', 0.6, [], [], 'grain'),
    F('coolrice', 'Cooled rice', ['cold rice', 'cooled rice', 'rice salad', 'leftover rice'], '1 cup cooked, cooled', 1.0, [RS], [], 'grain'),
    F('sushi', 'Sushi', ['sushi', 'maki', 'sushi roll', 'onigiri'], '6 pieces', 1.5, [RS], [], 'grain'),
    F('wwpasta', 'Wholewheat pasta', ['wholewheat pasta', 'whole wheat pasta', 'wholemeal pasta', 'wholegrain pasta', 'brown pasta', 'wholewheat spaghetti'], '1 cup cooked', 5.0, [AX, CEL], [], 'grain'),
    F('pasta', 'Pasta', ['pasta', 'spaghetti', 'penne', 'macaroni', 'fusilli', 'linguine', 'tagliatelle', 'lasagne', 'lasagna', 'noodles', 'ramen', 'udon', 'mac and cheese'], '1 cup cooked', 2.5, [CEL], [], 'grain'),
    F('quinoa', 'Quinoa', ['quinoa'], '1 cup cooked', 5.0, [CEL], [], 'grain'),
    F('barley', 'Barley', ['barley', 'pearl barley', 'barley risotto'], '1/2 cup cooked', 3.0, [BG, AX], [], 'grain'),
    F('bulgur', 'Bulgur wheat', ['bulgur', 'bulgar', 'bulgur wheat', 'tabbouleh', 'freekeh'], '1 cup cooked', 8.0, [AX, CEL], [], 'grain'),
    F('couscous', 'Couscous', ['couscous'], '1 cup cooked', 2.0, [CEL], [], 'grain'),
    F('buckwheat', 'Buckwheat', ['buckwheat', 'soba', 'soba noodles', 'kasha'], '1 cup cooked', 4.5, [CEL, POL], [], 'grain'),
    F('popcorn', 'Popcorn', ['popcorn'], '3 cups popped', 3.5, [CEL], [], 'grain'),
    F('oatmilk', 'Oat milk', ['oat milk', 'oatly'], '1 glass', 1.0, [BG], [], 'drink'),

    // ---- legumes
    F('lentils', 'Lentils', ['lentils', 'lentil', 'dal', 'dhal', 'daal', 'red lentils', 'green lentils', 'puy lentils', 'lentil curry'], '1/2 cup cooked', 7.5, [RS, GOS, CEL], [], 'legume'),
    F('lentilsoup', 'Lentil soup', ['lentil soup', 'dal soup', 'lentil stew'], '1 bowl', 5.0, [RS, GOS, CEL], [], 'legume'),
    F('chickpeas', 'Chickpeas', ['chickpeas', 'chickpea', 'garbanzo', 'garbanzo beans', 'chana', 'chana masala', 'chickpea curry'], '1/2 cup cooked', 6.0, [GOS, RS, CEL], [], 'legume'),
    F('hummus', 'Hummus', ['hummus', 'houmous', 'humous'], '2 tbsp', 1.8, [GOS, CEL], [], 'legume'),
    F('falafel', 'Falafel', ['falafel'], '3 pieces', 2.5, [GOS, CEL], [], 'legume'),
    F('blackbeans', 'Black beans', ['black beans', 'black bean', 'refried beans', 'frijoles'], '1/2 cup cooked', 7.5, [RS, GOS], [], 'legume'),
    F('kidney', 'Kidney beans', ['kidney beans', 'kidney bean', 'red beans', 'chilli beans', 'chili beans', 'bean chilli', 'veggie chilli'], '1/2 cup cooked', 5.5, [RS, GOS], [], 'legume'),
    F('bakedbeans', 'Baked beans', ['baked beans', 'beans on toast'], '1/2 tin (200 g)', 7.0, [RS, GOS], [], 'legume'),
    F('beans', 'Beans', ['beans', 'bean', 'mixed beans', 'cannellini', 'cannellini beans', 'butter beans', 'pinto beans', 'haricot beans', 'white beans', 'borlotti'], '1/2 cup cooked', 6.0, [RS, GOS], [], 'legume'),
    F('edamame', 'Edamame', ['edamame', 'soya beans', 'soybeans'], '1/2 cup', 4.0, [GOS, CEL], [], 'legume'),
    F('peas', 'Peas', ['peas', 'pea', 'green peas', 'garden peas', 'petit pois', 'frozen peas', 'split peas'], '1/2 cup', 4.0, [CEL, GOS], [], 'legume'),
    F('tofu', 'Tofu', ['tofu', 'tempeh'], '100 g', 1.0, [], [], 'legume'),

    // ---- vegetables
    F('broccoli', 'Broccoli', ['broccoli', 'tenderstem', 'broccolini'], '1 cup (90 g)', 2.4, [CEL, PEC], [], 'veg'),
    F('carrot', 'Carrot', ['carrot', 'carrots', 'carrot sticks'], '1 medium', 1.7, [PEC, CEL], [], 'veg'),
    F('spinach', 'Spinach', ['spinach'], '1 handful', 0.7, [CEL, POL], [], 'veg'),
    F('kale', 'Kale', ['kale', 'cavolo nero', 'chard', 'collard greens'], '1 cup chopped', 1.0, [CEL, POL], [], 'veg'),
    F('salad', 'Green salad', ['salad', 'green salad', 'side salad', 'mixed salad', 'lettuce', 'leaves', 'salad leaves', 'rocket', 'arugula', 'greens', 'mixed greens', 'cucumber'], '1 bowl', 1.5, [CEL], [], 'veg'),
    F('onion', 'Onion', ['onion', 'onions', 'red onion', 'shallot', 'spring onion', 'scallion', 'caramelised onions'], '1/2 medium', 1.0, [INU], [], 'veg'),
    F('garlic', 'Garlic', ['garlic', 'garlic cloves', 'clove of garlic'], '2 cloves', 0.1, [INU], [], 'veg'),
    F('leek', 'Leek', ['leek', 'leeks', 'leek and potato soup'], '1/2 leek', 1.5, [INU], [], 'veg'),
    F('asparagus', 'Asparagus', ['asparagus'], '5 spears', 1.7, [INU, CEL], [], 'veg'),
    F('jartichoke', 'Jerusalem artichoke', ['jerusalem artichoke', 'jerusalem artichokes', 'sunchoke', 'sunchokes'], '1/2 cup', 1.2, [INU], [], 'veg'),
    F('artichoke', 'Artichoke', ['artichoke', 'globe artichoke', 'artichoke hearts'], '1 medium', 5.0, [INU, CEL], [], 'veg'),
    F('chicory', 'Chicory', ['chicory', 'endive', 'radicchio', 'chicory root'], '1 cup', 1.5, [INU], [], 'veg'),
    F('potato', 'Potato', ['potato', 'jacket potato', 'baked potato', 'mashed potato', 'mash', 'boiled potato', 'roast potatoes', 'roast potato', 'new potatoes'], '1 medium, with skin', 3.5, [CEL], [], 'veg'),
    F('coolpotato', 'Cooled potato', ['potato salad', 'cold potato', 'cooled potato', 'cold potatoes', 'cold potato salad', 'cooled potato salad'], '1 cup', 2.5, [RS, CEL], [], 'veg'),
    F('sweetpotato', 'Sweet potato', ['sweet potato', 'yam'], '1 medium', 3.8, [CEL, PEC], [], 'veg'),
    F('tomato', 'Tomato', ['tomato', 'tomatoes', 'cherry tomatoes', 'tomato sauce', 'passata'], '1 medium', 1.5, [PEC, POL], [], 'veg'),
    F('cauliflower', 'Cauliflower', ['cauliflower', 'cauliflower rice'], '1 cup', 2.0, [CEL], [], 'veg'),
    F('sprouts', 'Brussels sprouts', ['brussels sprouts', 'sprouts', 'brussel sprouts'], '1/2 cup cooked', 2.0, [CEL], [], 'veg'),
    F('cabbage', 'Cabbage', ['cabbage', 'red cabbage', 'coleslaw', 'slaw', 'bok choy', 'pak choi'], '1 cup shredded', 1.8, [CEL], [], 'veg'),
    F('mushroom', 'Mushrooms', ['mushroom', 'mushrooms', 'shiitake'], '1 cup', 0.7, [BG], [], 'veg'),
    F('corn', 'Sweetcorn', ['sweetcorn', 'sweet corn', 'corn', 'corn on the cob'], '1/2 cup', 1.8, [CEL], [], 'veg'),
    F('pepper', 'Bell pepper', ['pepper', 'peppers', 'bell pepper', 'red pepper', 'green pepper', 'capsicum'], '1 medium', 2.0, [CEL], [], 'veg'),
    F('avocado', 'Avocado', ['avocado', 'avo', 'guacamole', 'avocado toast'], '1/2 avocado', 4.5, [CEL, PEC], [], 'veg'),
    F('courgette', 'Courgette', ['courgette', 'zucchini', 'aubergine', 'eggplant'], '1 medium', 2.0, [CEL], [], 'veg'),
    F('beetroot', 'Beetroot', ['beetroot', 'beet', 'beets'], '1 medium', 2.3, [PEC, CEL], [], 'veg'),
    F('greenbeans', 'Green beans', ['green beans', 'french beans', 'runner beans', 'string beans'], '1 cup', 2.7, [CEL], [], 'veg'),
    F('vegsoup', 'Vegetable soup', ['vegetable soup', 'veg soup', 'minestrone', 'soup', 'tomato soup'], '1 bowl', 3.0, [CEL, PEC], [], 'veg'),
    F('stirfry', 'Vegetable stir-fry', ['stir fry', 'stirfry', 'stir fried vegetables', 'vegetables', 'veg', 'veggies', 'mixed vegetables', 'roasted vegetables', 'curry', 'vegetable curry'], '1 cup', 3.0, [CEL], [], 'veg'),

    // ---- fruit
    F('banana', 'Banana', ['banana', 'bananas', 'ripe banana'], '1 medium', 3.0, [PEC], [], 'fruit'),
    F('greenbanana', 'Green banana', ['green banana', 'unripe banana', 'plantain', 'green bananas'], '1 medium', 3.0, [RS, PEC], [], 'fruit'),
    F('apple', 'Apple', ['apple', 'apples', 'green apple'], '1 medium', 4.0, [PEC, POL], [], 'fruit'),
    F('pear', 'Pear', ['pear', 'pears'], '1 medium', 5.5, [PEC], [], 'fruit'),
    F('orange', 'Orange', ['orange', 'oranges', 'satsuma', 'clementine', 'mandarin', 'tangerine', 'grapefruit'], '1 medium', 3.0, [PEC], [], 'fruit'),
    F('blueberries', 'Blueberries', ['blueberries', 'blueberry'], '1/2 cup', 1.8, [PEC, POL], [], 'fruit'),
    F('raspberries', 'Raspberries', ['raspberries', 'raspberry', 'blackberries', 'blackberry'], '1/2 cup', 4.0, [PEC, POL], [], 'fruit'),
    F('strawberries', 'Strawberries', ['strawberries', 'strawberry'], '1 cup', 3.0, [PEC, POL], [], 'fruit'),
    F('berries', 'Mixed berries', ['berries', 'mixed berries', 'frozen berries', 'summer berries', 'cherries', 'cherry'], '1/2 cup', 2.5, [PEC, POL], [], 'fruit'),
    F('kiwi', 'Kiwi', ['kiwi', 'kiwis', 'kiwifruit', 'kiwi fruit'], '1 kiwi', 2.1, [PEC], [], 'fruit'),
    F('grapes', 'Grapes', ['grapes', 'grape'], '1 cup', 1.4, [POL], [], 'fruit'),
    F('mango', 'Mango', ['mango', 'mangoes', 'papaya', 'pineapple', 'melon', 'watermelon'], '1 cup', 2.0, [PEC], [], 'fruit'),
    F('peach', 'Peach', ['peach', 'nectarine', 'plum', 'apricot', 'apricots'], '1 medium', 2.0, [PEC], [], 'fruit'),
    F('prunes', 'Prunes', ['prunes', 'prune', 'dried plums'], '5 prunes', 3.4, [PEC, POL], [], 'fruit'),
    F('dates', 'Dates', ['dates', 'date', 'medjool', 'figs', 'dried figs', 'raisins', 'sultanas', 'dried fruit', 'dried apricots'], '2 dates', 3.0, [PEC, POL], [SUG], 'fruit'),
    F('smoothie', 'Fruit smoothie', ['smoothie', 'fruit smoothie', 'green smoothie'], '1 glass', 3.0, [PEC, POL], [SUG], 'fruit'),
    F('juice', 'Fruit juice', ['juice', 'orange juice', 'apple juice', 'oj', 'fruit juice'], '1 glass', 0.3, [], [SUG], 'drink'),

    // ---- nuts and seeds
    F('almonds', 'Almonds', ['almonds', 'almond'], '1 handful (30 g)', 3.5, [POL, CEL], [], 'nut'),
    F('walnuts', 'Walnuts', ['walnuts', 'walnut', 'pecans'], '1 handful (30 g)', 2.0, [POL], [], 'nut'),
    F('nuts', 'Mixed nuts', ['nuts', 'mixed nuts', 'cashews', 'hazelnuts', 'pistachios', 'brazil nuts', 'peanuts', 'trail mix'], '1 handful (30 g)', 2.5, [POL, CEL], [], 'nut'),
    F('pbutter', 'Peanut butter', ['peanut butter', 'almond butter', 'nut butter'], '1 tbsp', 1.0, [POL, CEL], [], 'nut'),
    F('chia', 'Chia seeds', ['chia', 'chia seeds', 'chia pudding'], '1 tbsp', 4.0, [CEL], [], 'nut'),
    F('flax', 'Ground flaxseed', ['flax', 'flaxseed', 'linseed', 'linseeds', 'ground flaxseed', 'flax seeds'], '1 tbsp', 1.9, [AX, CEL], [], 'nut'),
    F('seeds', 'Seeds', ['seeds', 'pumpkin seeds', 'sunflower seeds', 'sesame seeds', 'mixed seeds', 'tahini'], '1 tbsp', 1.0, [CEL, POL], [], 'nut'),
    F('darkchoc', 'Dark chocolate', ['dark chocolate', '70% chocolate', 'cacao', 'cocoa'], '2 squares (20 g)', 2.0, [POL], [SUG, FAT], 'treat'),
    F('greentea', 'Green tea', ['green tea', 'matcha'], '1 cup', 0, [POL], [], 'drink'),
    F('coffee', 'Coffee', ['coffee', 'latte', 'cappuccino', 'espresso', 'flat white', 'americano', 'tea', 'black tea'], '1 cup', 0, [POL], [], 'drink'),

    // ---- fermented
    F('yogurt', 'Yogurt', ['yogurt', 'yoghurt', 'greek yogurt', 'greek yoghurt', 'natural yogurt', 'skyr'], '1 pot (150 g)', 0, [], [FER], 'fermented'),
    F('kefir', 'Kefir', ['kefir', 'milk kefir', 'water kefir'], '1 glass', 0, [], [FER], 'fermented'),
    F('sauerkraut', 'Sauerkraut', ['sauerkraut', 'kraut'], '2 tbsp', 0.9, [CEL], [FER], 'fermented'),
    F('kimchi', 'Kimchi', ['kimchi', 'kimchee'], '1/2 cup', 1.2, [CEL], [FER], 'fermented'),
    F('miso', 'Miso soup', ['miso', 'miso soup'], '1 bowl', 0.5, [], [FER], 'fermented'),
    F('kombucha', 'Kombucha', ['kombucha'], '1 bottle', 0, [POL], [FER], 'fermented'),

    // ---- low fibre, high fat or sugary
    F('burger', 'Burger', ['burger', 'hamburger', 'cheeseburger', 'beef burger'], '1 burger', 1.5, [], [FAT], 'treat'),
    F('fries', 'Fries', ['fries', 'chips', 'french fries', 'hot chips', 'wedges'], '1 medium portion', 3.0, [CEL], [FAT], 'treat'),
    F('crisps', 'Crisps', ['crisps', 'potato chips', 'tortilla chips', 'nachos', 'doritos'], '1 bag (25 g)', 1.0, [], [FAT], 'treat'),
    F('pizza', 'Pizza', ['pizza', 'pepperoni pizza', 'margherita'], '1 slice', 2.0, [], [FAT], 'treat'),
    F('chocolate', 'Milk chocolate', ['chocolate', 'milk chocolate', 'chocolate bar', 'kitkat', 'snickers'], '1 bar (45 g)', 1.0, [], [SUG, FAT], 'treat'),
    F('cake', 'Cake', ['cake', 'chocolate cake', 'cupcake', 'brownie', 'brownies', 'muffin', 'cheesecake'], '1 slice', 0.5, [], [SUG, FAT], 'treat'),
    F('carrotcake', 'Carrot cake', ['carrot cake', 'banana bread'], '1 slice', 1.5, [], [SUG, FAT], 'treat'),
    F('biscuits', 'Biscuits', ['biscuits', 'biscuit', 'cookies', 'cookie', 'digestives', 'shortbread'], '2 biscuits', 0.6, [], [SUG, FAT], 'treat'),
    F('pastry', 'Pastry', ['croissant', 'pastry', 'pastries', 'danish', 'pain au chocolat', 'doughnut', 'donut', 'pie', 'sausage roll'], '1 piece', 1.0, [], [FAT, SUG], 'treat'),
    F('icecream', 'Ice cream', ['ice cream', 'gelato', 'frozen yogurt'], '1 scoop', 0.4, [], [SUG, FAT], 'treat'),
    F('sweets', 'Sweets', ['sweets', 'candy', 'gummies', 'haribo', 'jam', 'honey', 'syrup'], '1 small bag', 0, [], [SUG], 'treat'),
    F('soda', 'Soda', ['soda', 'cola', 'coke', 'fizzy drink', 'soft drink', 'lemonade', 'pepsi', 'energy drink'], '1 can', 0, [], [SUG], 'drink'),
    F('friedchicken', 'Fried chicken', ['fried chicken', 'chicken nuggets', 'nuggets', 'kfc', 'chicken wings', 'wings'], '1 portion', 0.5, [], [FAT], 'treat'),
    F('bacon', 'Bacon or sausages', ['bacon', 'sausage', 'sausages', 'salami', 'pepperoni', 'hot dog', 'full english', 'fry up'], '2 pieces', 0, [], [FAT], 'protein'),
    F('cheese', 'Cheese', ['cheese', 'cheddar', 'brie', 'mozzarella', 'halloumi', 'feta', 'parmesan'], '30 g', 0, [], [FAT], 'protein'),
    // ---- everyday proteins and staples: no fibre, listed so Flora recognises them
    F('chicken', 'Chicken', ['chicken', 'chicken breast', 'turkey', 'roast chicken'], '1 portion', 0, [], [], 'protein'),
    F('fish', 'Fish', ['fish', 'salmon', 'tuna', 'cod', 'prawns', 'shrimp', 'mackerel', 'sardines'], '1 portion', 0, [], [], 'protein'),
    F('eggs', 'Eggs', ['egg', 'eggs', 'omelette', 'omelet', 'scrambled eggs', 'boiled egg', 'fried egg'], '2 eggs', 0, [], [], 'protein'),
    F('meat', 'Red meat', ['steak', 'beef', 'lamb', 'pork', 'mince'], '1 portion', 0, [], [FAT], 'protein'),
    F('milk', 'Milk', ['milk', 'almond milk', 'soy milk', 'soya milk'], '1 glass', 0, [], [], 'drink')
  ];

  // Generic stand-ins used when the person describes an unknown food by category (approximate).
  var GENERIC = {
    grain: { label: 'Grain or bread', fibreG: 2.5, fibreTypes: [AX, CEL], flags: [] },
    veg: { label: 'Vegetable', fibreG: 2.0, fibreTypes: [CEL], flags: [] },
    fruit: { label: 'Fruit', fibreG: 2.5, fibreTypes: [PEC], flags: [] },
    legume: { label: 'Beans or lentils', fibreG: 6.0, fibreTypes: [GOS, RS], flags: [] },
    nut: { label: 'Nuts or seeds', fibreG: 2.0, fibreTypes: [POL], flags: [] },
    treat: { label: 'A treat', fibreG: 0.5, fibreTypes: [], flags: [SUG, FAT] }
  };

  /* =====================================================================================
     TEXT PARSING
     ===================================================================================== */
  function norm(w) {
    if (w.length < 4) return w;
    if (/sses$/.test(w)) return w.slice(0, -2);
    if (/(ss|us|is)$/.test(w)) return w;
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (/(ches|shes|xes|oes)$/.test(w)) return w.slice(0, -2);
    if (/s$/.test(w)) return w.slice(0, -1);
    if (/ie$/.test(w)) return w.slice(0, -2) + 'y';
    return w;
  }
  function tokenize(text) {
    var s = String(text || '').toLowerCase()
      .replace(/[‘’]/g, "'").replace(/'s\b/g, '').replace(/'/g, '')
      .replace(/&/g, ' and ')
      .replace(/\.(?!\d)/g, ' , ')
      .replace(/[,;!?\n:()]+/g, ' , ')
      .replace(/[^a-z0-9%\/., ]+/g, ' ');
    return s.split(/\s+/).filter(Boolean);
  }

  var INDEX = [];
  FOODS.forEach(function (f) {
    var all = f.syn.concat([f.name.toLowerCase()]);
    var seen = {};
    all.forEach(function (syn) {
      var toks = tokenize(syn).filter(function (t) { return t !== ','; }).map(norm);
      var key = toks.join(' ');
      if (!key || seen[key]) return;
      seen[key] = 1;
      INDEX.push({ toks: toks, food: f });
    });
  });
  INDEX.sort(function (a, b) { return b.toks.length - a.toks.length; });

  var NUMS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    couple: 2, pair: 2, few: 3, several: 3, double: 2, half: 0.5, quarter: 0.25, dozen: 12 };
  var SIZE = { big: 1.5, large: 1.5, huge: 2, generous: 1.5, heaping: 1.3, small: 0.7, tiny: 0.5, mini: 0.5, little: 0.7 };
  var SEPS = { ',': 1, and: 1, with: 1, then: 1, plus: 1, also: 1, or: 1, followed: 1, after: 1, before: 1 };
  var STOP = ('i im ive id me my we our us you your it its this that these those there here is was were be been am are ' +
    'had have has having ate eaten eat eating drank drink drinking got grabbed made make cooked cook tried enjoyed snacked ' +
    'some any of the for to on in at by from into onto over under as so very really quite just only about around roughly ' +
    'maybe perhaps probably think guess like lot lots bit bits piece pieces bowl bowlful bowls cup cups mug mugs glass ' +
    'slice slices plate plateful plates handful handfuls portion portions serving servings tin tins can cans pot pots jar ' +
    'spoon spoonful spoonfuls tbsp tsp tablespoon tablespoons teaspoon teaspoons scoop scoops square squares bar bars ' +
    'bag bags pack packet box sprinkle dash drizzle side g gram grams kg ml oz ' +
    'breakfast lunch dinner supper brunch snack snacks dessert pudding meal meals tea-time morning afternoon evening night ' +
    'tonight today yesterday earlier later now lunchtime dinnertime midday first second last next then too again ' +
    'hi hello hey hiya flora thanks thank yes no yeah yep nope ok okay please well oh um uh hmm ' +
    'fresh homemade home cooked raw roasted roast steamed boiled grilled baked toasted sliced chopped mashed stewed pan ' +
    'warm hot cold iced plain natural greek organic whole wholegrain wholemeal wholewheat brown white red green yellow mixed ' +
    'topped top up out off delicious yummy tasty nice good lovely great amazing healthy light quick leftover leftovers ' +
    'low fat free extra more less much many all both each other own sort kind type bunch load loads full ' +
    'bake stew dish casserole traybake not dont didnt nothing none yet still what which who how when where why because but if than').split(/\s+/);
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; STOPSET[norm(w)] = 1; });
  Object.keys(NUMS).forEach(function (w) { STOPSET[w] = 1; });
  Object.keys(SIZE).forEach(function (w) { STOPSET[w] = 1; });
  Object.keys(SEPS).forEach(function (w) { STOPSET[w] = 1; });

  function numVal(tok) {
    if (NUMS.hasOwnProperty(tok)) return NUMS[tok];
    var m = tok.match(/^(\d+)\/(\d+)$/); if (m) return +m[1] / +m[2];
    m = tok.match(/^x?(\d+(?:\.\d+)?)x?$/); if (m) return +m[1];
    return null;
  }

  // parseMeal("porridge with berries and a banana") -> { items:[{food, qty}], unknown:['phrase'] }
  function parseMeal(text) {
    var raw = tokenize(text);
    var toks = raw.map(norm);
    var used = new Array(toks.length);
    var items = [];
    var prevEnd = 0;
    for (var i = 0; i < toks.length; i++) {
      var hit = null;
      for (var k = 0; k < INDEX.length; k++) {
        var e = INDEX[k], ok = true;
        if (i + e.toks.length > toks.length) continue;
        for (var j = 0; j < e.toks.length; j++) { if (toks[i + j] !== e.toks[j]) { ok = false; break; } }
        if (ok) { hit = e; break; }
      }
      if (!hit) continue;
      // look back for a quantity, never crossing a separator or the previous food
      var num = null, mult = 1;
      for (var b = i - 1; b >= Math.max(prevEnd, i - 5); b--) {
        var tk = raw[b];
        if (SEPS[tk]) break;
        var nv = numVal(tk);
        if (nv != null && tk !== 'a' && tk !== 'an') { num = num == null ? nv : num * nv; }
        if (SIZE[tk]) mult *= SIZE[tk];
      }
      var qty = (num == null ? 1 : num) * mult;
      qty = Math.max(0.25, Math.min(qty, 12));
      for (var u = i; u < i + hit.toks.length; u++) used[u] = 1;
      var existing = null;
      items.forEach(function (it) { if (it.food.id === hit.food.id) existing = it; });
      if (existing) existing.qty += qty; else items.push({ food: hit.food, qty: qty });
      i += hit.toks.length - 1;
      prevEnd = i + 1;
    }
    // leftovers that look like content words become "unknown" phrases
    var unknown = [], cur = [];
    function flush() { if (cur.length) { unknown.push(cur.join(' ')); cur = []; } }
    for (var x = 0; x < raw.length; x++) {
      var w = raw[x];
      if (used[x] || SEPS[w] || STOPSET[w] || STOPSET[toks[x]] || /\d/.test(w) || w.length < 3 || !/^[a-z]+$/.test(w)) { flush(); continue; }
      cur.push(w);
      if (cur.length >= 3) flush();
    }
    flush();
    return { items: items, unknown: unknown.slice(0, 3) };
  }

  /* ---- feelings */
  var FEEL_LABEL = { great: 'Great', normal: 'Normal', bloated: 'Bloated', gassy: 'Gassy', cramps: 'Cramps',
    'low-energy': 'Low energy', constipated: 'Constipated', loose: 'Loose' };
  var FEEL_ORDER = ['great', 'normal', 'bloated', 'gassy', 'cramps', 'low-energy', 'constipated', 'loose'];
  var FEEL_WORDS = {
    great: /\b(great|good|amazing|fantastic|wonderful|brilliant|energi[sz]ed|light|awesome|excellent|happy|lovely)\b/,
    normal: /\b(normal|fine|ok|okay|alright|all right|nothing (special|much)|usual|same as always|meh)\b/,
    bloated: /\b(bloat|bloated|bloating|puffy|swollen|distended|heavy)\b/,
    gassy: /\b(gas|gassy|wind|windy|farty|farting|flatulen\w*|burp\w*|toot\w*)\b/,
    cramps: /\b(cramp|cramps|cramping|crampy|pain|painful|ache|aching|achy|stomach ?ache|tummy ?ache|sore|hurt|hurts|hurting)\b/,
    'low-energy': /\b(low energy|tired|sluggish|exhausted|sleepy|drained|lethargic|fatigued?|groggy|crash\w*)\b/,
    constipated: /\b(constipat\w*|blocked|backed up|bunged|couldnt go|straining)\b/,
    loose: /\b(loose|diarrh\w*|runny|the runs|watery)\b/
  };
  var WORRY = /\b(blood|bloody|bleeding|black stool|black poo|tarry|severe|agony|agonising|agonizing|excruciating|unbearable|doubled over|vomit\w*|throwing up|fever|weight loss|losing weight|for (weeks|months)|every day|everyday|persistent|wont go away|keeps coming back|getting worse)\b/;

  function parseFeelings(text) {
    var s = ' ' + String(text || '').toLowerCase().replace(/[^a-z\s'-]/g, ' ').replace(/'/g, '') + ' ';
    var tags = [];
    FEEL_ORDER.forEach(function (tag) {
      var re = FEEL_WORDS[tag];
      var m = s.match(re);
      if (!m) return;
      var before = s.slice(Math.max(0, m.index - 14), m.index);
      if (/\b(not|no|wasnt|isnt|without|never|zero)\s+(at all\s+|really\s+|very\s+|too\s+)?$/.test(before)) return;
      tags.push(tag);
    });
    if (tags.indexOf('great') >= 0 && tags.length > 1 && /\b(not great|not good)\b/.test(s)) tags.splice(tags.indexOf('great'), 1);
    return { tags: tags, worry: WORRY.test(s) };
  }

  /* =====================================================================================
     COPY HELPERS
     ===================================================================================== */
  function r1(n) { return Math.round(n * 10) / 10; }
  function gramsWord(g) {
    if (g <= 0) return 'no fibre to speak of';
    if (g < 1) return 'under 1 g';
    return 'about ' + Math.round(g) + ' g';
  }
  function listJoin(arr) {
    if (arr.length <= 1) return arr.join('');
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var COUNTABLE = /^(slice|cup|clove|spear|wrap|piece|scoop|square|biscuit|can|glass|bowl|pot|date|prune|egg|bagel|sandwich|burger|kiwi|portion|handful|bar|bag|bottle|crispbread|cracker|medium|tbsp)$/;
  function fmtNum(n) {
    var map = { 0.25: '1/4', 0.5: '1/2', 0.75: '3/4', 1.5: '1 1/2', 2.5: '2 1/2' };
    if (map[n]) return map[n];
    return String(r1(n));
  }
  // "1 slice" x2 -> "2 slices"; "40 g dry" x1.5 -> "60 g dry"
  function scaleServing(label, qty) {
    if (qty === 1) return label;
    var m = label.match(/^(\d+(?:\/\d+)?)\s+(\S+)(.*)$/);
    if (!m) return fmtNum(qty) + ' x ' + label;
    var base = m[1].indexOf('/') > 0 ? (+m[1].split('/')[0] / +m[1].split('/')[1]) : +m[1];
    var n = base * qty;
    var unit = m[2];
    if (unit !== 'g' && n > 1 && COUNTABLE.test(unit)) unit = /(ch|sh|ss|x)$/.test(unit) ? unit + 'es' : (unit === 'medium' || unit === 'tbsp' ? unit : unit + 's');
    return fmtNum(r1(n)) + ' ' + unit + m[3];
  }
  function makeFoodItem(food, qty) {
    return {
      name: food.name, serving: scaleServing(food.serving, qty),
      fibreG: r1(food.fibreG * qty), fibreTypes: food.fibreTypes.slice(), flags: food.flags.slice(),
      _id: food.id, _qty: qty, _cat: food.cat
    };
  }
  function totalOf(foods) { return r1(foods.reduce(function (s, f) { return s + (f.fibreG || 0); }, 0)); }

  // Which community members benefit. Modest, real biology, keyed by dominant fibre type.
  var BENEFIT = {
    'beta-glucan': ['Your Bacteroides are going to love the beta-glucan.', 'Beta-glucan is a favourite of Bacteroides and Segatella in the Fibre Fields.'],
    'arabinoxylan': ['Bacteroides and Segatella are well equipped to take apart that arabinoxylan.'],
    'resistant-starch': ['Ruminococcus bromii gets first go at resistant starch, then shares with the butyrate makers.'],
    'inulin-fos': ['Inulin is a treat for your Bifidobacteria.'],
    'gos': ['The GOS in there tends to feed your Bifidobacteria.'],
    'pectin': ['Pectin gets shared out between Bacteroides and Faecalibacterium.'],
    'cellulose': ['That fibre mostly adds bulk, which helps keep things moving.'],
    'polyphenols': ['A few specialists, like Eggerthella, can transform the polyphenols.']
  };
  function benefitLine(foods) {
    var w = {};
    foods.forEach(function (f) {
      var types = f.fibreTypes || [];
      types.forEach(function (t) { w[t] = (w[t] || 0) + (f.fibreG || 0.2) / types.length + (t === 'polyphenols' ? 0 : 0.01); });
    });
    var keys = Object.keys(w).sort(function (a, b) { return w[b] - w[a]; });
    // cellulose is the least interesting story; prefer a fermentable type if close
    if (keys[0] === 'cellulose' && keys[1] && w[keys[1]] > w.cellulose * 0.5) keys.shift();
    return keys.length ? pick(BENEFIT[keys[0]]) : '';
  }
  function flagLine(foods, total) {
    var fat = foods.filter(function (f) { return f.flags.indexOf('high-fat') >= 0 && f.fibreG < 2.5; });
    var fer = foods.filter(function (f) { return f.flags.indexOf('fermented') >= 0; });
    var sug = foods.filter(function (f) { return f.flags.indexOf('sugar') >= 0 && f.fibreG < 1; });
    if (fat.length && total < 8) return 'The ' + fat[0].name.toLowerCase() + ' is more of a treat for the sulfur reducers down in the Springs, so some fibre alongside helps keep things balanced.';
    if (fer.length) return 'And the ' + fer[0].name.toLowerCase() + ' brings some fermented friends along for the visit.';
    if (sug.length && total < 5) return 'Sugar is mostly absorbed before it reaches us, so there’s not much in it for my fibre fans.';
    return '';
  }

  function greeting(hour) {
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 22) return 'Good evening';
    return 'Hello, night owl';
  }

  /* =====================================================================================
     FloraBrain: the scripted dialogue engine.

     INTERFACE (a Claude-backed brain must implement exactly this):

       FloraBrain.start(ctx) -> Response
       FloraBrain.reply(ctx, userText) -> Response

       ctx (plain, JSON-serialisable conversation memory; the brain may mutate it):
         phase        'idle'|'ask-food'|'clarify'|'confirm'|'ask-feel'|'saved'
         hour         local hour 0..23 (set by the UI before every call)
         todayFibreG  grams already saved today, excluding the current draft (set by the UI)
         entriesCount number of logbook entries ever saved (set by the UI)
         draft        { foods: [Entry food], unknown: ['phrase'] }   foods may be edited by the UI (chip removal)
         lastEntry    the most recently saved Entry or null
         history      [{ who:'flora'|'you', text }]  (kept by the UI, useful as LLM context)

       Response:
         say      [string]  Flora's lines, shown in order, in her serif voice
         chips    [Chip]    quick replies. Chip = { label, value?, kind:'send'|'toggle'|'action', primary?, hero?, action? }
                            'send' sends value||label as the user's text; 'toggle' is a multi-select feeling tag
                            (value = tag); 'action' runs a UI action: 'world' | 'logbook'
         state    { mood:'happy'|'curious'|'thinking'|'excited', hop?:bool }  Flora's look, passed to FloraCast.drawFlora
         ui       optional widget: { type:'idle' } | { type:'foods' } (renders ctx.draft.foods as removable chips)
                  | { type:'feelings' } | { type:'saved' }
         entry    optional Entry (contract format). When present the UI saves it via FloraApp.saveEntry(entry)
         done     true when the log is complete
         action   optional 'world' | 'logbook' to run immediately

     ---- WHERE THE REAL AI PLUGS IN ----------------------------------------------------------
     Plan: a small backend (e.g. POST /api/flora) calls the Claude API with a system prompt that holds
     Flora's persona, the food dictionary and fibre biology above, and the Response schema as a tool /
     JSON output format. The browser would then do:
         FloraChat.setBrain({
           start: function (ctx) { return ScriptedBrain.start(ctx); },
           reply: function (ctx, text) { return fetch('/api/flora', { method:'POST', body: JSON.stringify({ ctx, text }) })
                                                  .then(function (r) { return r.json(); }); }   // -> Response
         });
     The UI already accepts a Promise from reply(). Send entries in the POST body only, never in URLs.
     Keep the scripted brain as the offline fallback. No external API is called in this prototype.
     ------------------------------------------------------------------------------------------- */
  var CHIPS_FOOD = ['Porridge', 'Wholegrain toast', 'Banana', 'Apple', 'Lentil soup', 'Salad', 'Chickpeas', 'Berries'];
  var YES = /^(yes|yeah|yep|yup|correct|right|thats right|that is right|looks (good|right)|perfect|exactly|spot on|ok|okay|sure|confirm|all good|good|great|lovely|thats it)\b/;
  var NO_RESTART = /\b(start over|start again|restart|wrong|clear|reset|none of (that|those))\b|^no\b/;
  var ADD_MORE = /\b(add (something|more|another)|something else|log (more|something|another)|another (one|meal)|more food|i also had|also had)\b/;
  var SKIP = /^(skip|skip it|skip this|pass|never ?mind|ignore( it)?|dont know|not sure|no idea)\b/;
  var GREET = /\b(hi|hello|hey|hiya|howdy|yo|morning|evening|afternoon)\b/;
  var WORLD = /\b(world|community|show me|see (them|how|it)|lets go|go see)\b/;
  var LOGBOOK = /\b(log ?book|history|my logs|past entries|entries)\b/;

  function R(say, chips, mood, extra) {
    var o = { say: say.filter(Boolean), chips: chips || [], state: { mood: mood || 'happy' } };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function sendChips(labels) { return labels.map(function (l) { return { label: l, kind: 'send' }; }); }

  var ScriptedBrain = {
    start: function (ctx) {
      ctx.phase = 'idle';
      ctx.draft = { foods: [], unknown: [] };
      return R([], [{ label: 'Hi Flora!', kind: 'send', primary: true, hero: true }], 'happy', { ui: { type: 'idle' } });
    },

    reply: function (ctx, userText) {
      var text = String(userText || '').trim();
      var low = text.toLowerCase().replace(/[’']/g, '').replace(/[.!?]+$/, '');
      ctx.draft = ctx.draft || { foods: [], unknown: [] };

      if (LOGBOOK.test(low) && low.split(/\s+/).length <= 4) {
        return R(['Here’s your logbook.'], this._chipsFor(ctx), 'happy', { action: 'logbook', ui: this._uiFor(ctx) });
      }

      switch (ctx.phase) {
        case 'idle': {
          var p0 = parseMeal(text);
          if (p0.items.length) return this._takeFoods(ctx, p0, [greeting(ctx.hour) + '.']);
          return this._askFood(ctx, true);
        }
        case 'ask-food': {
          if (SKIP.test(low) && !ctx.draft.foods.length) {
            return R(['That’s alright. Whenever you’ve eaten something, I’d love to hear about it.'],
              sendChips(CHIPS_FOOD.slice(0, 6)), 'happy', {});
          }
          if (NO_RESTART.test(low) && ctx.draft.foods.length) { ctx.draft.foods = []; }
          var p = parseMeal(text);
          if (!p.items.length && !p.unknown.length) {
            if (ctx.draft.foods.length) return this._confirm(ctx, []);
            return R(['Even a rough guess helps.', 'Was there any bread, fruit, vegetables or beans today?'],
              sendChips(CHIPS_FOOD), 'curious');
          }
          return this._takeFoods(ctx, p, []);
        }
        case 'clarify': {
          var phrase = ctx.draft.unknown[0];
          var catHit = this._category(low);
          var pre;
          if (catHit) {
            var gen = GENERIC[catHit];
            ctx.draft.foods.push({ name: cap(phrase), serving: '1 portion (estimate)', fibreG: gen.fibreG,
              fibreTypes: gen.fibreTypes.slice(), flags: gen.flags.slice(), _id: 'custom-' + phrase, _qty: 1, _cat: catHit });
            pre = 'Got it. I’ll count ' + phrase + ' as ' + (catHit === 'treat' ? 'a treat' : 'a ' + gen.label.toLowerCase().replace(/^beans or lentils$/, 'kind of bean or lentil').replace(/^nuts or seeds$/, 'kind of nut or seed').replace(/^grain or bread$/, 'grain')) + '.';
          } else {
            var pc = parseMeal(text);
            if (pc.items.length && !SKIP.test(low)) {
              pc.items.forEach(function (it) { ctx.draft.foods.push(makeFoodItem(it.food, it.qty)); });
              pre = 'Thank you, that helps.';
            } else {
              pre = SKIP.test(low) ? 'No problem, we’ll leave it out.' : 'I’ll leave that one out for now.';
            }
          }
          ctx.draft.unknown.shift();
          if (ctx.draft.unknown.length) return this._clarify(ctx, [pre]);
          if (!ctx.draft.foods.length) { ctx.phase = 'ask-food'; return R([pre, 'What else did you eat?'], sendChips(CHIPS_FOOD), 'curious'); }
          return this._confirm(ctx, [pre]);
        }
        case 'confirm': {
          if (!ctx.draft.foods.length || NO_RESTART.test(low)) {
            ctx.draft = { foods: [], unknown: [] };
            ctx.phase = 'ask-food';
            return R(['No problem, let’s try again.', 'What did you eat?'], sendChips(CHIPS_FOOD), 'curious');
          }
          if (YES.test(low)) return this._askFeel(ctx);
          if (ADD_MORE.test(low) && !parseMeal(low.replace(ADD_MORE, '')).items.length) {
            ctx.phase = 'ask-food';
            return R(['Lovely. What else did you have?'], sendChips(CHIPS_FOOD), 'curious');
          }
          var rm = low.match(/^(remove|delete|take out|without|minus|not the|no)\s+(.+)$/);
          if (rm) {
            var pr = parseMeal(rm[2]);
            var ids = pr.items.map(function (it) { return it.food.id; });
            var before = ctx.draft.foods.length;
            ctx.draft.foods = ctx.draft.foods.filter(function (f) { return ids.indexOf(f._id) < 0; });
            if (ctx.draft.foods.length !== before) return this._confirm(ctx, ['Done, I’ve taken that out.']);
          }
          var pm = parseMeal(text);
          if (pm.items.length || pm.unknown.length) return this._takeFoods(ctx, pm, []);
          return this._askFeel(ctx);
        }
        case 'ask-feel': {
          var parts = text.split(/\s+—\s+/);
          var tagPart = parts[0] || '';
          var note = parts.length > 1 ? parts.slice(1).join(' ').trim() : '';
          if (SKIP.test(low) || low === 'save entry' || low === '') {
            return this._save(ctx, { tags: [], note: '' }, false);
          }
          var fp = parseFeelings(text);
          if (parts.length === 1) {
            var chipOnly = tagPart.split(/,\s*/).every(function (s) {
              return FEEL_ORDER.some(function (t) { return FEEL_LABEL[t].toLowerCase() === s.trim().toLowerCase(); });
            });
            if (!chipOnly) note = text;
          }
          return this._save(ctx, { tags: fp.tags, note: note.slice(0, 280) }, fp.worry);
        }
        case 'saved': {
          if (WORLD.test(low)) return R(['Let’s go and see.'], this._chipsFor(ctx), 'excited', { action: 'world', ui: { type: 'saved' } });
          var ps = parseMeal(text);
          ctx.draft = { foods: [], unknown: [] };
          if (ps.items.length) return this._takeFoods(ctx, ps, []);
          if (/\b(thank|thanks|cheers|bye|goodbye|night)\b/.test(low)) {
            return R(['Any time. Your community and I will be right here.'], this._chipsFor(ctx), 'happy', { ui: { type: 'saved' } });
          }
          ctx.phase = 'ask-food';
          return R(['Lovely. What else did you eat?'], sendChips(CHIPS_FOOD), 'curious');
        }
      }
      return this._askFood(ctx, true);
    },

    _category: function (low) {
      if (/\b(grain|bread|cereal|pasta|rice|wheat|oat)\b/.test(low)) return 'grain';
      if (/\b(veg|vegetable|vegetables|veggie|greens|salad)\b/.test(low)) return 'veg';
      if (/\b(fruit|fruits|berry)\b/.test(low)) return 'fruit';
      if (/\b(bean|beans|lentil|lentils|legume|legumes|pulse|pulses|pea)\b/.test(low)) return 'legume';
      if (/\b(nut|nuts|seed|seeds)\b/.test(low)) return 'nut';
      if (/\b(treat|sweet|dessert|snack|takeaway|fast food|junk)\b/.test(low)) return 'treat';
      return null;
    },

    _askFood: function (ctx, greet) {
      ctx.phase = 'ask-food';
      var lines = [];
      if (greet) {
        var g = greeting(ctx.hour);
        if (!ctx.entriesCount) lines.push(g + '. I’m Flora, the voice of your gut community.');
        else lines.push(g + '. Lovely to see you again.');
      }
      if (ctx.todayFibreG > 0) lines.push('You’re at ' + Math.round(ctx.todayFibreG) + ' g of fibre so far today. What else have you eaten?');
      else lines.push('What fibre have you eaten today? Tell me in your own words.');
      return R(lines, sendChips(CHIPS_FOOD), greet ? 'excited' : 'curious', { state: { mood: greet ? 'excited' : 'curious', hop: !!greet } });
    },

    _takeFoods: function (ctx, parsed, pre) {
      parsed.items.forEach(function (it) {
        var same = null;
        ctx.draft.foods.forEach(function (f) { if (f._id === it.food.id) same = f; });
        if (same) {
          var q = same._qty + it.qty, fresh = makeFoodItem(it.food, q);
          for (var k in fresh) same[k] = fresh[k];
        } else ctx.draft.foods.push(makeFoodItem(it.food, it.qty));
      });
      ctx.draft.unknown = parsed.unknown.slice();
      if (ctx.draft.unknown.length) return this._clarify(ctx, pre);
      return this._confirm(ctx, pre);
    },

    _clarify: function (ctx, pre) {
      ctx.phase = 'clarify';
      var phrase = ctx.draft.unknown[0];
      var lines = (pre || []).slice();
      lines.push('I don’t know “' + phrase + '” yet. What’s it most like?');
      var chips = Object.keys(GENERIC).map(function (k) { return { label: GENERIC[k].label, kind: 'send' }; });
      chips.push({ label: 'Skip it', kind: 'send' });
      return R(lines, chips, 'curious', { ui: ctx.draft.foods.length ? { type: 'foods' } : null });
    },

    _confirm: function (ctx, pre) {
      ctx.phase = 'confirm';
      var foods = ctx.draft.foods, total = totalOf(foods);
      var named = foods.map(function (f) { return f.name.toLowerCase(); });
      var itemsLine;
      if (foods.length <= 3) {
        var parts = foods.map(function (f) { return f.name.toLowerCase() + ', ' + gramsWord(f.fibreG); });
        itemsLine = cap(parts.length > 1 ? parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1] : parts[0]) + '.';
        if (foods.length === 1) itemsLine = cap(named[0]) + ', ' + gramsWord(foods[0].fibreG) + ' of fibre.';
      } else {
        itemsLine = 'I heard ' + foods.length + ' things, all listed below.';
      }
      var totalLine;
      if (total >= 1) totalLine = (foods.length > 1 ? 'That’s ' + (Math.round(total) === total ? '' : 'about ') + Math.round(total) + ' g of fibre. ' : '');
      else totalLine = 'Not much fibre in that, but every log helps me learn your patterns. ';
      var bio = total >= 0.5 ? benefitLine(foods) : '';
      var extra = flagLine(foods, total);
      var second = (totalLine + bio).trim();
      var lines = (pre || []).concat([itemsLine, second || null, extra || null]);
      var mood = total >= 8 ? 'excited' : 'happy';
      return R(lines, [
        { label: 'That’s right', value: 'yes', kind: 'send', primary: true },
        { label: 'Add something', value: 'add something', kind: 'send' },
        { label: 'Start over', value: 'start over', kind: 'send' }
      ], mood, { ui: { type: 'foods' } });
    },

    _askFeel: function (ctx) {
      ctx.phase = 'ask-feel';
      var chips = FEEL_ORDER.map(function (t) { return { label: FEEL_LABEL[t], value: t, kind: 'toggle' }; });
      return R(['Thank you.', 'And how did you feel afterwards?'], chips, 'curious', { ui: { type: 'feelings' } });
    },

    _save: function (ctx, feelings, worry) {
      var foods = ctx.draft.foods.map(function (f) {
        return { name: f.name, serving: f.serving, fibreG: r1(f.fibreG), fibreTypes: f.fibreTypes.slice(), flags: f.flags.slice() };
      });
      var entry = {
        id: 'e-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        time: new Date().toISOString(),
        foods: foods,
        totalFibreG: totalOf(foods),
        feelings: { tags: feelings.tags, note: feelings.note || '' }
      };
      ctx.lastEntry = entry;
      ctx.phase = 'saved';
      ctx.draft = { foods: [], unknown: [] };
      var t = feelings.tags, lines = [];
      var has = function (x) { return t.indexOf(x) >= 0; };
      var sym = t.filter(function (x) { return x !== 'great' && x !== 'normal'; });
      if (!t.length) lines.push(feelings.note ? 'Thank you for telling me.' : 'No problem.');
      else if (!sym.length && has('great')) lines.push(pick(['That’s wonderful to hear.', 'I love that for you.']));
      else if (!sym.length) lines.push('Steady and normal is a good place to be.');
      else {
        var bits = [];
        if (has('bloated') || has('gassy')) bits.push('A little bloating or gas can simply mean we’re busy fermenting fibre. Building up slowly and drinking water usually helps.');
        if (has('cramps')) bits.push('I’m sorry about the cramps. Rest and a warm drink can be soothing.');
        if (has('constipated')) bits.push('Water, gentle movement and steady fibre often help things along.');
        if (has('loose')) bits.push('Be gentle with yourself today and keep sipping fluids.');
        if (has('low-energy') && bits.length < 2) bits.push('Low energy has many causes, so rest where you can.');
        lines.push(bits.slice(0, 2).join(' '));
      }
      if (worry || (has('cramps') && /\b(severe|days|week)/i.test(feelings.note || ''))) {
        lines.push('If the pain is severe or keeps coming back, or you notice any blood, please check in with a doctor. I’m only a microbe, not a medic.');
      }
      var today = r1((ctx.todayFibreG || 0) + entry.totalFibreG);
      var togo = Math.max(0, GOAL_G - today);
      lines.push('Saved to your logbook. ' + (togo <= 0 ? 'You’ve reached ' + GOAL_G + ' g today, and your community is thriving.'
        : 'That brings today to ' + Math.round(today) + ' g of your ' + GOAL_G + ' g.'));
      return R(lines, this._chipsFor(ctx), 'excited', { ui: { type: 'saved' }, entry: entry, done: true, state: { mood: 'excited', hop: true } });
    },

    _uiFor: function (ctx) {
      return { 'confirm': { type: 'foods' }, 'ask-feel': { type: 'feelings' }, 'saved': { type: 'saved' }, 'idle': { type: 'idle' } }[ctx.phase] || null;
    },
    _chipsFor: function (ctx) {
      if (ctx.phase === 'saved') {
        return [
          { label: 'See how your community reacts', kind: 'action', action: 'world', primary: true },
          { label: 'Log something else', value: 'log something else', kind: 'send' }
        ];
      }
      if (ctx.phase === 'idle') return [{ label: 'Hi Flora!', kind: 'send', primary: true, hero: true }];
      return sendChips(CHIPS_FOOD);
    }
  };

  var FloraBrain = ScriptedBrain;

  /* =====================================================================================
     CSS (scoped under .fc-root)
     ===================================================================================== */
  var CSS = [
    '.fc-root{--fc-sage:var(--sage,#5A7A66);--fc-sage-deep:var(--sage-deep,#3D5A48);--fc-sage-soft:var(--sage-soft,#DCE5DD);',
    '--fc-cream:var(--cream,#F3EEE6);--fc-paper:var(--paper,#FBF8F3);--fc-ink:var(--ink,#24302A);--fc-muted:var(--muted,#6B7A70);',
    '--fc-line:var(--line,rgba(36,48,42,.12));--fc-serif:"Instrument Serif",Georgia,"Times New Roman",serif;',
    '--fc-sans:"Figtree",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;',
    '--fc-shadow:0 1px 2px rgba(36,48,42,.04),0 8px 24px -10px rgba(36,48,42,.14);',
    '--fc-shadow-lg:0 1px 2px rgba(36,48,42,.04),0 24px 60px -24px rgba(36,48,42,.28);',
    '--fc-ease:cubic-bezier(.2,.7,.2,1);',
    'position:absolute;inset:0;overflow:hidden;background:var(--fc-paper);color:var(--fc-ink);font-family:var(--fc-sans);',
    'font-size:16px;line-height:1.45;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-tap-highlight-color:transparent}',
    '.fc-root *,.fc-root *::before,.fc-root *::after{box-sizing:border-box}',
    '.fc-root button{font-family:inherit;color:inherit}',
    '.fc-bg{position:absolute;inset:0;pointer-events:none;background:',
    'radial-gradient(70% 46% at 50% 20%,rgba(220,229,221,.62),rgba(220,229,221,0) 72%),',
    'radial-gradient(60% 40% at 50% 108%,rgba(243,238,230,1),rgba(243,238,230,0) 70%)}',
    '.fc-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:thin}',
    '.fc-top{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;height:68px;padding:0 16px}',
    '.fc-wordmark{font-family:var(--fc-serif);font-style:italic;font-weight:400;font-size:27px;letter-spacing:-.01em;color:var(--fc-sage-deep);margin:0;line-height:1}',
    '.fc-iconbtn{position:absolute;right:16px;top:14px;width:42px;height:42px;border-radius:50%;border:1px solid var(--fc-line);',
    'background:rgba(255,255,255,.66);display:grid;place-items:center;cursor:pointer;box-shadow:var(--fc-shadow);',
    'transition:transform .25s var(--fc-ease),background .25s,border-color .25s;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}',
    '.fc-iconbtn:hover{background:#fff;border-color:rgba(90,122,102,.4);transform:translateY(-1px)}',
    '.fc-iconbtn svg{width:19px;height:19px}',
    '.fc-iconbtn .fc-dot{position:absolute;top:8px;right:8px;width:7px;height:7px;border-radius:50%;background:var(--fc-sage);box-shadow:0 0 0 2px var(--fc-paper);opacity:0;transition:opacity .3s}',
    '.fc-iconbtn.fc-has-new .fc-dot{opacity:1}',
    '.fc-col{position:relative;z-index:1;max-width:640px;margin:0 auto;min-height:calc(100% - 68px);display:flex;flex-direction:column;align-items:center;',
    'padding:clamp(0px,2vh,24px) 20px calc(28px + env(safe-area-inset-bottom,0px))}',
    '.fc-stage{--fc-size:clamp(250px,72vw,300px);position:relative;width:var(--fc-size);height:var(--fc-size);flex:none;',
    'transition:width .8s var(--fc-ease),height .8s var(--fc-ease)}',
    '.fc-root.fc-compact .fc-stage{--fc-size:250px}',
    // halo: a warm pool of light matching the artwork background, ringed by a faint sage glow
    '.fc-halo{position:absolute;inset:-14%;border-radius:50%;pointer-events:none;background:',
    'radial-gradient(closest-side,rgba(234,224,207,.95) 0%,rgba(236,228,213,.85) 38%,rgba(226,231,220,.55) 62%,rgba(220,229,221,.22) 80%,rgba(220,229,221,0) 100%);',
    'animation:fc-breathe 7s ease-in-out infinite}',
    '.fc-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}',
    '.fc-stage.fc-img canvas{display:none}',
    '.fc-fig{position:absolute;inset:-8%;transform-origin:50% 88%;will-change:transform;pointer-events:none}',
    '.fc-fig img{display:block;width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity .9s ease;user-select:none;-webkit-user-drag:none;',
    '-webkit-mask-image:radial-gradient(closest-side,#000 68%,rgba(0,0,0,.6) 84%,transparent 100%);mask-image:radial-gradient(closest-side,#000 68%,rgba(0,0,0,.6) 84%,transparent 100%)}',
    '.fc-stage.fc-img .fc-fig img{opacity:1}',
    '.fc-stage:not(.fc-img) .fc-fig,.fc-stage:not(.fc-img) .fc-shadow{display:none}',
    '.fc-shadow{position:absolute;left:29%;width:42%;top:89.5%;height:7%;border-radius:50%;pointer-events:none;will-change:transform,opacity;',
    'background:radial-gradient(closest-side,rgba(58,66,50,.26),rgba(58,66,50,.1) 60%,rgba(58,66,50,0))}',
    '.fc-sparks{position:absolute;inset:0;pointer-events:none;overflow:visible}',
    '.fc-spark{position:absolute;left:50%;top:34%;width:var(--s,10px);height:var(--s,10px);margin:calc(var(--s,10px)/-2) 0 0 calc(var(--s,10px)/-2);',
    'background:var(--c,#fff);clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%);opacity:0;',
    'animation:fc-spark var(--d,900ms) cubic-bezier(.15,.7,.3,1) var(--w,0ms) forwards}',
    '.fc-spark.fc-dot{clip-path:none;border-radius:50%}',
    '@keyframes fc-spark{0%{opacity:0;transform:translate(0,0) scale(.2) rotate(0)}25%{opacity:1}',
    '100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1) rotate(80deg)}}',
    '.fc-echo{min-height:22px;margin:2px 0 6px;font-size:14px;color:var(--fc-muted);text-align:center;max-width:34ch;',
    'opacity:0;transform:translateY(4px);transition:opacity .5s,transform .5s var(--fc-ease);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.fc-echo.fc-on{opacity:1;transform:none}',
    '.fc-say{margin:0;max-width:21em;text-align:center;font-family:var(--fc-serif);font-style:italic;font-weight:400;',
    'font-size:clamp(28px,7.4vw,40px);line-height:1.14;letter-spacing:-.012em;color:var(--fc-ink);transition:opacity .35s}',
    '.fc-say p{margin:0 0 .32em;text-wrap:balance}',
    '.fc-say p:last-child{margin-bottom:0}',
    '.fc-say.fc-m{font-size:clamp(25px,6.3vw,34px)}',
    '.fc-say.fc-s{font-size:clamp(22px,5.5vw,29px)}',
    '.fc-say.fc-xs{font-size:clamp(20px,5vw,26px)}',
    '.fc-say.fc-dim{opacity:.32}',
    '.fc-say p.fc-quiet{font-family:var(--fc-sans);font-style:normal;font-size:15px;letter-spacing:0;color:var(--fc-muted);line-height:1.5}',
    '.fc-w{display:inline-block;opacity:0;transform:translateY(.28em);filter:blur(5px);animation:fc-word .8s var(--fc-ease) forwards}',
    '@keyframes fc-word{to{opacity:1;transform:none;filter:blur(0)}}',
    '@keyframes fc-breathe{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.05);opacity:1}}',
    '@keyframes fc-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
    '@keyframes fc-fade{from{opacity:0}to{opacity:1}}',
    '.fc-thinking{display:inline-flex;gap:7px;padding:14px 0}',
    '.fc-thinking i{width:7px;height:7px;border-radius:50%;background:var(--fc-sage);opacity:.35;animation:fc-pulse 1.1s ease-in-out infinite}',
    '.fc-thinking i:nth-child(2){animation-delay:.15s}.fc-thinking i:nth-child(3){animation-delay:.3s}',
    '@keyframes fc-pulse{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:.9;transform:translateY(-3px)}}',
    '.fc-widget{width:100%;max-width:520px;margin-top:22px}',
    '.fc-widget:empty{display:none}',
    '.fc-widget > *{animation:fc-rise .7s var(--fc-ease) both}',
    '.fc-card{background:rgba(255,255,255,.74);border:1px solid var(--fc-line);border-radius:26px;padding:18px 18px 16px;box-shadow:var(--fc-shadow-lg);',
    '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}',
    '.fc-kicker{font-size:11.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--fc-muted);margin:0 0 12px}',
    '.fc-foods{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:0;padding:0}',
    '.fc-food{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:4px 5px 4px 14px;border-radius:999px;background:var(--fc-sage-soft);',
    'font-size:15px;font-weight:500;animation:fc-rise .5s var(--fc-ease) both;transition:opacity .3s,transform .3s}',
    '.fc-food small{font-size:13px;font-weight:500;color:var(--fc-sage-deep);opacity:.8;white-space:nowrap}',
    '.fc-food .fc-x{width:30px;height:30px;border-radius:50%;border:0;background:rgba(255,255,255,.75);display:grid;place-items:center;cursor:pointer;',
    'color:var(--fc-sage-deep);transition:background .2s}',
    '.fc-food .fc-x:hover{background:#fff}',
    '.fc-food .fc-x svg{width:12px;height:12px}',
    '.fc-food.fc-out{opacity:0;transform:scale(.9)}',
    '.fc-total{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid var(--fc-line)}',
    '.fc-total span{font-size:14px;color:var(--fc-muted)}',
    '.fc-total b{font-family:var(--fc-serif);font-style:italic;font-weight:400;font-size:30px;line-height:1;color:var(--fc-sage-deep)}',
    '.fc-types{margin:8px 0 0;font-size:13px;color:var(--fc-muted)}',
    '.fc-chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;width:100%;max-width:560px;margin-top:22px;min-height:0}',
    '.fc-chips > *{animation:fc-rise .55s var(--fc-ease) both}',
    '.fc-chip{height:42px;padding:0 18px;border-radius:999px;border:1px solid var(--fc-line);background:rgba(255,255,255,.72);font-size:15px;',
    'font-weight:500;letter-spacing:.005em;cursor:pointer;box-shadow:0 1px 2px rgba(36,48,42,.04),0 6px 16px -10px rgba(36,48,42,.2);',
    'transition:transform .25s var(--fc-ease),background .25s,border-color .25s,color .25s,box-shadow .25s;display:inline-flex;align-items:center;gap:8px}',
    '.fc-chip:hover{transform:translateY(-1px);border-color:rgba(90,122,102,.45);background:#fff}',
    '.fc-chip:active{transform:translateY(0) scale(.98)}',
    '.fc-chip[aria-pressed="true"]{background:var(--fc-sage);border-color:var(--fc-sage);color:var(--fc-cream)}',
    '.fc-chip[aria-pressed="true"]::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--fc-cream)}',
    '.fc-chip.fc-primary{background:var(--fc-sage-deep);border-color:var(--fc-sage-deep);color:var(--fc-cream);',
    'box-shadow:0 12px 28px -14px rgba(61,90,72,.7)}',
    '.fc-chip.fc-primary:hover{background:#34503f}',
    '.fc-chip.fc-hero{height:70px;padding:0 48px;font-family:var(--fc-serif);font-style:italic;font-weight:400;font-size:31px;letter-spacing:-.01em;',
    'background:var(--fc-sage);border-color:var(--fc-sage);color:var(--fc-cream);box-shadow:0 20px 40px -18px rgba(61,90,72,.75),inset 0 1px 0 rgba(255,255,255,.18)}',
    '.fc-chip.fc-hero:hover{background:var(--fc-sage-deep)}',
    '.fc-chip.fc-wide{width:100%;max-width:420px;height:58px;justify-content:center;font-size:16px;font-weight:600}',
    '.fc-chip.fc-wide svg{width:18px;height:18px}',
    '.fc-chip.fc-ghost{background:transparent;border-color:transparent;box-shadow:none;color:var(--fc-sage-deep);text-decoration:underline;',
    'text-decoration-color:rgba(61,90,72,.3);text-underline-offset:4px}',
    '.fc-chip.fc-ghost:hover{background:rgba(220,229,221,.5);text-decoration-color:transparent}',
    '.fc-chips.fc-stack{flex-direction:column;align-items:center;gap:6px}',
    '.fc-form{width:100%;max-width:520px;margin-top:24px}',
    '.fc-inputwrap{display:flex;align-items:center;gap:8px;height:58px;padding:0 8px 0 22px;background:rgba(255,255,255,.9);',
    'border:1px solid var(--fc-line);border-radius:999px;box-shadow:var(--fc-shadow);transition:border-color .25s,box-shadow .25s}',
    '.fc-inputwrap:focus-within{border-color:rgba(90,122,102,.6);box-shadow:0 0 0 4px rgba(90,122,102,.16),var(--fc-shadow)}',
    '.fc-input{flex:1;min-width:0;height:100%;border:0;background:transparent;font:inherit;font-size:16px;color:var(--fc-ink);outline:none}',
    '.fc-input::placeholder{color:#8F9B93}',
    '.fc-send{flex:none;width:42px;height:42px;border-radius:50%;border:0;background:var(--fc-sage-deep);color:var(--fc-cream);display:grid;place-items:center;',
    'cursor:pointer;transition:opacity .25s,transform .25s var(--fc-ease)}',
    '.fc-send:disabled{opacity:.28;cursor:default}',
    '.fc-send:not(:disabled):hover{transform:scale(1.05)}',
    '.fc-send svg{width:18px;height:18px}',
    '.fc-hint{margin:10px 0 0;text-align:center;font-size:12.5px;color:var(--fc-muted);min-height:18px}',
    '.fc-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
    '.fc-tx{width:100%;max-width:520px;margin-top:14px;display:flex;flex-direction:column;align-items:center}',
    '.fc-txbtn{display:inline-flex;align-items:center;gap:6px;background:none;border:0;padding:8px 14px;border-radius:999px;font-size:13px;',
    'color:var(--fc-muted);cursor:pointer;letter-spacing:.01em}',
    '.fc-txbtn:hover{color:var(--fc-ink);background:rgba(220,229,221,.45)}',
    '.fc-txbtn svg{width:12px;height:12px;transition:transform .3s var(--fc-ease)}',
    '.fc-txbtn[aria-expanded="true"] svg{transform:rotate(180deg)}',
    '.fc-txlist{width:100%;max-height:300px;overflow-y:auto;margin:6px 0 0;padding:14px 16px;list-style:none;border-radius:20px;',
    'background:rgba(255,255,255,.5);border:1px solid var(--fc-line);animation:fc-rise .45s var(--fc-ease) both}',
    '.fc-txlist li{margin:0 0 12px;font-size:14px;line-height:1.45}',
    '.fc-txlist li:last-child{margin-bottom:0}',
    '.fc-txlist .fc-f{font-family:var(--fc-serif);font-style:italic;font-size:18px;color:var(--fc-ink)}',
    '.fc-txlist .fc-u{text-align:right;color:var(--fc-muted)}',
    '.fc-txlist .fc-u span{display:inline-block;background:var(--fc-cream);padding:6px 12px;border-radius:14px 14px 4px 14px;color:var(--fc-ink)}',
    // saved
    '.fc-saved{display:flex;align-items:center;gap:20px}',
    '.fc-ring{position:relative;width:128px;height:128px;flex:none}',
    '.fc-ring svg{width:100%;height:100%;transform:rotate(-90deg)}',
    '.fc-ring .fc-trk{stroke:var(--fc-sage-soft)}',
    '.fc-ring .fc-arc{stroke:var(--fc-sage);transition:stroke-dashoffset 1.6s var(--fc-ease)}',
    '.fc-ring .fc-arc2{stroke:var(--fc-sage-deep);transition:stroke-dashoffset 1.6s var(--fc-ease) .2s}',
    '.fc-ring-c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}',
    '.fc-ring-c b{font-family:var(--fc-serif);font-style:italic;font-weight:400;font-size:38px;line-height:1;color:var(--fc-ink)}',
    '.fc-ring-c span{font-size:12px;color:var(--fc-muted);margin-top:3px}',
    '.fc-saved-t{min-width:0}',
    '.fc-saved-t h3{margin:0 0 4px;font-family:var(--fc-serif);font-style:italic;font-weight:400;font-size:24px;line-height:1.15}',
    '.fc-saved-t p{margin:0;font-size:14px;color:var(--fc-muted)}',
    '.fc-saved-t .fc-plus{display:inline-block;margin-top:10px;padding:4px 10px;border-radius:999px;background:var(--fc-sage-soft);color:var(--fc-sage-deep);font-size:13px;font-weight:600}',
    '.fc-feel-note{margin:0;text-align:center;font-size:13.5px;color:var(--fc-muted)}',
    // logbook sheet
    '.fc-sheet-wrap{position:absolute;inset:0;z-index:10;visibility:hidden}',
    '.fc-sheet-wrap.fc-open{visibility:visible}',
    '.fc-backdrop{position:absolute;inset:0;background:rgba(36,48,42,.26);opacity:0;transition:opacity .4s;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}',
    '.fc-open .fc-backdrop{opacity:1}',
    '.fc-sheet{position:absolute;left:0;right:0;bottom:0;max-height:90%;display:flex;flex-direction:column;background:var(--fc-paper);',
    'border-radius:30px 30px 0 0;box-shadow:0 -24px 60px -24px rgba(36,48,42,.4);transform:translateY(104%);transition:transform .55s var(--fc-ease);outline:none}',
    '.fc-open .fc-sheet{transform:none}',
    '.fc-grab{width:40px;height:4px;border-radius:2px;background:var(--fc-line);margin:10px auto 0}',
    '.fc-sh-head{display:flex;align-items:center;justify-content:space-between;padding:12px 20px 6px 24px}',
    '.fc-sh-head h2{margin:0;font-family:var(--fc-serif);font-style:italic;font-weight:400;font-size:36px;letter-spacing:-.01em;line-height:1.1}',
    '.fc-sh-head .fc-iconbtn{position:static}',
    '.fc-sh-body{overflow-y:auto;padding:8px 20px calc(28px + env(safe-area-inset-bottom,0px))}',
    '.fc-week{padding:16px 16px 12px}',
    '.fc-week-h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}',
    '.fc-week-h b{font-family:var(--fc-serif);font-style:italic;font-weight:400;font-size:22px}',
    '.fc-week-h span{font-size:12.5px;color:var(--fc-muted)}',
    '.fc-bars{position:relative;display:grid;grid-template-columns:repeat(7,1fr);gap:8px;height:124px;align-items:end}',
    '.fc-goal{position:absolute;left:0;right:0;border-top:1px dashed rgba(61,90,72,.45);pointer-events:none}',
    '.fc-goal span{position:absolute;left:0;top:-17px;font-size:11px;color:var(--fc-sage-deep);background:rgba(255,255,255,.8);padding:0 4px;border-radius:4px}',
    '.fc-bar{position:relative;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}',
    '.fc-bar i{display:block;width:100%;max-width:30px;border-radius:9px 9px 5px 5px;background:var(--fc-sage);opacity:.55;min-height:4px;transition:height .9s var(--fc-ease)}',
    '.fc-bar.fc-today i{opacity:1;background:var(--fc-sage-deep)}',
    '.fc-bar.fc-met i{opacity:.9}',
    '.fc-bar em{font-style:normal;font-size:11px;color:var(--fc-muted);margin-bottom:4px}',
    '.fc-days{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-top:8px;text-align:center;font-size:11.5px;color:var(--fc-muted)}',
    '.fc-days .fc-today{color:var(--fc-ink);font-weight:600}',
    '.fc-day{margin-top:26px}',
    '.fc-day-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:0 4px 10px}',
    '.fc-day-h h3{margin:0;font-family:var(--fc-serif);font-style:italic;font-weight:400;font-size:24px}',
    '.fc-day-h span{font-size:13px;color:var(--fc-muted);white-space:nowrap}',
    '.fc-day-h span b{color:var(--fc-ink);font-weight:600}',
    '.fc-prog{height:5px;border-radius:3px;background:var(--fc-sage-soft);margin:0 4px 12px;overflow:hidden}',
    '.fc-prog i{display:block;height:100%;background:var(--fc-sage);border-radius:3px}',
    '.fc-entries{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}',
    '.fc-entry{background:rgba(255,255,255,.75);border:1px solid var(--fc-line);border-radius:20px;padding:14px 16px;box-shadow:0 1px 2px rgba(36,48,42,.03)}',
    '.fc-entry-h{display:flex;justify-content:space-between;align-items:baseline;gap:10px}',
    '.fc-entry-h time{font-size:12.5px;color:var(--fc-muted);letter-spacing:.02em}',
    '.fc-entry-h b{font-family:var(--fc-serif);font-style:italic;font-weight:400;font-size:21px;color:var(--fc-sage-deep);white-space:nowrap}',
    '.fc-entry p{margin:4px 0 0;font-size:15px;line-height:1.4}',
    '.fc-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}',
    '.fc-tag{font-size:12px;font-weight:500;padding:3px 10px;border-radius:999px;background:var(--fc-cream);color:var(--fc-ink)}',
    '.fc-tag.fc-good{background:var(--fc-sage-soft);color:var(--fc-sage-deep)}',
    '.fc-note{font-size:13.5px!important;color:var(--fc-muted);font-style:italic}',
    '.fc-empty{text-align:center;padding:40px 10px;color:var(--fc-muted)}',
    '.fc-empty b{display:block;font-family:var(--fc-serif);font-style:italic;font-weight:400;font-size:26px;color:var(--fc-ink);margin-bottom:6px}',
    // focus
    '.fc-root :focus{outline:none}',
    '.fc-root :focus-visible{outline:2px solid var(--fc-sage-deep);outline-offset:3px}',
    '.fc-root .fc-input:focus-visible{outline:none}',
    '@media (min-width:760px){',
    '.fc-top{height:76px;padding:0 28px}.fc-iconbtn{right:28px;top:17px}.fc-col{min-height:calc(100% - 76px)}',
    '.fc-sheet{left:auto;top:16px;right:16px;bottom:16px;width:440px;max-height:none;border-radius:30px;transform:translateX(calc(100% + 32px));',
    'box-shadow:0 30px 80px -30px rgba(36,48,42,.45)}',
    '.fc-grab{display:none}.fc-sh-head{padding-top:22px}',
    '.fc-say{max-width:20em}',
    '}',
    '@media (max-height:760px){.fc-stage{--fc-size:240px}}',
    '@media (min-width:760px){.fc-stage{--fc-size:360px}.fc-root.fc-compact .fc-stage{--fc-size:300px}}',
    '@media (max-width:759px){.fc-root.fc-compact .fc-stage{--fc-size:240px}.fc-root.fc-compact .fc-say{font-size:clamp(23px,6vw,30px)}.fc-root.fc-compact .fc-say.fc-s,.fc-root.fc-compact .fc-say.fc-xs{font-size:clamp(20px,5.2vw,25px)}.fc-top{height:60px}.fc-iconbtn{top:9px}.fc-col{min-height:calc(100% - 60px)}.fc-widget,.fc-chips{margin-top:18px}.fc-form{margin-top:18px}}',
    '@media (max-width:380px){.fc-saved{gap:14px}.fc-ring{width:112px;height:112px}.fc-ring-c b{font-size:32px}}',
    '@media (prefers-reduced-motion:reduce){',
    '.fc-root *,.fc-root *::before,.fc-root *::after{animation-duration:.01ms!important;animation-delay:0ms!important;transition-duration:.01ms!important;transition-delay:0ms!important}',
    '.fc-w{opacity:1;transform:none;filter:none}',
    '}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('fc-style')) return;
    var s = document.createElement('style');
    s.id = 'fc-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* =====================================================================================
     Small DOM helpers and icons
     ===================================================================================== */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  var ICON = {
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4.5h10.5A3.5 3.5 0 0 1 19 8v11.5H8.5A3.5 3.5 0 0 1 5 16V4.5z"/><path d="M5 16a3.5 3.5 0 0 1 3.5-3.5H19"/><path d="M9 8h6"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>',
    x: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    chev: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>'
  };

  var reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return !!reduceMQ.matches; }

  /* =====================================================================================
     FloraApp access (guarded, so chat works stand-alone)
     ===================================================================================== */
  var memEntries = [];
  function appEntries() {
    try {
      if (window.FloraApp && typeof FloraApp.entries === 'function') {
        var e = FloraApp.entries();
        if (Array.isArray(e)) return e.slice();
      }
    } catch (err) { console.warn('[FloraChat] entries() failed', err); }
    return memEntries.slice();
  }
  function appSave(entry) {
    try {
      if (window.FloraApp && typeof FloraApp.saveEntry === 'function') { FloraApp.saveEntry(entry); return; }
    } catch (err) { console.warn('[FloraChat] saveEntry() failed', err); }
    memEntries.push(entry);
  }
  function dayKey(d) {
    d = new Date(d);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function todayTotal(entries, extra) {
    var k = dayKey(new Date());
    var seen = {}, sum = 0;
    entries.concat(extra ? [extra] : []).forEach(function (e) {
      if (!e || !e.time || seen[e.id]) return;
      seen[e.id] = 1;
      if (dayKey(e.time) === k) sum += +e.totalFibreG || 0;
    });
    return r1(sum);
  }

  /* =====================================================================================
     Flora rendering (canvas, HiDPI, gentle float)
     ===================================================================================== */
  function fallbackFlora(g, cx, cy, size, st) {
    var r = size * 0.4, t = st.t || 0;
    var grad = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    grad.addColorStop(0, '#AFC8B5'); grad.addColorStop(1, '#5A7A66');
    g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    var blink = (t % 4.4) < 0.12 ? 0.15 : 1, lx = (st.lookX || 0) * r * 0.08;
    g.fillStyle = '#24302A';
    g.beginPath(); g.ellipse(cx - r * 0.34 + lx, cy - r * 0.06, r * 0.1, r * 0.16 * blink, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(cx + r * 0.34 + lx, cy - r * 0.06, r * 0.1, r * 0.16 * blink, 0, 0, 7); g.fill();
    g.strokeStyle = '#24302A'; g.lineWidth = size * 0.014; g.lineCap = 'round';
    g.beginPath();
    if (st.talking) g.ellipse(cx + lx, cy + r * 0.26, r * 0.09, r * (0.03 + 0.06 * Math.abs(Math.sin(t * 11))), 0, 0, 7);
    else g.arc(cx + lx, cy + r * 0.16, r * 0.13, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
  }

  function FloraStage(canvas, parts) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.p = parts || {};
    this.imgOK = false; this.imgLoading = false; this.talkAmp = 0;
    this.t = 0; this.mood = 'happy'; this.talkUntil = 0; this.hopAt = -10;
    this.lookX = 0; this.lookY = 0; this.tx = 0; this.ty = 0;
    this.running = false; this.last = 0; this.w = 0; this.h = 0; this.dpr = 1;
    this.castFailed = false;
    var self = this;
    this._loop = function (now) {
      if (!self.running) return;
      var dt = Math.min(0.05, (now - (self.last || now)) / 1000);
      self.last = now;
      self.t += dt;
      self.frame(dt);
      self.raf = requestAnimationFrame(self._loop);
    };
  }
  FloraStage.prototype.start = function () {
    if (this.running) return;
    this.running = true; this.last = 0;
    this.raf = requestAnimationFrame(this._loop);
  };
  FloraStage.prototype.stop = function () { this.running = false; cancelAnimationFrame(this.raf); };
  FloraStage.prototype.talk = function (ms) { this.talkUntil = this.t + ms / 1000; };
  FloraStage.prototype.hop = function () { this.hopAt = this.t; };
  FloraStage.prototype.loadImage = function (src) {
    var self = this, img = this.p.img;
    if (!img || !src) return;
    this.imgLoading = true;
    // if the artwork is very slow, show the drawn Flora rather than an empty stage
    setTimeout(function () { self.imgLoading = false; }, 2500);
    img.onload = function () {
      self.imgLoading = false;
      self.imgOK = true;
      self.p.stage.classList.add('fc-img');
    };
    img.onerror = function () {
      self.imgLoading = false;
      self.imgOK = false;
      self.p.stage.classList.remove('fc-img');
      console.warn('[FloraChat] Flora artwork failed to load, using drawFlora fallback');
    };
    img.src = src;
  };
  // A small burst of sage, cream and soft-gold sparkles around her head.
  FloraStage.prototype.sparkle = function (n) {
    var box = this.p.sparks;
    if (!box || reduced()) return;
    var cols = ['#E2C46F', '#FFFFFF', '#8FB09A', '#EAD9A0', '#B9CDBE'];
    var w = box.clientWidth || 260;
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (i / n - 0.5) * Math.PI * 1.5 + (Math.random() - 0.5) * 0.4;
      var dist = w * (0.26 + Math.random() * 0.16);
      var sp = document.createElement('i');
      sp.className = 'fc-spark' + (i % 3 === 2 ? ' fc-dot' : '');
      var sz = i % 3 === 2 ? 4 + Math.random() * 3 : 8 + Math.random() * 8;
      sp.style.cssText = '--dx:' + (Math.cos(a) * dist).toFixed(1) + 'px;--dy:' + (Math.sin(a) * dist * 0.8).toFixed(1) + 'px;--s:' + sz.toFixed(1) +
        'px;--c:' + cols[i % cols.length] + ';--w:' + Math.round(Math.random() * 160) + 'ms;--d:' + Math.round(800 + Math.random() * 400) + 'ms';
      box.appendChild(sp);
      (function (node) { setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 1500); })(sp);
    }
  };
  // Image mode: breathing, float, talk squash, hop, pointer tilt, and a contact shadow that follows the float.
  FloraStage.prototype.frameImage = function (dt) {
    var fig = this.p.fig, sh = this.p.shadow;
    var w = this.p.stage.clientWidth || 260;
    var k = 1 - Math.pow(0.0025, dt);
    this.lookX += (this.tx - this.lookX) * k;
    this.lookY += (this.ty - this.lookY) * k;
    var talking = this.t < this.talkUntil;
    this.talkAmp += ((talking ? 1 : 0) - this.talkAmp) * (1 - Math.pow(0.002, dt));
    if (reduced()) {
      fig.style.transform = 'none';
      sh.style.transform = 'none'; sh.style.opacity = '1';
      return;
    }
    var t = this.t;
    var fl = Math.sin(t * 1.15);                       // -1..1 float phase
    var y = -(fl * 0.5 + 0.5) * w * 0.028;             // float up to ~2.8% of size
    var breathe = Math.sin(t * 1.7);
    var sy = 1 + breathe * 0.012, sx = 1 - breathe * 0.006;
    var tb = Math.sin(t * 9.5) * this.talkAmp;         // talking squash-bounce
    sy += tb * 0.022; sx -= tb * 0.012; y -= Math.max(0, tb) * w * 0.008;
    var hp = (t - this.hopAt) / 0.95;
    if (hp >= 0 && hp < 1) {
      var decay = 1 - hp;
      y -= Math.abs(Math.sin(hp * Math.PI * 2)) * w * 0.06 * decay;
      var sq = Math.cos(hp * Math.PI * 4) * 0.035 * decay;
      sy -= sq; sx += sq * 0.6;
    }
    var rot = this.lookX * 3.2;
    if (this.mood === 'thinking') rot += Math.sin(t * 2.1) * 1.6;
    var x = this.lookX * w * 0.012;
    fig.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) rotate(' + rot.toFixed(2) + 'deg) scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ')';
    var lift = -y / (w * 0.06);                         // 0 on the ground .. ~1 at the top of a hop
    sh.style.transform = 'translateX(' + (x * 0.6).toFixed(2) + 'px) scale(' + (1 - lift * 0.18).toFixed(3) + ',' + (1 - lift * 0.12).toFixed(3) + ')';
    sh.style.opacity = (1 - lift * 0.35).toFixed(3);
  };
  FloraStage.prototype.frame = function (dt) {
    if (this.imgOK) { this.frameImage(dt); return; }
    if (this.imgLoading) return;
    var c = this.c, g = this.g;
    var cw = c.clientWidth, ch = c.clientHeight;
    if (!cw || !ch) return;
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    if (cw !== this.w || ch !== this.h || dpr !== this.dpr) {
      this.w = cw; this.h = ch; this.dpr = dpr;
      c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr);
    }
    var k = 1 - Math.pow(0.0025, dt);
    this.lookX += (this.tx - this.lookX) * k;
    this.lookY += (this.ty - this.lookY) * k;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cw, ch);
    var rm = reduced();
    var floatY = rm ? 0 : Math.sin(this.t * 1.15) * cw * 0.018;
    var hopP = (this.t - this.hopAt) / 0.9, hopY = 0;
    if (!rm && hopP >= 0 && hopP < 1) hopY = -Math.abs(Math.sin(hopP * Math.PI * 2)) * cw * 0.05 * (1 - hopP);
    var size = cw * 0.8;
    var cx = cw / 2, cy = ch * 0.48 + floatY + hopY;
    var cast = window.FloraCast;
    var realCast = !this.castFailed && cast && typeof cast.drawFlora === 'function' && !cast.__stub;
    // soft contact shadow (the real cast draws its own)
    var lift = (floatY + hopY) / (cw * 0.05);
    var sw = cw * 0.24 * (1 + lift * 0.12);
    if (!realCast) {
    g.save();
    g.globalAlpha = 0.16 - lift * 0.03;
    var sg = g.createRadialGradient(cx, ch * 0.93, 0, cx, ch * 0.93, sw);
    sg.addColorStop(0, 'rgba(36,48,42,0.9)'); sg.addColorStop(1, 'rgba(36,48,42,0)');
    g.fillStyle = sg;
    g.beginPath(); g.ellipse(cx, ch * 0.93, sw, sw * 0.16, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    }
    var state = { t: this.t, talking: this.t < this.talkUntil, mood: this.mood, lookX: this.lookX, lookY: this.lookY };
    if (!this.castFailed && cast && typeof cast.drawFlora === 'function') {
      try {
        g.save(); cast.drawFlora(g, cx, cy, size, state); g.restore();
        return;
      } catch (err) {
        g.restore();
        this.castFailed = true;
        console.warn('[FloraChat] FloraCast.drawFlora failed, using fallback', err);
      }
    }
    fallbackFlora(g, cx, cy, size, state);
  };

  /* =====================================================================================
     The chat UI
     ===================================================================================== */
  var S = null; // UI state, created by mount

  // Flora's artwork, relative to the page (index.html lives in prototypes/v2). Canvas drawFlora is the fallback.
  var FLORA_IMG = 'art/flora.png';

  function mount(rootEl, opts) {
    if (!rootEl) throw new Error('FloraChat.mount needs a root element');
    injectCSS();
    if (S && S.root && S.root.parentNode) S.root.parentNode.removeChild(S.root);
    if (S && S.stage) S.stage.stop();

    var root = el('div', { class: 'fc-root' });
    var uid = 'fc' + Math.random().toString(36).slice(2, 7);
    var logBtn = el('button', { class: 'fc-iconbtn', type: 'button', 'aria-label': 'Open logbook', 'aria-haspopup': 'dialog', html: ICON.book + '<span class="fc-dot" aria-hidden="true"></span>' });
    var top = el('header', { class: 'fc-top' }, [el('p', { class: 'fc-wordmark', 'aria-label': 'hiflora', text: 'hiflora' }), logBtn]);
    var canvas = el('canvas', { 'aria-hidden': 'true' });
    var shadow = el('div', { class: 'fc-shadow', 'aria-hidden': 'true' });
    var img = el('img', { alt: '', 'aria-hidden': 'true', draggable: 'false', decoding: 'async' });
    var fig = el('div', { class: 'fc-fig', 'aria-hidden': 'true' }, [img]);
    var sparks = el('div', { class: 'fc-sparks', 'aria-hidden': 'true' });
    var stageEl = el('div', { class: 'fc-stage', role: 'img', 'aria-label': 'Flora, a fluffy sage-green microbe with a leaf sprout' },
      [el('div', { class: 'fc-halo', 'aria-hidden': 'true' }), shadow, fig, canvas, sparks]);
    var echo = el('p', { class: 'fc-echo', 'aria-hidden': 'true' });
    var say = el('div', { class: 'fc-say', 'aria-live': 'polite', 'aria-atomic': 'true', id: uid + '-say' });
    var widget = el('div', { class: 'fc-widget' });
    var chips = el('div', { class: 'fc-chips', role: 'group', 'aria-label': 'Quick replies' });
    var input = el('input', { class: 'fc-input', id: uid + '-in', type: 'text', autocomplete: 'off', enterkeyhint: 'send', maxlength: '400', 'aria-describedby': uid + '-say' });
    var sendBtn = el('button', { class: 'fc-send', type: 'submit', 'aria-label': 'Send', html: ICON.send, disabled: true });
    var form = el('form', { class: 'fc-form', autocomplete: 'off' }, [
      el('label', { class: 'fc-sr', for: uid + '-in', text: 'Message Flora' }),
      el('div', { class: 'fc-inputwrap' }, [input, sendBtn])
    ]);
    var txBtn = el('button', { class: 'fc-txbtn', type: 'button', 'aria-expanded': 'false', 'aria-controls': uid + '-tx' });
    var txList = el('ol', { class: 'fc-txlist', id: uid + '-tx', hidden: true, 'aria-label': 'Conversation so far' });
    var tx = el('div', { class: 'fc-tx' }, [txBtn, txList]);
    var col = el('main', { class: 'fc-col' }, [stageEl, echo, say, widget, chips, form, tx]);
    var scroll = el('div', { class: 'fc-scroll' }, [top, col]);
    var sheetWrap = el('div', { class: 'fc-sheet-wrap', 'aria-hidden': 'true' });
    root.appendChild(el('div', { class: 'fc-bg', 'aria-hidden': 'true' }));
    root.appendChild(scroll);
    root.appendChild(sheetWrap);
    rootEl.appendChild(root);

    S = {
      root: root, scroll: scroll, say: say, echo: echo, widget: widget, chips: chips, input: input, sendBtn: sendBtn, form: form,
      txBtn: txBtn, txList: txList, logBtn: logBtn, sheetWrap: sheetWrap,
      stage: new FloraStage(canvas, { stage: stageEl, fig: fig, img: img, shadow: shadow, sparks: sparks }), stageEl: stageEl,
      ctx: null, res: null, token: 0, busy: false, sel: {}, shown: false, sheetOpen: false, lastFocus: null
    };

    input.addEventListener('input', function () { sendBtn.disabled = !input.value.trim() && !(S.ctx && S.ctx.phase === 'ask-feel'); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (S.ctx && S.ctx.phase === 'ask-feel') { submitFeelings(v); return; }
      if (!v) return;
      input.value = ''; sendBtn.disabled = true;
      send(v);
    });
    txBtn.addEventListener('click', function () {
      var open = txList.hidden;
      txList.hidden = !open;
      txBtn.setAttribute('aria-expanded', String(open));
      renderTxBtn();
      if (open) { txList.scrollTop = txList.scrollHeight; setTimeout(function () { try { txList.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) {} }, 30); }
    });
    logBtn.addEventListener('click', function () { openLogbook(); });
    root.addEventListener('pointermove', function (e) {
      var r = stageEl.getBoundingClientRect();
      if (!r.width) return;
      S.stage.tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.5)));
      S.stage.ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.5)));
    });
    root.addEventListener('keydown', function (e) {
      if (S.sheetOpen) {
        if (e.key === 'Escape') { e.preventDefault(); closeLogbook(); }
        else if (e.key === 'Tab') trapFocus(e);
      }
    });
    document.addEventListener('visibilitychange', function () {
      if (!S) return;
      if (document.hidden) S.stage.stop(); else if (S.shown) S.stage.start();
    });

    S.stage.loadImage((opts && opts.floraSrc) || FLORA_IMG);
    reset();
    if (!window.FloraApp || !FloraApp.show) onShow(); // stand-alone: start animating straight away
    return root;
  }

  function newCtx() {
    var ents = appEntries();
    return { phase: 'idle', hour: new Date().getHours(), todayFibreG: todayTotal(ents), entriesCount: ents.length,
      draft: { foods: [], unknown: [] }, lastEntry: null, history: [] };
  }
  function refreshCtx() {
    var ents = appEntries();
    S.ctx.hour = new Date().getHours();
    S.ctx.todayFibreG = todayTotal(ents);
    S.ctx.entriesCount = ents.length;
  }

  function reset() {
    if (!S) return;
    S.ctx = newCtx();
    S.txList.innerHTML = '';
    S.echo.classList.remove('fc-on');
    S.echo.textContent = '';
    renderTxBtn();
    Promise.resolve(FloraBrain.start(S.ctx)).then(function (res) { present(res, true); });
  }

  function onShow() {
    if (!S) return;
    S.shown = true;
    S.stage.start();
  }
  function onHide() {
    if (!S) return;
    S.shown = false;
    S.stage.stop();
    if (S.sheetOpen) closeLogbook(true);
  }

  function addTx(who, text) {
    S.ctx.history.push({ who: who, text: text });
    if (S.ctx.history.length > 60) S.ctx.history.shift();
    var li = el('li', { class: who === 'flora' ? 'fc-f' : 'fc-u' }, [who === 'flora' ? text : el('span', { text: text })]);
    li.insertBefore(el('span', { class: 'fc-sr', text: who === 'flora' ? 'Flora: ' : 'You: ' }), li.firstChild);
    S.txList.appendChild(li);
    renderTxBtn();
    if (!S.txList.hidden) S.txList.scrollTop = S.txList.scrollHeight;
  }
  function renderTxBtn() {
    var n = S.ctx ? S.ctx.history.length : 0;
    S.txBtn.style.visibility = n ? 'visible' : 'hidden';
    var open = !S.txList.hidden;
    S.txBtn.innerHTML = '';
    S.txBtn.appendChild(document.createTextNode((open ? 'Hide conversation' : 'Show conversation') + (n ? ' · ' + n : '')));
    S.txBtn.insertAdjacentHTML('beforeend', ICON.chev);
  }

  function send(text) {
    if (S.busy) return;
    S.busy = true;
    addTx('you', text);
    S.echo.textContent = '“' + text + '”';
    S.echo.classList.add('fc-on');
    S.sel = {};
    var my = ++S.token;
    S.chips.innerHTML = '';
    S.say.classList.add('fc-dim');
    S.stage.mood = 'thinking';
    refreshCtx();
    var started = performance.now();
    var minWait = reduced() ? 120 : 520 + Math.min(500, text.length * 6);
    Promise.resolve().then(function () { return FloraBrain.reply(S.ctx, text); }).then(function (res) {
      var wait = Math.max(0, minWait - (performance.now() - started));
      setTimeout(function () { if (my === S.token) { S.busy = false; present(res); } }, wait);
    }).catch(function (err) {
      console.error('[FloraChat] brain error', err);
      S.busy = false;
      present(R(['Sorry, I lost my train of thought for a moment.', 'Could you say that again?'], [], 'thinking'));
    });
  }

  function present(res, initial) {
    if (!res) return;
    var my = ++S.token;
    S.res = res;
    var st = res.state || {};
    S.stage.mood = st.mood || 'happy';
    if (st.hop) S.stage.hop();
    if (st.hop || st.mood === 'excited') S.stage.sparkle(st.hop ? 10 : 6);
    else if (!initial && (res.say || []).length) S.stage.sparkle(3);

    if (res.entry) {
      appSave(res.entry);
      S.ctx.lastEntry = res.entry;
      S.logBtn.classList.add('fc-has-new');
    }

    // Flora's lines, word by word
    var lines = res.say || [];
    S.say.classList.remove('fc-dim', 'fc-m', 'fc-s', 'fc-xs');
    S.say.innerHTML = '';
    var chars = lines.join(' ').length;
    if (chars > 210) S.say.classList.add('fc-xs');
    else if (chars > 140) S.say.classList.add('fc-s');
    else if (chars > 70) S.say.classList.add('fc-m');
    var rm = reduced(), step = rm ? 0 : 52, n = 0;
    lines.forEach(function (line) {
      var p = el('p');
      line.split(/\s+/).forEach(function (w) {
        var s = el('span', { class: 'fc-w', text: w });
        s.style.animationDelay = (n * step) + 'ms';
        p.appendChild(s); p.appendChild(document.createTextNode(' '));
        n++;
      });
      S.say.appendChild(p);
      addTx('flora', line);
    });
    if (!lines.length && res.ui && res.ui.type === 'idle') {
      S.say.appendChild(el('p', { class: 'fc-quiet', text: 'Flora is here whenever you are ready.' }));
    }
    var revealMs = rm ? 0 : n * step + 450;
    if (n) S.stage.talk(Math.max(600, n * step + 250));

    var ui = res.ui ? res.ui.type : null;
    S.root.classList.toggle('fc-compact', ui === 'foods' || ui === 'saved' || ui === 'feelings');
    S.root.classList.toggle('fc-idle', ui === 'idle');

    // widget + chips appear as the line settles
    S.widget.innerHTML = '';
    S.chips.innerHTML = '';
    var delay = rm ? 0 : Math.min(1100, Math.max(250, revealMs * 0.55));
    setTimeout(function () {
      if (my !== S.token) return;
      renderWidget(ui);
      renderChips(res.chips || []);
      setPlaceholder();
      if (res.action) runAction(res.action);
    }, initial ? 150 : delay);
  }

  function setPlaceholder() {
    var ph = { idle: 'Or type hello', 'ask-food': 'Tell Flora what you ate', clarify: 'Describe it, or say skip',
      confirm: 'Add or change anything', 'ask-feel': 'Add a note (optional)', saved: 'Tell Flora about another meal' }[S.ctx.phase] || 'Message Flora';
    S.input.placeholder = ph;
    S.sendBtn.disabled = !S.input.value.trim() && S.ctx.phase !== 'ask-feel';
  }

  function chipBtn(c, i) {
    var cls = 'fc-chip' + (c.hero ? ' fc-hero' : '') + (c.primary && !c.hero ? ' fc-primary' : '') + (c.wide ? ' fc-wide' : '') + (c.ghost ? ' fc-ghost' : '');
    var b = el('button', { class: cls, type: 'button' });
    b.style.animationDelay = (reduced() ? 0 : i * 45) + 'ms';
    b.appendChild(document.createTextNode(c.label));
    return b;
  }

  function renderChips(list) {
    var box = S.chips;
    box.innerHTML = '';
    box.classList.remove('fc-stack');
    var phase = S.ctx.phase;
    if (phase === 'saved') box.classList.add('fc-stack');
    list.forEach(function (c, i) {
      var cc = {}; for (var k in c) cc[k] = c[k];
      if (phase === 'saved' && c.kind === 'action') cc.wide = true;
      if (phase === 'saved' && c.kind !== 'action') cc.ghost = true;
      var b = chipBtn(cc, i);
      if (cc.wide) b.insertAdjacentHTML('beforeend', ICON.arrow);
      if (c.kind === 'toggle') {
        b.setAttribute('aria-pressed', S.sel[c.value] ? 'true' : 'false');
        b.addEventListener('click', function () {
          S.sel[c.value] = !S.sel[c.value];
          b.setAttribute('aria-pressed', S.sel[c.value] ? 'true' : 'false');
          updateFeelSave();
        });
      } else if (c.kind === 'action') {
        b.addEventListener('click', function () { runAction(c.action); });
      } else {
        b.addEventListener('click', function () { send(c.value || c.label); });
      }
      box.appendChild(b);
    });
    if (phase === 'ask-feel') {
      var row = el('div', { style: 'flex-basis:100%;display:flex;justify-content:center;gap:10px;margin-top:8px' });
      var save = chipBtn({ label: 'Save entry', primary: true }, list.length);
      save.classList.add('fc-feel-save');
      save.addEventListener('click', function () { submitFeelings(S.input.value.trim()); });
      var skip = chipBtn({ label: 'Skip', ghost: true }, list.length + 1);
      skip.addEventListener('click', function () { S.sel = {}; S.input.value = ''; send('skip'); });
      row.appendChild(save); row.appendChild(skip);
      box.appendChild(row);
      updateFeelSave();
    }
  }
  function updateFeelSave() {
    var b = S.chips.querySelector('.fc-feel-save');
    if (!b) return;
    var any = Object.keys(S.sel).some(function (k) { return S.sel[k]; }) || !!S.input.value.trim();
    b.style.opacity = any ? '1' : '.5';
  }
  function submitFeelings(note) {
    var tags = FEEL_ORDER.filter(function (t) { return S.sel[t]; });
    if (!tags.length && !note) { S.chips.querySelector('.fc-chip') && S.chips.querySelector('.fc-chip').focus(); flashHint(); return; }
    var text = tags.map(function (t) { return FEEL_LABEL[t]; }).join(', ');
    if (note) text = text ? text + ' — ' + note : note;
    S.input.value = '';
    send(text);
  }
  function flashHint() {
    var p = S.widget.querySelector('.fc-feel-note');
    if (p) { p.textContent = 'Pick one or more, add a note, or skip.'; p.style.color = 'var(--fc-sage-deep)'; }
  }

  function runAction(a) {
    if (a === 'world') {
      var entry = S.ctx.lastEntry;
      try {
        if (window.FloraApp && typeof FloraApp.show === 'function') FloraApp.show('world', { entry: entry });
        else console.info('[FloraChat] FloraApp.show missing; would show world with', entry);
      } catch (err) { console.warn('[FloraChat] FloraApp.show failed', err); }
    } else if (a === 'logbook') {
      openLogbook();
    }
  }

  /* ---- widgets */
  function renderWidget(type) {
    var w = S.widget;
    w.innerHTML = '';
    if (type === 'foods' && S.ctx.draft.foods.length) w.appendChild(foodsCard());
    else if (type === 'feelings') w.appendChild(el('p', { class: 'fc-feel-note', text: 'Choose any that fit. You can add a note below.' }));
    else if (type === 'saved') w.appendChild(savedCard());
  }

  function foodsCard() {
    var card = el('section', { class: 'fc-card', 'aria-label': 'What Flora understood' });
    var ul = el('ul', { class: 'fc-foods' });
    var totalB = el('b');
    var types = el('p', { class: 'fc-types' });
    function update() {
      var t = totalOf(S.ctx.draft.foods);
      totalB.textContent = (t < 1 && t > 0 ? '<1' : Math.round(t * 2) / 2) + ' g';
      var seen = {};
      S.ctx.draft.foods.forEach(function (f) { f.fibreTypes.forEach(function (x) { seen[x] = 1; }); });
      var tl = Object.keys(seen).map(function (x) { return x.replace('-fos', ' / FOS').replace('gos', 'GOS').replace('-', ' '); });
      types.textContent = tl.length ? 'Fibre types: ' + tl.slice(0, 5).join(', ') + (tl.length > 5 ? ' and more' : '') : '';
    }
    S.ctx.draft.foods.forEach(function (f, i) {
      var li = el('li', { class: 'fc-food' });
      li.style.animationDelay = (reduced() ? 0 : i * 60) + 'ms';
      li.appendChild(el('span', { text: f.name }));
      li.appendChild(el('small', { text: (f.fibreG > 0 && f.fibreG < 1 ? '<1' : r1(f.fibreG)) + ' g' , title: f.serving }));
      li.appendChild(el('span', { class: 'fc-sr', text: ', ' + f.serving }));
      var x = el('button', { class: 'fc-x', type: 'button', 'aria-label': 'Remove ' + f.name, html: ICON.x });
      x.addEventListener('click', function () {
        var idx = S.ctx.draft.foods.indexOf(f);
        if (idx >= 0) S.ctx.draft.foods.splice(idx, 1);
        li.classList.add('fc-out');
        setTimeout(function () {
          if (li.parentNode) li.parentNode.removeChild(li);
          update();
          if (!S.ctx.draft.foods.length) { send('start over'); return; }
          var nx = ul.querySelector('.fc-x'); if (nx) nx.focus();
        }, reduced() ? 0 : 260);
      });
      li.appendChild(x);
      ul.appendChild(li);
    });
    var tot = el('div', { class: 'fc-total' }, [el('span', { text: 'Total fibre' }), totalB]);
    card.appendChild(el('p', { class: 'fc-kicker', text: 'What I heard' }));
    card.appendChild(ul);
    card.appendChild(tot);
    card.appendChild(types);
    update();
    return card;
  }

  function ringSVG(frac, frac2) {
    var R0 = 54, C = 2 * Math.PI * R0;
    var svg = '<svg viewBox="0 0 128 128" aria-hidden="true">' +
      '<circle class="fc-trk" cx="64" cy="64" r="' + R0 + '" fill="none" stroke-width="10"/>' +
      '<circle class="fc-arc" cx="64" cy="64" r="' + R0 + '" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '" data-to="' + (C * (1 - Math.min(1, frac))) + '"/>' +
      '<circle class="fc-arc2" cx="64" cy="64" r="' + R0 + '" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '" data-to="' + (C * (1 - Math.min(1, frac2))) + '"/>' +
      '</svg>';
    return svg;
  }
  function savedCard() {
    var entry = S.ctx.lastEntry;
    var total = todayTotal(appEntries(), entry);
    var before = r1(total - (entry ? entry.totalFibreG : 0));
    var card = el('section', { class: 'fc-card fc-saved', 'aria-label': 'Today’s fibre' });
    var ring = el('div', { class: 'fc-ring', role: 'img', 'aria-label': Math.round(total) + ' of ' + GOAL_G + ' grams of fibre today' });
    // sage arc = today's total including this log; the deeper arc on top = what was logged earlier today
    ring.innerHTML = ringSVG(total / GOAL_G, before / GOAL_G);
    ring.appendChild(el('div', { class: 'fc-ring-c', 'aria-hidden': 'true' }, [el('b', { text: String(Math.round(total)) }), el('span', { text: 'of ' + GOAL_G + ' g' })]));
    var togo = Math.max(0, GOAL_G - Math.round(total));
    var txt = el('div', { class: 'fc-saved-t' }, [
      el('h3', { text: togo <= 0 ? 'Goal reached today' : Math.round(togo) + ' g to go today' }),
      el('p', { text: 'Daily goal ' + GOAL_G + ' g, the commonly recommended adult intake.' }),
      entry ? el('span', { class: 'fc-plus', text: '+' + (entry.totalFibreG < 1 && entry.totalFibreG > 0 ? '<1' : Math.round(entry.totalFibreG * 2) / 2) + ' g from this log' }) : null
    ]);
    card.appendChild(ring); card.appendChild(txt);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        ring.querySelectorAll('circle[data-to]').forEach(function (c) { c.setAttribute('stroke-dashoffset', c.getAttribute('data-to')); });
      });
    });
    return card;
  }

  /* =====================================================================================
     Logbook sheet
     ===================================================================================== */
  function openLogbook() {
    if (!S || S.sheetOpen) return;
    S.lastFocus = document.activeElement;
    S.logBtn.classList.remove('fc-has-new');
    var wrap = S.sheetWrap;
    wrap.innerHTML = '';
    var closeBtn = el('button', { class: 'fc-iconbtn', type: 'button', 'aria-label': 'Close logbook', html: ICON.close });
    var titleId = 'fc-lb-title';
    var sheet = el('section', { class: 'fc-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' }, [
      el('div', { class: 'fc-grab', 'aria-hidden': 'true' }),
      el('div', { class: 'fc-sh-head' }, [el('h2', { id: titleId, text: 'Logbook' }), closeBtn]),
      el('div', { class: 'fc-sh-body' }, logbookBody())
    ]);
    var bd = el('div', { class: 'fc-backdrop' });
    bd.addEventListener('click', function () { closeLogbook(); });
    closeBtn.addEventListener('click', function () { closeLogbook(); });
    wrap.appendChild(bd); wrap.appendChild(sheet);
    wrap.removeAttribute('aria-hidden');
    S.scroll.setAttribute('aria-hidden', 'true');
    if ('inert' in S.scroll) S.scroll.inert = true;
    S.sheetOpen = true;
    void wrap.offsetWidth;
    wrap.classList.add('fc-open');
    setTimeout(function () { closeBtn.focus(); }, reduced() ? 0 : 80);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        sheet.querySelectorAll('.fc-bar i[data-h]').forEach(function (i) { i.style.height = i.getAttribute('data-h'); });
      });
    });
  }
  function closeLogbook(instant) {
    if (!S || !S.sheetOpen) return;
    S.sheetOpen = false;
    var wrap = S.sheetWrap;
    wrap.classList.remove('fc-open');
    wrap.setAttribute('aria-hidden', 'true');
    S.scroll.removeAttribute('aria-hidden');
    if ('inert' in S.scroll) S.scroll.inert = false;
    setTimeout(function () { if (!S.sheetOpen) wrap.innerHTML = ''; }, instant || reduced() ? 0 : 600);
    var f = S.lastFocus && document.contains(S.lastFocus) ? S.lastFocus : S.logBtn;
    try { f.focus(); } catch (e) { /* ignore */ }
  }
  function trapFocus(e) {
    var f = Array.prototype.filter.call(S.sheetWrap.querySelectorAll('button,[href],input,[tabindex]:not([tabindex="-1"])'), function (n) { return !n.disabled && n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function logbookBody() {
    var entries = appEntries().filter(function (e) { return e && e.time; })
      .sort(function (a, b) { return new Date(b.time) - new Date(a.time); });
    var byDay = {}, order = [];
    entries.forEach(function (e) {
      var k = dayKey(e.time);
      if (!byDay[k]) { byDay[k] = []; order.push(k); }
      byDay[k].push(e);
    });
    var out = [weekCard(byDay)];
    if (!entries.length) {
      out.push(el('div', { class: 'fc-empty' }, [el('b', { text: 'Nothing logged yet' }), el('span', { text: 'Tell Flora what you ate and it will appear here.' })]));
      return out;
    }
    var todayK = dayKey(new Date()), yest = new Date(); yest.setDate(yest.getDate() - 1);
    var yK = dayKey(yest);
    order.forEach(function (k) {
      var list = byDay[k];
      var sum = r1(list.reduce(function (s, e) { return s + (+e.totalFibreG || 0); }, 0));
      var d = new Date(list[0].time);
      var title = k === todayK ? 'Today' : k === yK ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
      var head = el('div', { class: 'fc-day-h' }, [el('h3', { text: title }), el('span', { html: '<b>' + (Math.round(sum * 2) / 2) + ' g</b> of ' + GOAL_G + ' g' })]);
      var prog = el('div', { class: 'fc-prog', role: 'img', 'aria-label': Math.round(sum) + ' of ' + GOAL_G + ' grams' }, [el('i', { style: 'width:' + Math.min(100, sum / GOAL_G * 100) + '%' })]);
      var ul = el('ul', { class: 'fc-entries' });
      list.forEach(function (e) {
        var t = new Date(e.time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        var foods = (e.foods || []).map(function (f) { return f.name; }).join(', ') || 'No foods';
        var tags = ((e.feelings && e.feelings.tags) || []).map(function (tg) {
          return el('span', { class: 'fc-tag' + (tg === 'great' || tg === 'normal' ? ' fc-good' : ''), text: FEEL_LABEL[tg] || tg });
        });
        var note = e.feelings && e.feelings.note ? el('p', { class: 'fc-note', text: '“' + e.feelings.note + '”' }) : null;
        ul.appendChild(el('li', { class: 'fc-entry' }, [
          el('div', { class: 'fc-entry-h' }, [el('time', { datetime: e.time, text: t }), el('b', { text: (Math.round((+e.totalFibreG || 0) * 2) / 2) + ' g' })]),
          el('p', { text: foods }),
          note,
          tags.length ? el('div', { class: 'fc-tags', 'aria-label': 'Feelings' }, tags) : null
        ]));
      });
      out.push(el('section', { class: 'fc-day' }, [head, prog, ul]));
    });
    return out;
  }

  function weekCard(byDay) {
    var days = [], max = 40;
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
      var k = dayKey(d);
      var sum = r1((byDay[k] || []).reduce(function (s, e) { return s + (+e.totalFibreG || 0); }, 0));
      max = Math.max(max, sum);
      days.push({ d: d, k: k, sum: sum, today: i === 0 });
    }
    var bars = el('div', { class: 'fc-bars' });
    var goalLine = el('div', { class: 'fc-goal' }, [el('span', { text: GOAL_G + ' g' })]);
    goalLine.style.bottom = (GOAL_G / max * 100) + '%';
    bars.appendChild(goalLine);
    var labels = el('div', { class: 'fc-days', 'aria-hidden': 'true' });
    var avg = 0;
    days.forEach(function (x) {
      avg += x.sum;
      var h = x.sum > 0 ? Math.max(4, x.sum / max * 100) : 0;
      var bar = el('div', { class: 'fc-bar' + (x.today ? ' fc-today' : '') + (x.sum >= GOAL_G ? ' fc-met' : '') });
      bar.appendChild(el('em', { text: x.sum ? String(Math.round(x.sum)) : '' }));
      var fill = el('i', { 'data-h': (x.sum > 0 ? h + '%' : '4px') });
      fill.style.height = reduced() ? (x.sum > 0 ? h + '%' : '4px') : '4px';
      if (!x.sum) fill.style.opacity = '.18';
      bar.appendChild(fill);
      bars.appendChild(bar);
      labels.appendChild(el('span', { class: x.today ? 'fc-today' : '', text: x.today ? 'Today' : x.d.toLocaleDateString(undefined, { weekday: 'short' }) }));
    });
    avg = avg / 7;
    var desc = days.map(function (x) { return (x.today ? 'today' : x.d.toLocaleDateString(undefined, { weekday: 'long' })) + ' ' + Math.round(x.sum) + ' g'; }).join(', ');
    bars.setAttribute('role', 'img');
    bars.setAttribute('aria-label', 'Fibre per day for the last 7 days against a ' + GOAL_G + ' g goal: ' + desc);
    return el('section', { class: 'fc-card fc-week' }, [
      el('div', { class: 'fc-week-h' }, [el('b', { text: 'Last 7 days' }), el('span', { text: 'Average ' + Math.round(avg) + ' g a day' })]),
      bars, labels
    ]);
  }

  /* =====================================================================================
     Public API
     ===================================================================================== */
  window.FloraChat = {
    mount: mount,
    onShow: onShow,
    onHide: onHide,
    // extras for the lead and for testing
    reset: reset,
    openLogbook: openLogbook,
    closeLogbook: function () { closeLogbook(); },
    send: function (t) { if (S) send(t); },
    setBrain: function (b) { if (b && b.start && b.reply) FloraBrain = b; },
    get brain() { return FloraBrain; },
    ScriptedBrain: ScriptedBrain,
    parseMeal: parseMeal,
    parseFeelings: parseFeelings,
    FOODS: FOODS,
    GOAL_G: GOAL_G
  };
})();
