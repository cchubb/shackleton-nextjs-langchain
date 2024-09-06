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