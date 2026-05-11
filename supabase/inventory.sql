-- Run this in Supabase SQL Editor to create inventory tables

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'other',
  unit text not null default 'each',
  unit_size text,
  par_stock numeric not null default 0,
  current_stock numeric not null default 0,
  supplier_id uuid references suppliers(id) on delete set null,
  backup_supplier_id uuid references suppliers(id) on delete set null,
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

create index if not exists inventory_items_category_idx on inventory_items(category);

alter table suppliers enable row level security;
alter table inventory_items enable row level security;
create policy "authenticated all suppliers" on suppliers for all to authenticated using (true) with check (true);
create policy "authenticated all inventory_items" on inventory_items for all to authenticated using (true) with check (true);

-- Seed suppliers (placeholders — update with real supplier info)
insert into suppliers (name, notes) values
  ('Main Supplier', 'Primary food & beverage supplier'),
  ('Backup Supplier', 'Secondary/emergency orders');

-- Seed inventory items extracted from Ché Bar menus
-- Categories: produce, dairy, meat, seafood, bakery, dry-goods, beverages-alcohol, beverages-non-alcohol, bar-supplies, paper-goods, condiments-sauces

insert into inventory_items (name, category, unit, unit_size, par_stock) values
-- PRODUCE
('Apples', 'produce', 'case', null, 2),
('Bananas', 'produce', 'case', null, 3),
('Strawberries', 'produce', 'flat', null, 2),
('Blueberries', 'produce', 'pint', null, 4),
('Fresh fruit (mixed)', 'produce', 'case', null, 2),
('Passion fruit', 'produce', 'each', null, 12),
('Mango', 'produce', 'each', null, 10),
('Pineapple', 'produce', 'each', null, 4),
('Limes', 'produce', 'bag', null, 5),
('Lemons', 'produce', 'bag', null, 3),
('Oranges', 'produce', 'bag', null, 3),
('Grapefruit', 'produce', 'each', null, 6),
('Onions', 'produce', 'bag', '10 lb', 2),
('Bell peppers', 'produce', 'each', null, 10),
('Jalapeños', 'produce', 'lb', null, 2),
('Tomatoes', 'produce', 'case', null, 2),
('Cherry tomatoes', 'produce', 'pint', null, 4),
('Lettuce', 'produce', 'head', null, 6),
('Fresh basil', 'produce', 'bunch', null, 4),
('Fresh mint', 'produce', 'bunch', null, 3),
('Arugula', 'produce', 'bag', null, 3),
('Mushrooms', 'produce', 'lb', null, 4),
('Portobello mushrooms', 'produce', 'lb', null, 2),
('Black olives', 'produce', 'can', null, 4),
('Artichoke hearts', 'produce', 'can', null, 3),
('Potatoes (skillet)', 'produce', 'bag', '10 lb', 2),
('Spinach', 'produce', 'bag', null, 3),
('Rosemary', 'produce', 'bunch', null, 2),
('Walnuts', 'produce', 'bag', null, 2),
('Raisins', 'produce', 'bag', null, 2),

-- DAIRY & CHEESE
('Eggs', 'dairy', 'case', '30 ct', 4),
('Milk', 'dairy', 'gallon', null, 4),
('Butter', 'dairy', 'lb', null, 6),
('Whipped cream', 'dairy', 'can', null, 6),
('Heavy cream', 'dairy', 'quart', null, 3),
('Gouda cheese', 'dairy', 'lb', null, 3),
('Mozzarella', 'dairy', 'lb', null, 8),
('Fior di latte', 'dairy', 'lb', null, 4),
('Parmesan', 'dairy', 'lb', null, 3),
('Cream cheese', 'dairy', 'lb', null, 3),
('Brie', 'dairy', 'wheel', null, 2),
('Ricotta', 'dairy', 'container', null, 3),
('Burrata', 'dairy', 'each', null, 6),
('Cheddar cheese', 'dairy', 'lb', null, 3),
('Bailey''s Irish Cream', 'dairy', 'bottle', '750ml', 2),

