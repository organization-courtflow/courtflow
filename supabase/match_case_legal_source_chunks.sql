create or replace function public.match_case_legal_source_chunks(
  target_case_id uuid,
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
  inner join public.case_legal_links
    on case_legal_links.legal_source_id = legal_source_chunks.legal_source_id
  where case_legal_links.case_id = target_case_id
    and legal_source_chunks.embedding is not null
  order by legal_source_chunks.embedding <=> query_embedding
  limit match_count;
$$;
