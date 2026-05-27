-- AI Court Simulation MVP schema for Supabase.
-- Run this in the Supabase SQL Editor after enabling the project.

create extension if not exists "uuid-ossp";
create extension if not exists vector;

create type public.case_type as enum (
  'civil',
  'criminal',
  'family',
  'juvenile'
);

create type public.case_status as enum (
  'draft',
  'intake',
  'clarifying',
  'evidence_review',
  'strategy_review',
  'ready_for_simulation',
  'simulating',
  'judged',
  'report_ready'
);

create type public.legal_source_kind as enum (
  'law',
  'article',
  'precedent',
  'constitutional_case',
  'interpretation',
  'administrative_appeal'
);

create type public.argument_side as enum (
  'user',
  'opponent',
  'prosecutor'
);

create type public.ai_role as enum (
  'intake',
  'counsel',
  'opponent',
  'prosecutor',
  'judge',
  'recorder'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  case_type public.case_type not null default 'civil',
  user_position text,
  short_description text,
  status public.case_status not null default 'draft',
  goal_priorities jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.case_inputs (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.case_summaries (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references public.cases(id) on delete cascade,
  summary text,
  timeline jsonb not null default '[]'::jsonb,
  people jsonb not null default '[]'::jsonb,
  core_facts jsonb not null default '[]'::jsonb,
  favorable_facts jsonb not null default '[]'::jsonb,
  unfavorable_facts jsonb not null default '[]'::jsonb,
  expected_issues jsonb not null default '[]'::jsonb,
  case_type_candidates jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  model text,
  created_at timestamptz not null default now()
);

create table public.case_questions (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references public.cases(id) on delete cascade,
  question text not null,
  answer text,
  reason text,
  is_required boolean not null default false,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.evidences (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  evidence_type text,
  storage_path text,
  content_text text,
  summary text,
  proves_fact text,
  related_argument text,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  needed_supplements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Official legal materials from the National Law Information Open API.
-- Keep these separate from AI-generated simulation judgments.
create table public.legal_sources (
  id uuid primary key default uuid_generate_v4(),
  kind public.legal_source_kind not null,
  title text not null,
  source text not null default '국가법령정보 공동활용 Open API',
  case_number text,
  court_name text,
  decision_date date,
  original_url text,
  api_id text,
  retrieved_at timestamptz not null default now(),
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Default dimension is 1536 for common OpenAI small embedding models.
-- If you choose a 3072-dimension embedding model later, change vector(1536) to vector(3072).
create table public.legal_source_chunks (
  id uuid primary key default uuid_generate_v4(),
  legal_source_id uuid not null references public.legal_sources(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  token_count integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (legal_source_id, chunk_index)
);

create table public.case_legal_links (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references public.cases(id) on delete cascade,
  legal_source_id uuid not null references public.legal_sources(id) on delete cascade,
  relevance_summary text,
  matched_issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (case_id, legal_source_id)
);

create table public.api_call_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  provider text not null,
  operation text not null,
  endpoint text,
  method text not null default 'POST',
  request_metadata jsonb not null default '{}'::jsonb,
  response_status integer,
  success boolean not null default false,
  duration_ms integer,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.arguments (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references public.cases(id) on delete cascade,
  side public.argument_side not null,
  title text not null,
  content text not null,
  evidence_links jsonb not null default '[]'::jsonb,
  legal_links jsonb not null default '[]'::jsonb,
  expected_rebuttals jsonb not null default '[]'::jsonb,
  needed_materials jsonb not null default '[]'::jsonb,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.simulation_sessions (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references public.cases(id) on delete cascade,
  status text not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.simulation_logs (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.simulation_sessions(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  role public.ai_role not null,
  turn_index integer not null,
  speaker_label text not null,
  content text not null,
  legal_citations jsonb not null default '[]'::jsonb,
  model text,
  created_at timestamptz not null default now(),
  unique (session_id, turn_index)
);

-- AI-generated virtual judgments. Never store these as real precedents.
create table public.simulation_judgments (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.simulation_sessions(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  recognized_facts jsonb not null default '[]'::jsonb,
  issue_judgments jsonb not null default '[]'::jsonb,
  evidence_assessment jsonb not null default '[]'::jsonb,
  related_laws jsonb not null default '[]'::jsonb,
  related_precedents jsonb not null default '[]'::jsonb,
  conclusion text not null,
  uncertainties jsonb not null default '[]'::jsonb,
  consultation_checkpoints jsonb not null default '[]'::jsonb,
  safety_notice text not null default '본 결과는 실제 판결 예측이나 법률 자문이 아니라 상담 준비를 돕는 시뮬레이션입니다.',
  model text,
  created_at timestamptz not null default now()
);

create table public.consultation_reports (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid not null references public.cases(id) on delete cascade,
  simulation_judgment_id uuid references public.simulation_judgments(id) on delete set null,
  case_summary text,
  timeline jsonb not null default '[]'::jsonb,
  people jsonb not null default '[]'::jsonb,
  user_goals jsonb not null default '[]'::jsonb,
  key_evidences jsonb not null default '[]'::jsonb,
  missing_evidences jsonb not null default '[]'::jsonb,
  key_issues jsonb not null default '[]'::jsonb,
  user_arguments jsonb not null default '[]'::jsonb,
  opponent_arguments jsonb not null default '[]'::jsonb,
  related_sources jsonb not null default '[]'::jsonb,
  simulation_summary text,
  questions_for_lawyer jsonb not null default '[]'::jsonb,
  consultation_material_checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cases_user_id_idx on public.cases(user_id);
create index cases_status_idx on public.cases(status);
create index case_inputs_case_id_idx on public.case_inputs(case_id);
create index case_summaries_case_id_idx on public.case_summaries(case_id);
create index case_questions_case_id_idx on public.case_questions(case_id);
create index evidences_case_id_idx on public.evidences(case_id);
create index legal_sources_kind_idx on public.legal_sources(kind);
create index legal_sources_api_id_idx on public.legal_sources(api_id);
create index legal_source_chunks_source_idx on public.legal_source_chunks(legal_source_id);
create index case_legal_links_case_id_idx on public.case_legal_links(case_id);
create index api_call_logs_case_id_idx on public.api_call_logs(case_id);
create index api_call_logs_user_id_idx on public.api_call_logs(user_id);
create index api_call_logs_created_at_idx on public.api_call_logs(created_at desc);
create index arguments_case_id_idx on public.arguments(case_id);
create index simulation_sessions_case_id_idx on public.simulation_sessions(case_id);
create index simulation_logs_session_id_idx on public.simulation_logs(session_id);
create index simulation_judgments_case_id_idx on public.simulation_judgments(case_id);
create index consultation_reports_case_id_idx on public.consultation_reports(case_id);

-- Use ivfflat after you have enough rows. The lists value can be tuned later.
create index legal_source_chunks_embedding_idx
on public.legal_source_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger cases_set_updated_at
before update on public.cases
for each row execute function public.set_updated_at();

create trigger evidences_set_updated_at
before update on public.evidences
for each row execute function public.set_updated_at();

create trigger arguments_set_updated_at
before update on public.arguments
for each row execute function public.set_updated_at();

create trigger consultation_reports_set_updated_at
before update on public.consultation_reports
for each row execute function public.set_updated_at();

create or replace function public.match_legal_source_chunks(
  query_embedding vector(1536),
  match_count int default 8
)
returns table (
  id uuid,
  legal_source_id uuid,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    legal_source_chunks.id,
    legal_source_chunks.legal_source_id,
    legal_source_chunks.content,
    1 - (legal_source_chunks.embedding <=> query_embedding) as similarity
  from public.legal_source_chunks
  where legal_source_chunks.embedding is not null
  order by legal_source_chunks.embedding <=> query_embedding
  limit match_count;
$$;

alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.case_inputs enable row level security;
alter table public.case_summaries enable row level security;
alter table public.case_questions enable row level security;
alter table public.evidences enable row level security;
alter table public.legal_sources enable row level security;
alter table public.legal_source_chunks enable row level security;
alter table public.case_legal_links enable row level security;
alter table public.api_call_logs enable row level security;
alter table public.arguments enable row level security;
alter table public.simulation_sessions enable row level security;
alter table public.simulation_logs enable row level security;
alter table public.simulation_judgments enable row level security;
alter table public.consultation_reports enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can manage their own cases"
on public.cases for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their own case inputs"
on public.case_inputs for all
using (
  exists (
    select 1 from public.cases
    where cases.id = case_inputs.case_id
    and cases.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.cases
    where cases.id = case_inputs.case_id
    and cases.user_id = auth.uid()
  )
);

create policy "Users can read their own case summaries"
on public.case_summaries for select
using (
  exists (
    select 1 from public.cases
    where cases.id = case_summaries.case_id
    and cases.user_id = auth.uid()
  )
);

create policy "Users can read their own case questions"
on public.case_questions for select
using (
  exists (
    select 1 from public.cases
    where cases.id = case_questions.case_id
    and cases.user_id = auth.uid()
  )
);

create policy "Users can update answers for their own case questions"
on public.case_questions for update
using (
  exists (
    select 1 from public.cases
    where cases.id = case_questions.case_id
    and cases.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.cases
    where cases.id = case_questions.case_id
    and cases.user_id = auth.uid()
  )
);

create policy "Users can manage their own evidences"
on public.evidences for all
using (
  exists (
    select 1 from public.cases
    where cases.id = evidences.case_id
    and cases.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.cases
    where cases.id = evidences.case_id
    and cases.user_id = auth.uid()
  )
);

create policy "Authenticated users can read official legal sources"
on public.legal_sources for select
to authenticated
using (true);

create policy "Authenticated users can read official legal source chunks"
on public.legal_source_chunks for select
to authenticated
using (true);

create policy "Users can read legal links for their own cases"
on public.case_legal_links for select
using (
  exists (
    select 1 from public.cases
    where cases.id = case_legal_links.case_id
    and cases.user_id = auth.uid()
  )
);

create policy "Users can read their own api call logs"
on public.api_call_logs for select
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.cases
    where cases.id = api_call_logs.case_id
    and cases.user_id = auth.uid()
  )
);

create policy "Users can read arguments for their own cases"
on public.arguments for select
using (
  exists (
    select 1 from public.cases
    where cases.id = arguments.case_id
    and cases.user_id = auth.uid()
  )
);

create policy "Users can read simulation sessions for their own cases"
on public.simulation_sessions for select
using (
  exists (
    select 1 from public.cases
    where cases.id = simulation_sessions.case_id
    and cases.user_id = auth.uid()
  )
);

create policy "Users can read simulation logs for their own cases"
on public.simulation_logs for select
using (
  exists (
    select 1 from public.cases
    where cases.id = simulation_logs.case_id
    and cases.user_id = auth.uid()
  )
);

create policy "Users can read simulation judgments for their own cases"
on public.simulation_judgments for select
using (
  exists (
    select 1 from public.cases
    where cases.id = simulation_judgments.case_id
    and cases.user_id = auth.uid()
  )
);

create policy "Users can read consultation reports for their own cases"
on public.consultation_reports for select
using (
  exists (
    select 1 from public.cases
    where cases.id = consultation_reports.case_id
    and cases.user_id = auth.uid()
  )
);

-- Server-side writes for AI outputs and official legal source ingestion should use
-- SUPABASE_SERVICE_ROLE_KEY from Next.js API routes or server actions.
