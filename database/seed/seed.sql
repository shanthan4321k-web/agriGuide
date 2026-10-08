-- AgriGuide Seed Data (Crops Catalog Reference Data)

INSERT INTO crops (name, local_name_te, local_name_hi, scientific_name, standard_duration_days, optimal_temp_min, optimal_temp_max)
VALUES 
  ('Cotton', 'పత్తి (Patti)', 'कपास (Kapas)', 'Gossypium hirsutum', 160, 21.0, 35.0),
  ('Maize', 'మొక్కజొన్న (Mokka Jonna)', 'मक्का (Makka)', 'Zea mays', 110, 18.0, 32.0),
  ('Paddy', 'వరి (Vari)', 'धान (Dhan)', 'Oryza sativa', 130, 20.0, 35.0),
  ('Chilli', 'మిరప (Mirapa)', 'मिर्च (Mirch)', 'Capsicum annuum', 150, 18.0, 30.0),
  ('Soybean', 'సోయాబీన్ (Soyabean)', 'सोयाबीन (Soyabean)', 'Glycine max', 100, 20.0, 32.0)
ON CONFLICT (name) DO NOTHING;
