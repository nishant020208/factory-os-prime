import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

console.log("LangChain modules imported successfully!");

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});

async function test() {
  const docs = await splitter.splitDocuments([
    new Document({
      pageContent: "FactoryOS Artisan Furniture Works plant overview. Located in Chicago.",
      metadata: { source: "plants" }
    })
  ]);
  console.log("Split into docs:", docs.length, docs[0].pageContent);
}

test().catch(console.error);
