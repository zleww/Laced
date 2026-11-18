-- Starting price list. Prices are in centavos (8500 = ₱85.00).
-- After this, prices are changed by the owner in the app, not in code.

insert into public.plans (code, name, category, duration_days, duration_months, bonus_months, price_centavos, sort)
values
  ('regular_day',   'Day pass',              'regular', 1,    null, 0,   8500,  10),
  ('student_day',   'Student day pass',      'student', 1,    null, 0,   7500,  20),
  ('trainer_day',   'Day pass with trainer', 'trainer', 1,    null, 0,  38500,  30),
  ('regular_month', 'Monthly',               'regular', null, 1,    0,  95000,  40),
  ('student_month', 'Student monthly',       'student', null, 1,    0,  85000,  50),
  ('trainer_month', 'Monthly with trainer',  'trainer', null, 1,    0, 495000,  60),
  ('promo_2m',      '2 months',              'promo',   null, 2,    0, 170000,  70),
  ('promo_3m',      '3 months',              'promo',   null, 3,    0, 255000,  80),
  ('promo_4m',      '4 months',              'promo',   null, 4,    0, 350000,  90),
  ('promo_6m',      '6 months',              'promo',   null, 6,    0, 510000, 100),
  ('promo_1y',      '1 year + 1 month free', 'promo',   null, 12,   1, 900000, 110);
