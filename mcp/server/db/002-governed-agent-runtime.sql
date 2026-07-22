-- Governed, provider-neutral model runs and owner review outcomes.
-- Apply after 001-control-plane.sql with a migration role.

create table if not exists approved_evidence (
  organization_id text not null references organizations(id) on delete cascade,
  ref text not null,
  property_slug text,
  excerpt text not null,
  source_type text not null check (source_type in ('property-profile', 'knowledge-article', 'policy', 'listing-fact')),
  source_version_hash text not null,
  content_hash text not null,
  approved_by text not null,
  approved_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, ref)
);

create table if not exists agent_runs (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  mission_id text not null references agent_missions(id) on delete cascade,
  property_slug text,
  role text not null,
  output_type text not null check (output_type in (
    'listing-draft', 'inquiry-reply', 'renter-guide', 'maintenance-triage',
    'vacancy-review', 'renovation-plan', 'weekly-owner-review'
  )),
  status text not null check (status in ('owner-review', 'accepted', 'revision-requested', 'rejected')),
  authority text not null check (authority = 'draft-only'),
  model_alias text not null,
  prompt_version text not null,
  evidence_refs jsonb not null default '[]'::jsonb,
  output jsonb not null,
  output_hash text not null,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  latency_ms integer not null check (latency_ms >= 0),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  owner_decision text check (owner_decision in ('accept-draft', 'request-revision', 'reject-draft')),
  review_feedback text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now()
);

alter table approved_evidence enable row level security;
alter table approved_evidence force row level security;
alter table agent_runs enable row level security;
alter table agent_runs force row level security;

drop policy if exists approved_evidence_tenant_isolation on approved_evidence;
create policy approved_evidence_tenant_isolation on approved_evidence
  for all using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists agent_runs_tenant_isolation on agent_runs;
create policy agent_runs_tenant_isolation on agent_runs
  for all using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

create index if not exists approved_evidence_property_idx on approved_evidence (organization_id, property_slug, updated_at desc);
create index if not exists agent_runs_org_created_idx on agent_runs (organization_id, created_at desc);
create index if not exists agent_runs_mission_created_idx on agent_runs (mission_id, created_at desc);
create index if not exists agent_runs_review_idx on agent_runs (organization_id, status, created_at desc);
