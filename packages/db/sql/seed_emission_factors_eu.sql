-- Seed: Emission Factors for DE/AT/CH/EU
-- Source: Based on DEFRA 2024, UBA (Umweltbundesamt DE), GEMIS, IEA
-- Covers: Electricity, Natural Gas, Diesel, Petrol, District Heating, LPG
-- Unit: kgCO2e per unit (kWh, liter, m³, MJ)

-- Electricity Grid Factors (Scope 2 — Location-based)
INSERT INTO emission_factor (id, factor_source, activity_type, fuel_type, unit, co2e_factor, co2_factor, ch4_factor, n2o_factor, valid_year, country, is_custom)
VALUES
  (gen_random_uuid(), 'UBA_DE_2024', 'electricity', 'grid_mix', 'kgCO2e/kWh', 0.380, 0.366, 0.008, 0.006, 2024, 'DE', false),
  (gen_random_uuid(), 'E-CONTROL_AT_2024', 'electricity', 'grid_mix', 'kgCO2e/kWh', 0.158, 0.150, 0.005, 0.003, 2024, 'AT', false),
  (gen_random_uuid(), 'BAFU_CH_2024', 'electricity', 'grid_mix', 'kgCO2e/kWh', 0.128, 0.122, 0.004, 0.002, 2024, 'CH', false),
  (gen_random_uuid(), 'IEA_EU27_2024', 'electricity', 'grid_mix', 'kgCO2e/kWh', 0.259, 0.250, 0.005, 0.004, 2024, 'EU', false),
  (gen_random_uuid(), 'DEFRA_UK_2024', 'electricity', 'grid_mix', 'kgCO2e/kWh', 0.207, 0.200, 0.004, 0.003, 2024, 'UK', false),
  (gen_random_uuid(), 'IEA_FR_2024', 'electricity', 'grid_mix', 'kgCO2e/kWh', 0.052, 0.048, 0.002, 0.002, 2024, 'FR', false),
  (gen_random_uuid(), 'IEA_NL_2024', 'electricity', 'grid_mix', 'kgCO2e/kWh', 0.328, 0.316, 0.007, 0.005, 2024, 'NL', false),
  (gen_random_uuid(), 'IEA_PL_2024', 'electricity', 'grid_mix', 'kgCO2e/kWh', 0.635, 0.612, 0.013, 0.010, 2024, 'PL', false),
  (gen_random_uuid(), 'IEA_IT_2024', 'electricity', 'grid_mix', 'kgCO2e/kWh', 0.257, 0.248, 0.005, 0.004, 2024, 'IT', false),
  (gen_random_uuid(), 'IEA_ES_2024', 'electricity', 'grid_mix', 'kgCO2e/kWh', 0.172, 0.166, 0.004, 0.002, 2024, 'ES', false)
ON CONFLICT DO NOTHING;

-- Natural Gas (Scope 1)
INSERT INTO emission_factor (id, factor_source, activity_type, fuel_type, unit, co2e_factor, co2_factor, ch4_factor, n2o_factor, valid_year, country, is_custom)
VALUES
  (gen_random_uuid(), 'UBA_DE_2024', 'stationary_combustion', 'natural_gas', 'kgCO2e/kWh', 0.201, 0.198, 0.002, 0.001, 2024, 'DE', false),
  (gen_random_uuid(), 'DEFRA_2024', 'stationary_combustion', 'natural_gas', 'kgCO2e/m3', 2.02, 1.99, 0.02, 0.01, 2024, 'EU', false)
ON CONFLICT DO NOTHING;

-- Diesel (Scope 1 — Fleet/Transport)
INSERT INTO emission_factor (id, factor_source, activity_type, fuel_type, unit, co2e_factor, co2_factor, ch4_factor, n2o_factor, valid_year, country, is_custom)
VALUES
  (gen_random_uuid(), 'DEFRA_2024', 'mobile_combustion', 'diesel', 'kgCO2e/liter', 2.68, 2.65, 0.01, 0.02, 2024, 'EU', false),
  (gen_random_uuid(), 'DEFRA_2024', 'mobile_combustion', 'diesel', 'kgCO2e/kWh', 0.267, 0.264, 0.001, 0.002, 2024, 'EU', false)
