-- Local, test and staging only. Safe to re-run.
INSERT INTO organizations (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Org One'),
  ('00000000-0000-0000-0000-000000000002', 'Org Two')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, email, display_name, organization_id) VALUES
  ('10000000-0000-0000-0000-000000000001', 'wfc.admin@example.test', 'Wendy WFC', NULL),
  ('10000000-0000-0000-0000-000000000002', 'consultant@example.test', 'Connie Consultant', NULL),
  ('10000000-0000-0000-0000-000000000003', 'org.admin@example.test', 'Olivia OrgAdmin', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', 'org.staff@example.test', 'Sam OrgStaff', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000005', 'org.admin.noorg@example.test', 'Nora NoOrg', NULL),
  ('10000000-0000-0000-0000-000000000006', 'norole@example.test', 'Nick NoRole', NULL),
  ('10000000-0000-0000-0000-000000000007', 'multirole@example.test', 'Molly MultiRole', '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role) VALUES
  ('10000000-0000-0000-0000-000000000001', 'wfc_admin'),
  ('10000000-0000-0000-0000-000000000002', 'fundraising_consultant'),
  ('10000000-0000-0000-0000-000000000003', 'org_admin'),
  ('10000000-0000-0000-0000-000000000004', 'org_staff'),
  ('10000000-0000-0000-0000-000000000005', 'org_admin'),
  ('10000000-0000-0000-0000-000000000007', 'org_admin'),
  ('10000000-0000-0000-0000-000000000007', 'org_staff')
ON CONFLICT DO NOTHING;
