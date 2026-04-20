-- Sprint 63: Cloud Infrastructure Connectors
-- Migration 945: Seed base connector types for file_import, custom_api, manual

INSERT INTO connector_test_definition (test_key, connector_type, provider_key, name, description, category, severity, framework_mappings, test_logic) VALUES
  ('file_import_csv', 'file_import', 'file_import', 'CSV File Import', 'Import evidence from CSV file', 'configuration', 'informational', '[]', '{"apiCalls":[],"evaluationRules":[]}'),
  ('file_import_json', 'file_import', 'file_import', 'JSON File Import', 'Import evidence from JSON file', 'configuration', 'informational', '[]', '{"apiCalls":[],"evaluationRules":[]}'),
  ('custom_api_rest', 'custom_api', 'custom_api', 'Custom REST API', 'Collect evidence from custom REST endpoint', 'configuration', 'informational', '[]', '{"apiCalls":[],"evaluationRules":[]}')
ON CONFLICT (test_key) DO NOTHING;
