-- At supabase
create extension if not exists vector;

-- Tables to hold uploaded documents and their vectors
create table if not exists documents (
    id bigint primary key generated always as identity,
    content text,
    metadata jsonb,
    embedding vector(1536)
);

create or replace function match_documents (
    query_embedding vector(1536),
    match_count int default null,
    filter jsonb default '{}'
) returns table (
    id bigint,
    content text,
    metadata jsonb,
    similarity float
) language plpgsql as $$
begin
    return query
    select
        documents.id,
        documents.content,
        documents.metadata,
        1 - (documents.embedding <=> query_embedding) as similarity
    from documents
    where documents.metadata @> filter
    order by documents.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- Next, we need to set up our tables for the chatbot system
-- The “files” table will store details of the uploaded PDF files. This allows us to reference and filter the files in the “documents” table. Our chatbot system will query embedding data with the given “file id” selected in our app. This way, our chatbot system can manage multiple PDF files and focus on the context of a specific file.
create table if not exists files (
    id bigint primary key generated always as identity,
    name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- The “rooms” table will store all the chat sessions, allowing users to have multiple chat sessions within our app.
create table if not exists rooms (
    id bigint primary key generated always as identity,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- The “chats” table will store all the chats from a particular chat session (room). The role will differentiate whether it’s a user or a bot. If it’s a user, the role will be “user”.
create table if not exists chats (
    id bigint primary key generated always as identity,
    room bigint references rooms(id) on delete cascade,
    role text not null,
    message text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- drop function best_jobs;

create or replace function best_jobs (
    query_embedding vector(1536), -- Pass in the pertinent parts of the resume
    match_count int default null,
    filter jsonb default '{}'
) returns table (
    id uuid,
    content text,
    metadata jsonb,
    similarity float
) language plpgsql as $$
begin
    return query
    select
        allJjobs.id,
        allJjobs.content,
        allJjobs.metadata,
        allJjobs.similarity
    from
        (
        SELECT greenhousejobs.id, greenhousejobs.created, greenhousejobs.metadata, greenhousejobs.content, 1 - (greenhousejobs.vectors <=> query_embedding) as similarity
          FROM greenhousejobs
          WHERE greenhousejobs.created >= now() - interval '30 days'
            AND greenhousejobs.metadata @> filter
        UNION ALL
        SELECT leverjobs.id, leverjobs.created, leverjobs.metadata, leverjobs.content, 1 - (leverjobs.vectors <=> query_embedding) as similarity
        FROM leverjobs
          WHERE leverjobs.created >= now() - interval '30 days'
            AND leverjobs.metadata @> filter
        UNION ALL
        SELECT workdayjobs.id, workdayjobs.created, workdayjobs.metadata, workdayjobs.content, 1 - (workdayjobs.vectors <=> query_embedding) as similarity
        FROM workdayjobs
          WHERE workdayjobs.created >= now() - interval '30 days'
            AND workdayjobs.metadata @> filter
        UNION ALL
        SELECT icimsjobs.id, icimsjobs.created, icimsjobs.metadata, icimsjobs.content, 1 - (icimsjobs.vectors <=> query_embedding) as similarity
        FROM icimsjobs
          WHERE icimsjobs.created >= now() - interval '30 days'
            AND icimsjobs.metadata @> filter
        UNION ALL
        SELECT hirebridgejobs.id, hirebridgejobs.created, hirebridgejobs.metadata, hirebridgejobs.content, 1 - (hirebridgejobs.vectors <=> query_embedding) as similarity
        FROM hirebridgejobs
          WHERE hirebridgejobs.created >= now() - interval '30 days'
            AND hirebridgejobs.metadata @> filter
        ) allJjobs
    WHERE allJjobs.metadata @> filter
    order by allJjobs.similarity -- jobs.embedding <=> query_embedding
    limit match_count;
end;
$$;

select * from best_jobs(null, 10);

