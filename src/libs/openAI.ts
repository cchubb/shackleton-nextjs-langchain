import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

let llm: ChatOpenAI | undefined;
let embeddings: OpenAIEmbeddings | undefined;

export const getAI = () => {
  if (llm && embeddings) return { llm, embeddings };
  const openAIApiKey: string = process.env.NEXT_PUBLIC_OPENAI_API_KEY || "";
  if (!openAIApiKey) throw new Error("OpenAI API key not found.");

  llm = new ChatOpenAI({
    openAIApiKey,
    modelName: "gpt-3.5-turbo",
    temperature: 0.9,
  });

  embeddings = new OpenAIEmbeddings(
    {
      openAIApiKey,
    },
    { maxRetries: 0 },
  );

  return { embeddings, llm };
};
