// 1. Import required modules
const {log, error} = require("firebase-functions/logger");
const {OpenAIEmbeddings} = require("langchain/embeddings/openai");
// 2. Export updatePinecone function
module.exports.deleteAll =
  async function(client, indexName) {
    try {
      log("Retrieving Pinecone index...");
      // 3. Retrieve Pinecone index
      // eslint-disable-next-line new-cap
      const index = client.Index(indexName);
      // 5. Create query embedding
      const queryEmbedding = await new OpenAIEmbeddings().embedQuery("");
      // 6. Query Pinecone index and return top 10 matches
      const queryResponse = await index.query({
        queryRequest: {
          topK: 1000,
          vector: queryEmbedding,
        },
      });
      const ids = queryResponse.matches.map((match) => match.id);
      // 5. Process text
      log(ids.length);
      const chunkSize = 90;
      for (let i = 0; i < Math.ceil(ids.length / chunkSize); i++) {
        const result =
            await index.delete1({ids: ids.slice(i*chunkSize, (i+1)*chunkSize)});
        log(result);
      }
    } catch (err) {
      error(err);
    }
  };
