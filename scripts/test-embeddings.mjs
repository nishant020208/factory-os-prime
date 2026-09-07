import { pipeline } from "@xenova/transformers";

async function test() {
  console.log("Loading embedding model...");
  const start = Date.now();
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  console.log(`Model loaded in ${Date.now() - start}ms`);

  const embedStart = Date.now();
  const output = await extractor("This is a test of FactoryOS RAG embeddings.", {
    pooling: "mean",
    normalize: true,
  });
  const vector = Array.from(output.data);
  console.log(`Embedded in ${Date.now() - embedStart}ms`);
  console.log("Vector length:", vector.length);
  console.log("First 5 values:", vector.slice(0, 5));
}

test().catch(console.error);
