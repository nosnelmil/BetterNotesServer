// 1. Import required modules
const {log} = require("firebase-functions/logger");
const {OpenAIEmbeddings} = require("langchain/embeddings/openai");
const {RecursiveCharacterTextSplitter} = require("langchain/text_splitter");
// 2. Export updatePinecone function
module.exports.uploadTextToPinecone =
  async function(client, indexName, namespace, documentId, text, source) {
    log("Retrieving Pinecone index...");
    // 3. Retrieve Pinecone index
    // eslint-disable-next-line new-cap
    const index = client.Index(indexName);
    // 4. Log the retrieved index name
    log(`Pinecone index retrieved: ${indexName}`);
    // 5. Process text
    log(`Processing document`);
    // 6. Create RecursiveCharacterTextSplitter instance
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
    });
    log("Splitting text into chunks...");
    // 7. Split text into chunks (documents)
    const chunks = await textSplitter.createDocuments([text]);
    log(`Text split into ${chunks.length} chunks`);
    log(
        `Calling Embedding endpoint with ${chunks.length} text chunks ...`,
    );
    // 8. Create OpenAI embeddings for documents
    const embeddingsArrays = await new OpenAIEmbeddings(
        {openAiApiKey: process.env.OPENAI_API_KEY}).embedDocuments(
        chunks.map((chunk) => chunk.pageContent.replace(/\n/g, " ")),
    );
    log("Finished embedding documents");
    log(
        `Creating ${chunks.length} vectors array ...`,
    );
    // 9. Create and upsert vectors in batches of 100
    const batchSize = 100;
    const vectorIds = [];
    let batch = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const vectorId = `${documentId}_${idx}`;
      const vector = {
        id: vectorId,
        values: embeddingsArrays[idx],
        metadata: {
          ...chunk.metadata,
          loc: JSON.stringify(chunk.metadata.loc),
          pageContent: chunk.pageContent,
          txtPath: source,
        },
        namespace: documentId,
      };
      batch.push(vector);
      vectorIds.push(vectorId);

      // When batch is full or it's the last item, upsert the vectors
      if (batch.length === batchSize || idx === chunks.length - 1) {
        await index.upsert({
          upsertRequest: {
            vectors: batch,
          },
        });
        // Empty the batch
        batch = [];
      }
    }
    // 10. Log the number of vectors updated
    log(`Pinecone index updated with ${chunks.length} vectors`);
    return vectorIds;
  };
