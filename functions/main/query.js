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
    namespace,
    question,
    chatHistoy,
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
      topK: 8,
      vector: queryEmbedding,
      includeMetadata: true,
      includeValues: true,
      filter: {
        "group": {"$eq": namespace},
      },
    },
  });
  // 7. Log the number of matches
  log(`Found ${queryResponse.matches.length} matches...`);
  // 8. Log the question being asked
  log(`Asking question: ${question}...`);

  // Create memory
  // eslint-disable-next-line new-cap
  // const memory = ConversationBufferWindowMemory(3);
  // memory.save_context({"input": "hi"}, {"output": "whats up"});
  // memory.save_context({"input": "not much you"}, {"output": "not much"});
  // 9. Create an OpenAI instance and load the QAStuffChain
  log("loading openai");
  const llm = new OpenAI({});
  log("loading chain");
  const chain = loadQAStuffChain(llm);
  // 10. Extract and concatenate page content from matched documents
  const querySource = queryResponse.matches.map((match) =>
    match.metadata.pageContent);
  const sources = queryResponse.matches
      .map((match) => {
        return {
          link: match.metadata.txtPath,
          content: match.metadata.pageContent,
        };
      });
  const concatenatedPageContent = querySource.join(" ");
  // 11. Execute the chain with input documents and question
  log("calling chain");
  const result = await chain.call({
    input_documents: [new Document({pageContent: concatenatedPageContent})],
    question: question,
  });
  // 12. Log the answer
  return {
    ...result,
    sources: sources,
  };
};
