import { Document } from "@langchain/core/documents";
import { getAI } from "../openAI";

const lineRE = /(\n)+/g; // Compile once, I'll be using it a lot
export function singleLine(str: string) {
  return str.replace(lineRE, " ");
}

export async function formatJobsAsString(
  documents: Document[],
): Promise<string> {
  const contexts: string[] = [];
  let totalLength = 0;

  const { llm } = getAI();
  const maxTokens = llm.maxTokens || 128000;

  for (const d of documents) {
    const content = `
    JobId: ${d.metadata.jobid}
    Job Url: ${d.metadata.url}
    Job Title: ${singleLine(d.metadata.title)}
    Job Description: ${singleLine(d.pageContent)}
    `;
    const tokenLength = await llm.getNumTokens(content);
    if (totalLength + tokenLength < maxTokens - 500) {
      contexts.push(content);
      totalLength += tokenLength;
    } else {
      continue; // Break out
    }
  }

  return contexts.join("\n\n-----------------------------\n\n");
}
