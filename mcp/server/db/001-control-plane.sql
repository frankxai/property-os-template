-- Durable Property OS control-plane substrate.
-- Apply with a migration role, then run the MCP service with a non-bypass-RLS role.

create table if not exists organizations (
  id text primary key,
  name text not null,
  plan text not null default 'pilot',
  country text not null default 'Germany',
  created_at timestamptz not null default now()
);

create table if not exists agent_missions (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  role text not null,
  property_slug text,
  objective text not null,
  success_metric text not null,
  status text not null check (status in ('planned', 'grounding', 'drafting', 'owner-review', 'verified', 'stopped')),
  authority text not null check (authority = 'draft-only'),
  stages jsonb not null default '[]'::jsonb,
  owner_action text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists resource_versions (
  organization_id text not null references organizations(id) on delete cascade,
  resource_id text not null,
  version_hash text not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, resource_id)
);

create table if not exists transition_proposals (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  operation text not null,
  resource_id text not null,
  base_version_hash text not null,
  payload_hash text not null,
  summary text not null,
  status text not null check (status in ('pending', 'approved', 'rejected', 'applied', 'superseded')),
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists approval_receipts (
  id text primary key,
  proposal_id text not null references transition_proposals(id) on delete cascade,
  organization_id text not null references organizations(id) on delete cascade,
  actor_id text not null,
  actor_role text not null,
  operation text not null,
  resource_id text not null,
  base_version_hash text not null,
  payload_hash text not null,
  policy_version text not null,
  scopes jsonb not null default '[]'::jsonb,
  status text not null check (status in ('active', 'consumed', 'revoked', 'expired')),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create table if not exists controlled_transitions (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  proposal_id text not null references transition_proposals(id),
  approval_receipt_id text not null references approval_receipts(id),
  idempotency_key text not null,
  operation text not null,
  resource_id text not null,
  previous_version_hash text not null,
  new_version_hash text not null,
  undo_metadata jsonb not null default '{}'::jsonb,
  applied_by text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table if not exists audit_events (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  actor text not null,
  event_type text not null,
  subject_type text not null,
  subject_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function property_os_current_organization_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('property_os.organization_id', true), '')
$$;

alter table organizations enable row level security;
alter table organizations force row level security;
alter table agent_missions enable row level security;
alter table agent_missions force row level security;
alter table resource_versions enable row level security;
alter table resource_versions force row level security;
alter table transition_proposals enable row level security;
alter table transition_proposals force row level security;
alter table approval_receipts enable row level security;
alter table approval_receipts force row level security;
alter table controlled_transitions enable row level security;
alter table controlled_transitions force row level security;
alter table audit_events enable row level security;
alter table audit_events force row level security;

drop policy if exists organizations_tenant_isolation on organizations;
create policy organizations_tenant_isolation on organizations
  for all using (id = property_os_current_organization_id())
  with check (id = property_os_current_organization_id());

drop policy if exists agent_missions_tenant_isolation on agent_missions;
create policy agent_missions_tenant_isolation on agent_missions
  for all using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists resource_versions_tenant_isolation on resource_versions;
create policy resource_versions_tenant_isolation on resource_versions
  for all using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists transition_proposals_tenant_isolation on transition_proposals;
create policy transition_proposals_tenant_isolation on transition_proposals
  for all using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists approval_receipts_tenant_isolation on approval_receipts;
create policy approval_receipts_tenant_isolation on approval_receipts
  for all using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists controlled_transitions_tenant_isolation on controlled_transitions;
create policy controlled_transitions_tenant_isolation on controlled_transitions
  for all using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists audit_events_tenant_isolation on audit_events;
create policy audit_events_tenant_isolation on audit_events
  for all using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

create index if not exists agent_missions_org_created_idx on agent_missions (organization_id, created_at desc);
create index if not exists proposals_org_status_idx on transition_proposals (organization_id, status, created_at desc);
create index if not exists receipts_org_status_idx on approval_receipts (organization_id, status, expires_at);
create index if not exists audit_org_created_idx on audit_events (organization_id, created_at desc);
