import { formatJobsAsString } from "@/libs/langchain/job-formatter";
import { getAI } from "@/libs/openAI";
import { getDBClient } from "@/libs/supabaseClient";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { InMemoryStore } from "@langchain/core/stores";
import { ParentDocumentRetriever } from "langchain/retrievers/parent_document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { formatDocumentsAsString } from "langchain/util/document";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

export interface IChat {
  id?: number | undefined;
  room: number;
  role: string;
  message: string;
  created_at?: Date | undefined;
}

// Fetch the list of chats for a given room from the Supabase database.
export async function fetchChats(roomId: number): Promise<IChat[]> {
  const supabaseClient = getDBClient();
  const { data, error } = await supabaseClient
    .from("chats")
    .select()
    .eq("room", roomId)
    .order("created_at", { ascending: true })
    .returns<IChat[]>();

  if (error) throw error;

  return data;
}

// Post a new chat message to the database.
export async function postChat(chat: IChat): Promise<IChat> {
  const supabaseClient = getDBClient();
  const { data, error } = await supabaseClient
    .from("chats")
    .insert(chat)
    .select()
    .single<IChat>();

  if (error) throw error;

  return data;
}

// Get an answer from the chatbot based on the user's chat message.
// export async function getAnswer(chat: IChat, fileId: number): Promise<IChat> {
//   const { embeddings, llm } = getAI();
//   const supabaseClient = getDBClient();

//   const vectorStore = await SupabaseVectorStore.fromExistingIndex(embeddings, {
//     client: supabaseClient,
//     tableName: "documents",
//     queryName: "match_documents",
//   });

//   const retriever = vectorStore.asRetriever({
//     filter: (rpc) => rpc.filter("metadata->>file_id", "eq", fileId),
//     k: 2,
//   });

//   const SYSTEM_TEMPLATE = `Use the following pieces of context to answer the question at the end.
//       If you don't know the answer, just say that you don't know, don't try to make up an answer.
//       ----------------
//       {context}`;

//   const messages = [
//     SystemMessagePromptTemplate.fromTemplate(SYSTEM_TEMPLATE),
//     HumanMessagePromptTemplate.fromTemplate("{question}"),
//   ];
//   const prompt = ChatPromptTemplate.fromMessages(messages);
//   const chain = RunnableSequence.from([
//     {
//       context: retriever.pipe(formatDocumentsAsString),
//       question: new RunnablePassthrough(),
//     },
//     prompt,
//     llm,
//     new StringOutputParser(),
//   ]);

//   const answer = await chain.invoke(chat.message);

//   const { data, error } = await supabaseClient
//     .from("chats")
//     .insert({
//       role: "bot",
//       room: chat.room,
//       message: answer,
//     })
//     .select()
//     .single<IChat>();

//   if (error) throw error;

//   return data;
// }

// Set up multi-retrievers, like https://js.langchain.com/v0.2/docs/how_to/routing/ and route to
// "questions about my resume" or "questions about jobs like my resume"
// The router can first retrieve the best jobs but when being asked about them the intermediate pass can also summarize and display the "best"
// Or a custom retrieve for jobs too
// QUESTION: How to maintain some context
// QUESTION: How to collect parameters like "are you open to remote work" and "what state would you like to search in" to add metadata filters

export async function getAnswer(chat: IChat, fileId: number): Promise<IChat> {
  const { embeddings, llm } = getAI();
  const supabaseClient = getDBClient();

  const documentVectorStore = await SupabaseVectorStore.fromExistingIndex(
    embeddings,
    {
      client: supabaseClient,
      tableName: "documents",
      queryName: "match_documents",
    },
  );

  const documentRetriever = documentVectorStore.asRetriever({
    filter: (rpc) => rpc.filter("metadata->>file_id", "eq", fileId),
    k: 2,
  });

  const byteStore = new InMemoryStore<Uint8Array>();
  const memoryVectorstore = new MemoryVectorStore(embeddings);
  const jobVectorStore = await SupabaseVectorStore.fromExistingIndex(
    embeddings,
    {
      client: supabaseClient,
      tableName: "jobs",
      queryName: "best_jobs",
    },
  );
  // const countryCodes = ["US", "REMOTE"];
  const countryCodes = "('US', 'REMOTE)";
  const jobRetriever = jobVectorStore.asRetriever({
    filter: (rpc) =>
      rpc.filter("metadata->'geocode'->>'countryCode'", "in", countryCodes),
    // k: 100,
  });
  const jobDocumentRetriever = new ParentDocumentRetriever({
    vectorstore: memoryVectorstore,
    byteStore,
    childDocumentRetriever: jobRetriever,
    childK: 100,
    parentK: 20,
    // Optional, not required if you're already passing in split documents
    parentSplitter: new RecursiveCharacterTextSplitter({
      chunkOverlap: 0,
      chunkSize: 10_000,
    }),
    childSplitter: new RecursiveCharacterTextSplitter({
      chunkOverlap: 20,
      chunkSize: 250,
    }),
  });

  const SYSTEM_TEMPLATE = `You are an enthusiastic job recruiter who wants to help a candidate find the most appropriate job match for their resume.
      The candidate has provided their resume and you have a list of jobs to choose from.
      If you don't know the answer, just say that you don't know, don't try to make up an answer.
      ----------------
      Resume: """
      {context}
      """
      ----------------
      Jobs:
      {jobs}
      `;

  const messages = [
    SystemMessagePromptTemplate.fromTemplate(SYSTEM_TEMPLATE),
    HumanMessagePromptTemplate.fromTemplate("{question}"),
  ];
  const prompt = ChatPromptTemplate.fromMessages(messages);
  const chain = RunnableSequence.from([
    {
      context: documentRetriever.pipe(formatDocumentsAsString),
      jobs: jobDocumentRetriever.pipe(formatJobsAsString),
      question: new RunnablePassthrough(),
    },
    prompt,
    llm,
    new StringOutputParser(),
  ]);

  const answer = await chain.invoke(chat.message);

  const { data, error } = await supabaseClient
    .from("chats")
    .insert({
      role: "bot",
      room: chat.room,
      message: answer,
    })
    .select()
    .single<IChat>();

  if (error) throw error;

  return data;
}
