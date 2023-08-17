// 1. Import required modules
const {log} = require("firebase-functions/logger");
// 2. Export updatePinecone function
module.exports.deleteIndexes =
  async function(client, indexName, namespace, vectorIds) {
    log("Retrieving Pinecone index...");
    // 3. Retrieve Pinecone index
    // eslint-disable-next-line new-cap
    const index = client.Index(indexName);
    // 4. Log the retrieved index name
    log(`Pinecone index retrieved: ${indexName}`);
    // 5. Process text
    await index.delete1({ids: vectorIds});
  };
