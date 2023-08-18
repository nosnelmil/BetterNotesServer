// 1. Import required modules
const {OpenAIEmbeddings} = require("langchain/embeddings/openai");
const {OpenAI} = require("langchain/llms/openai");
const {loadQAStuffChain} = require("langchain/chains");
const {Document} = require("langchain/document");
const {log} = require("firebase-functions/logger");
// 2. Export the query function
module.exports.query = async function(
    client,
    indexName,
    nameSpace,
    question,
) {
// 3. Start query process
  log("Querying Pinecone vector store...");
  // 4. Retrieve the Pinecone index
  // eslint-disable-next-line new-cap
  const index = client.Index(indexName);
  // 5. Create query embedding
  const queryEmbedding = await new OpenAIEmbeddings().embedQuery(question);
  // 6. Query Pinecone index and return top 10 matches
  const queryResponse = await index.query({
    queryRequest: {
      topK: 10,
      vector: queryEmbedding,
      includeMetadata: true,
      includeValues: true,
      filters: {
        "group": {"$eq": nameSpace},
      },
    },
  });
  // 7. Log the number of matches
  log(`Found ${queryResponse.matches.length} matches...`);
  // 8. Log the question being asked
  log(`Asking question: ${question}...`);
  // 9. Create an OpenAI instance and load the QAStuffChain
  const llm = new OpenAI({});
  const chain = loadQAStuffChain(llm);
  // 10. Extract and concatenate page content from matched documents
  const concatenatedPageContent = queryResponse.matches
      .map((match) => match.metadata.pageContent)
      .join(" ");
  // 11. Execute the chain with input documents and question
  const result = await chain.call({
    input_documents: [new Document({pageContent: concatenatedPageContent})],
    question: question,
  });
  // 12. Log the answer
  log(`Answer: ${result}`);
  return result;
};
