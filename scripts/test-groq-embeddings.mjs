import { readFileSync } from "node:fs";

const txt = readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = new RegExp(`^${k}=(.*)$`, "m").exec(txt);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
};

const groqKey = get("GROQ_API_KEY");

async function checkGroq() {
  const res = await fetch("https://api.groq.com/openai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: "Test embedding",
    }),
  });
  console.log("Groq status:", res.status);
  const data = await res.json();
  console.log("Groq response:", data);
}

checkGroq().catch(console.error);