-- MEAT & PROTEIN
('Bacon', 'meat', 'lb', null, 8),
('Turkey bacon', 'meat', 'lb', null, 3),
('Ham', 'meat', 'lb', null, 4),
('Chorizo (breakfast)', 'meat', 'lb', null, 3),
('Italian chorizo', 'meat', 'lb', null, 3),
('Pepperoni', 'meat', 'lb', null, 4),
('Salami', 'meat', 'lb', null, 2),
('Prosciutto', 'meat', 'lb', null, 2),
('Chicken breast (shredded)', 'meat', 'lb', null, 4),
('Ground beef (empanadas)', 'meat', 'lb', null, 4),
('Chicken (empanadas)', 'meat', 'lb', null, 3),

-- SEAFOOD
('Smoked salmon', 'seafood', 'lb', null, 2),

-- BAKERY & DOUGH
('Dutch pancake batter mix', 'bakery', 'batch', null, 2),
('Pizza dough', 'bakery', 'ball', null, 15),
('French bread', 'bakery', 'loaf', null, 6),
('Toast bread', 'bakery', 'loaf', null, 4),
('Tortillas (large)', 'bakery', 'pack', null, 3),
('Bagels', 'bakery', 'dozen', null, 3),
('Graham crackers', 'bakery', 'box', null, 2),
('Empanada shells', 'bakery', 'pack', null, 4),

-- DRY GOODS & PANTRY
('Flour', 'dry-goods', 'bag', '25 lb', 2),
('Sugar', 'dry-goods', 'bag', '10 lb', 2),
('Cinnamon', 'dry-goods', 'container', null, 2),
('Oregano (dried)', 'dry-goods', 'container', null, 2),
('Salt', 'dry-goods', 'box', null, 3),
('Black pepper', 'dry-goods', 'container', null, 2),
('Olive oil', 'dry-goods', 'bottle', '1L', 4),
('Vegetable oil', 'dry-goods', 'bottle', '1 gal', 2),
('Tomato sauce (cans)', 'dry-goods', 'can', '#10', 7),
('BBQ sauce', 'dry-goods', 'bottle', null, 2),
('Peanut butter', 'dry-goods', 'jar', null, 2),
('Nutella', 'dry-goods', 'jar', null, 3),
('Dulce de leche', 'dry-goods', 'jar', null, 2),
('Honey', 'dry-goods', 'bottle', null, 3),
('Marshmallows', 'dry-goods', 'bag', null, 2),
('Chocolate (topping)', 'dry-goods', 'bag', null, 2),
('Capers', 'dry-goods', 'jar', null, 2),
('Vanilla ice cream', 'dry-goods', 'tub', null, 2),
('Simple syrup', 'dry-goods', 'bottle', null, 3),
('Grenadine', 'dry-goods', 'bottle', null, 3),

-- CONDIMENTS & SAUCES
('Guacamole', 'condiments-sauces', 'batch', null, 2),
('Pico de gallo', 'condiments-sauces', 'batch', null, 2),
('Ketchup', 'condiments-sauces', 'bottle', null, 4),
('Hot sauce', 'condiments-sauces', 'bottle', null, 3),

-- BEVERAGES - ALCOHOL
('Tito''s Vodka', 'beverages-alcohol', 'bottle', '1.75L', 4),
('Grey Goose Vodka', 'beverages-alcohol', 'bottle', '750ml', 2),
('Bacardi Rum', 'beverages-alcohol', 'bottle', '1.75L', 3),
('White rum', 'beverages-alcohol', 'bottle', '1.75L', 2),
('Casamigos Reposado', 'beverages-alcohol', 'bottle', '750ml', 2),
('Tequila', 'beverages-alcohol', 'bottle', '1.75L', 2),
('Gin', 'beverages-alcohol', 'bottle', '1.75L', 2),
('Triple sec', 'beverages-alcohol', 'bottle', '1L', 3),
('Amaretto', 'beverages-alcohol', 'bottle', '750ml', 2),
('Chambord (raspberry liqueur)', 'beverages-alcohol', 'bottle', '750ml', 1),
('Coffee liqueur', 'beverages-alcohol', 'bottle', '750ml', 2),
('Melon liqueur', 'beverages-alcohol', 'bottle', '750ml', 1),
('Banana liqueur', 'beverages-alcohol', 'bottle', '750ml', 1),
('Limoncello', 'beverages-alcohol', 'bottle', '750ml', 1),
('Blue curacao', 'beverages-alcohol', 'bottle', '750ml', 2),
('Aperol', 'beverages-alcohol', 'bottle', '750ml', 2),
('Prosecco', 'beverages-alcohol', 'bottle', '750ml', 6),
('Champagne (mimosas)', 'beverages-alcohol', 'bottle', '750ml', 6),
('Trapiche Merlot', 'beverages-alcohol', 'bottle', '750ml', 6),
('Trapiche Cabernet-Malbec', 'beverages-alcohol', 'bottle', '750ml', 6),
('Trapiche Chardonnay', 'beverages-alcohol', 'bottle', '750ml', 4),
('Trapiche Pinot Grigio', 'beverages-alcohol', 'bottle', '750ml', 4),
('Trapiche Sauvignon Blanc', 'beverages-alcohol', 'bottle', '750ml', 4),
('Balashi (local beer)', 'beverages-alcohol', 'case', '24 ct', 3),
('Chill (local beer)', 'beverages-alcohol', 'case', '24 ct', 2),
('Magic Mango (local beer)', 'beverages-alcohol', 'case', '24 ct', 2),
('Amstel Bright', 'beverages-alcohol', 'case', '24 ct', 3),
('Heineken', 'beverages-alcohol', 'case', '24 ct', 3),
('Miller Lite', 'beverages-alcohol', 'case', '24 ct', 2),
('Coors Light', 'beverages-alcohol', 'case', '24 ct', 2),
('Coronita', 'beverages-alcohol', 'case', '24 ct', 2),