ON CONFLICT DO NOTHING;

-- Petrol/Benzin (Scope 1 — Fleet)
INSERT INTO emission_factor (id, factor_source, activity_type, fuel_type, unit, co2e_factor, co2_factor, ch4_factor, n2o_factor, valid_year, country, is_custom)
VALUES
  (gen_random_uuid(), 'DEFRA_2024', 'mobile_combustion', 'petrol', 'kgCO2e/liter', 2.31, 2.28, 0.01, 0.02, 2024, 'EU', false),
  (gen_random_uuid(), 'DEFRA_2024', 'mobile_combustion', 'petrol', 'kgCO2e/kWh', 0.249, 0.246, 0.001, 0.002, 2024, 'EU', false)
ON CONFLICT DO NOTHING;

-- LPG (Scope 1)
INSERT INTO emission_factor (id, factor_source, activity_type, fuel_type, unit, co2e_factor, co2_factor, ch4_factor, n2o_factor, valid_year, country, is_custom)
VALUES
  (gen_random_uuid(), 'DEFRA_2024', 'stationary_combustion', 'lpg', 'kgCO2e/kWh', 0.214, 0.212, 0.001, 0.001, 2024, 'EU', false),
  (gen_random_uuid(), 'DEFRA_2024', 'stationary_combustion', 'lpg', 'kgCO2e/liter', 1.56, 1.54, 0.01, 0.01, 2024, 'EU', false)
ON CONFLICT DO NOTHING;

-- District Heating / Fernwaerme (Scope 2)
INSERT INTO emission_factor (id, factor_source, activity_type, fuel_type, unit, co2e_factor, co2_factor, ch4_factor, n2o_factor, valid_year, country, is_custom)
VALUES
  (gen_random_uuid(), 'UBA_DE_2024', 'district_heating', 'heat_mix', 'kgCO2e/kWh', 0.182, 0.178, 0.002, 0.002, 2024, 'DE', false),
  (gen_random_uuid(), 'E-CONTROL_AT_2024', 'district_heating', 'heat_mix', 'kgCO2e/kWh', 0.140, 0.136, 0.002, 0.002, 2024, 'AT', false),
  (gen_random_uuid(), 'BAFU_CH_2024', 'district_heating', 'heat_mix', 'kgCO2e/kWh', 0.120, 0.116, 0.002, 0.002, 2024, 'CH', false)
ON CONFLICT DO NOTHING;

-- Heating Oil / Heizoel (Scope 1)
INSERT INTO emission_factor (id, factor_source, activity_type, fuel_type, unit, co2e_factor, co2_factor, ch4_factor, n2o_factor, valid_year, country, is_custom)
VALUES
  (gen_random_uuid(), 'DEFRA_2024', 'stationary_combustion', 'heating_oil', 'kgCO2e/liter', 2.96, 2.93, 0.01, 0.02, 2024, 'EU', false),
  (gen_random_uuid(), 'DEFRA_2024', 'stationary_combustion', 'heating_oil', 'kgCO2e/kWh', 0.266, 0.263, 0.001, 0.002, 2024, 'EU', false)
ON CONFLICT DO NOTHING;

