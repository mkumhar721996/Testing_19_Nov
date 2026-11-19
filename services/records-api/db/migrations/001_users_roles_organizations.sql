CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  identity_subject text UNIQUE,
  organization_id uuid REFERENCES organizations (id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users (id),
  role text NOT NULL CHECK (role IN ('wfc_admin', 'fundraising_consultant', 'org_admin', 'org_staff')),
  PRIMARY KEY (user_id, role)
);