-- BEVERAGES - NON-ALCOHOL
('Coffee beans (espresso)', 'beverages-non-alcohol', 'bag', '5 lb', 3),
('Tea bags (assorted)', 'beverages-non-alcohol', 'box', null, 3),
('Hot chocolate mix', 'beverages-non-alcohol', 'bag', null, 2),
('Orange juice', 'beverages-non-alcohol', 'bottle', '1 gal', 4),
('Pineapple juice', 'beverages-non-alcohol', 'bottle', '1 gal', 3),
('Cranberry juice', 'beverages-non-alcohol', 'bottle', '1 gal', 2),
('Fresh lemonade mix', 'beverages-non-alcohol', 'batch', null, 2),
('Ginger beer', 'beverages-non-alcohol', 'case', null, 2),
('Club soda', 'beverages-non-alcohol', 'case', null, 3),
('Grapefruit soda', 'beverages-non-alcohol', 'case', null, 2),
('Coke', 'beverages-non-alcohol', 'case', null, 3),
('Fruit punch', 'beverages-non-alcohol', 'bottle', null, 2),
('Coconut cream (pina colada)', 'beverages-non-alcohol', 'can', null, 4),
('Hazelnut syrup', 'beverages-non-alcohol', 'bottle', null, 2),
('Caramel syrup', 'beverages-non-alcohol', 'bottle', null, 2),
('Vanilla syrup', 'beverages-non-alcohol', 'bottle', null, 2),
('Coconut syrup', 'beverages-non-alcohol', 'bottle', null, 2),
('White chocolate syrup', 'beverages-non-alcohol', 'bottle', null, 2),
('Amaretto syrup', 'beverages-non-alcohol', 'bottle', null, 1),
('Bloody Mary mix', 'beverages-non-alcohol', 'bottle', null, 2),

-- BAR SUPPLIES
('Cocktail straws', 'bar-supplies', 'box', null, 3),
('Cocktail napkins', 'bar-supplies', 'pack', null, 5),
('Sugar rim', 'bar-supplies', 'container', null, 2),
('Cocktail picks', 'bar-supplies', 'box', null, 2),

-- PAPER GOODS & SUPPLIES
('Paper cups (small)', 'paper-goods', 'sleeve', null, 4),
('Paper cups (large)', 'paper-goods', 'sleeve', null, 4),
('Lids (small)', 'paper-goods', 'sleeve', null, 4),
('Lids (large)', 'paper-goods', 'sleeve', null, 4),
('Napkins', 'paper-goods', 'pack', null, 6),
('To-go containers', 'paper-goods', 'pack', null, 4),
('To-go bags', 'paper-goods', 'pack', null, 3),
('Aluminum foil', 'paper-goods', 'roll', null, 3),
('Plastic wrap', 'paper-goods', 'roll', null, 2),
('Trash bags', 'paper-goods', 'roll', null, 4),
('Gloves (disposable)', 'paper-goods', 'box', null, 4),
('Paper towels', 'paper-goods', 'case', null, 2),
('Dish soap', 'paper-goods', 'bottle', null, 3),
('Sanitizer', 'paper-goods', 'bottle', null, 3);
