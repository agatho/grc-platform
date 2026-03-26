-- ============================================================================
-- ARCTOS Seed: work_item_type extensions for Sprint 5-9
-- Extends Sprint 1.4 work_item_type table
-- Sprint 1.4 already has: task, action, single_risk, risk_scenario, control,
--   control_test, finding, incident, protection_requirement, vulnerability
-- ============================================================================

-- Sprint 5b: ISMS Assessment & SoA
INSERT INTO work_item_type (type_key, display_name_de, display_name_en, icon, color_class, primary_module, secondary_modules, has_linked_asset, has_cia_evaluation, is_cross_module, nav_order) VALUES
('assessment_run', 'ISMS-Assessment', 'ISMS Assessment', 'clipboard-list', 'text-blue-700', 'isms', '{"audit"}', false, false, false, 95),
('soa_entry', 'SoA-Eintrag', 'SoA Entry', 'check-square', 'text-green-700', 'isms', '{"audit"}', false, false, false, 96),
('management_review', 'Management Review', 'Management Review', 'file-text', 'text-slate-700', 'isms', '{}', false, false, false, 97)
ON CONFLICT (type_key) DO NOTHING;

-- Sprint 6: BCMS
INSERT INTO work_item_type (type_key, display_name_de, display_name_en, icon, color_class, primary_module, secondary_modules, has_linked_asset, has_cia_evaluation, is_cross_module, nav_order) VALUES
('bcp', 'Notfallplan', 'Business Continuity Plan', 'file-text', 'text-emerald-700', 'bcms', '{}', false, false, false, 100),
('crisis_scenario', 'Krisenszenario', 'Crisis Scenario', 'alert-triangle', 'text-red-700', 'bcms', '{}', false, false, false, 105),
('bc_exercise', 'BC-Übung', 'BC Exercise', 'play-circle', 'text-cyan-700', 'bcms', '{"audit"}', false, false, false, 110),
('bia_assessment', 'BIA', 'Business Impact Analysis', 'bar-chart-2', 'text-amber-700', 'bcms', '{}', false, false, false, 115)
ON CONFLICT (type_key) DO NOTHING;

-- Sprint 7: DPMS
INSERT INTO work_item_type (type_key, display_name_de, display_name_en, icon, color_class, primary_module, secondary_modules, has_linked_asset, has_cia_evaluation, is_cross_module, nav_order) VALUES
('ropa_entry', 'Verarbeitungstätigkeit', 'Processing Activity', 'database', 'text-violet-700', 'dpms', '{}', false, false, false, 120),
('dpia', 'DSFA', 'DPIA', 'file-search', 'text-purple-700', 'dpms', '{}', false, false, false, 125),
('dsr', 'Betroffenenanfrage', 'Data Subject Request', 'user-check', 'text-sky-700', 'dpms', '{}', false, false, false, 130),
('data_breach', 'Datenpanne', 'Data Breach', 'alert-circle', 'text-rose-700', 'dpms', '{"isms"}', false, true, true, 135),
('tia', 'Drittlandtransfer', 'Transfer Impact Assessment', 'globe', 'text-indigo-600', 'dpms', '{}', false, false, false, 140)
ON CONFLICT (type_key) DO NOTHING;

-- Sprint 8: Audit
INSERT INTO work_item_type (type_key, display_name_de, display_name_en, icon, color_class, primary_module, secondary_modules, has_linked_asset, has_cia_evaluation, is_cross_module, nav_order) VALUES
('audit', 'Audit', 'Audit', 'clipboard-check', 'text-amber-800', 'audit', '{}', false, false, false, 145),
('audit_plan', 'Audit-Plan', 'Audit Plan', 'calendar', 'text-amber-600', 'audit', '{}', false, false, false, 150)
ON CONFLICT (type_key) DO NOTHING;

-- Sprint 9: TPRM + Contracts
INSERT INTO work_item_type (type_key, display_name_de, display_name_en, icon, color_class, primary_module, secondary_modules, has_linked_asset, has_cia_evaluation, is_cross_module, nav_order) VALUES
('vendor', 'Lieferant', 'Vendor', 'building', 'text-orange-700', 'tprm', '{"contract"}', false, false, false, 155),
('vendor_assessment', 'Lieferantenbewertung', 'Vendor Assessment', 'bar-chart', 'text-orange-600', 'tprm', '{}', false, false, false, 160),
('contract', 'Vertrag', 'Contract', 'file-signature', 'text-teal-700', 'contract', '{"tprm"}', false, false, true, 165),
('lksg_assessment', 'LkSG-Bewertung', 'Supply Chain Assessment', 'globe', 'text-green-800', 'tprm', '{}', false, false, false, 170)
ON CONFLICT (type_key) DO NOTHING;

-- Element ID prefix mapping (for generate_work_item_element_id trigger)
-- task=TSK, action=ACT, single_risk=RSK, control=CTL, control_test=CMT,
-- finding=FND, incident=INC, protection_requirement=PRQ, vulnerability=VUL,
-- + NEW:
-- assessment_run=ASM, soa_entry=SOA, management_review=MRV, bcp=BCP,
-- crisis_scenario=CRS, bc_exercise=BCX, bia_assessment=BIA, ropa_entry=RPA,
-- dpia=DPA, dsr=DSR, data_breach=BRC, tia=TIA, audit=AUD, audit_plan=APL,
-- vendor=VND, vendor_assessment=VAS, contract=CON, lksg_assessment=LKS