-- Business Travel (Scope 3 — Category 6)
INSERT INTO emission_factor (id, factor_source, activity_type, fuel_type, unit, co2e_factor, co2_factor, ch4_factor, n2o_factor, valid_year, country, is_custom)
VALUES
  (gen_random_uuid(), 'DEFRA_2024', 'business_travel', 'short_haul_flight', 'kgCO2e/pkm', 0.156, 0.151, 0.003, 0.002, 2024, 'EU', false),
  (gen_random_uuid(), 'DEFRA_2024', 'business_travel', 'long_haul_flight', 'kgCO2e/pkm', 0.195, 0.190, 0.003, 0.002, 2024, 'EU', false),
  (gen_random_uuid(), 'DEFRA_2024', 'business_travel', 'economy_flight', 'kgCO2e/pkm', 0.148, 0.143, 0.003, 0.002, 2024, 'EU', false),
  (gen_random_uuid(), 'DEFRA_2024', 'business_travel', 'business_flight', 'kgCO2e/pkm', 0.429, 0.416, 0.008, 0.005, 2024, 'EU', false),
  (gen_random_uuid(), 'UBA_DE_2024', 'business_travel', 'train_long_distance', 'kgCO2e/pkm', 0.029, 0.028, 0.001, 0.000, 2024, 'DE', false),
  (gen_random_uuid(), 'UBA_DE_2024', 'business_travel', 'train_local', 'kgCO2e/pkm', 0.055, 0.053, 0.001, 0.001, 2024, 'DE', false),
  (gen_random_uuid(), 'DEFRA_2024', 'business_travel', 'taxi', 'kgCO2e/pkm', 0.149, 0.145, 0.002, 0.002, 2024, 'EU', false),
  (gen_random_uuid(), 'DEFRA_2024', 'business_travel', 'hotel_night', 'kgCO2e/night', 20.6, 19.8, 0.5, 0.3, 2024, 'EU', false)
ON CONFLICT DO NOTHING;

-- Commuting / Pendlerverkehr (Scope 3 — Category 7)
INSERT INTO emission_factor (id, factor_source, activity_type, fuel_type, unit, co2e_factor, co2_factor, ch4_factor, n2o_factor, valid_year, country, is_custom)
VALUES
  (gen_random_uuid(), 'UBA_DE_2024', 'commuting', 'car_average', 'kgCO2e/pkm', 0.143, 0.139, 0.002, 0.002, 2024, 'DE', false),
  (gen_random_uuid(), 'UBA_DE_2024', 'commuting', 'bus', 'kgCO2e/pkm', 0.089, 0.086, 0.002, 0.001, 2024, 'DE', false),
  (gen_random_uuid(), 'UBA_DE_2024', 'commuting', 'ebike', 'kgCO2e/pkm', 0.005, 0.005, 0.000, 0.000, 2024, 'DE', false),
  (gen_random_uuid(), 'UBA_DE_2024', 'commuting', 'bicycle', 'kgCO2e/pkm', 0.000, 0.000, 0.000, 0.000, 2024, 'DE', false)
ON CONFLICT DO NOTHING;

-- Waste / Abfall (Scope 3 — Category 5)
INSERT INTO emission_factor (id, factor_source, activity_type, fuel_type, unit, co2e_factor, co2_factor, ch4_factor, n2o_factor, valid_year, country, is_custom)
VALUES
  (gen_random_uuid(), 'DEFRA_2024', 'waste', 'mixed_waste_landfill', 'kgCO2e/tonne', 586.0, 450.0, 120.0, 16.0, 2024, 'EU', false),
  (gen_random_uuid(), 'DEFRA_2024', 'waste', 'mixed_waste_incineration', 'kgCO2e/tonne', 21.3, 21.0, 0.2, 0.1, 2024, 'EU', false),
  (gen_random_uuid(), 'DEFRA_2024', 'waste', 'paper_recycling', 'kgCO2e/tonne', 21.3, 21.0, 0.2, 0.1, 2024, 'EU', false),
  (gen_random_uuid(), 'DEFRA_2024', 'waste', 'ewaste_recycling', 'kgCO2e/tonne', 21.3, 21.0, 0.2, 0.1, 2024, 'EU', false)
ON CONFLICT DO NOTHING;

-- Water / Wasser (Scope 3)
INSERT INTO emission_factor (id, factor_source, activity_type, fuel_type, unit, co2e_factor, co2_factor, ch4_factor, n2o_factor, valid_year, country, is_custom)
VALUES
  (gen_random_uuid(), 'DEFRA_2024', 'water', 'water_supply', 'kgCO2e/m3', 0.149, 0.145, 0.002, 0.002, 2024, 'EU', false),
  (gen_random_uuid(), 'DEFRA_2024', 'water', 'wastewater', 'kgCO2e/m3', 0.272, 0.240, 0.020, 0.012, 2024, 'EU', false)
ON CONFLICT DO NOTHING;
