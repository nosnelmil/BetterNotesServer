const {log, error} = require( "firebase-functions/logger");
const {onObjectFinalized} = require( "firebase-functions/v2/storage");
const {extractPDF} = require( "./textExtractor/extractPDF");
const {getStorage} = require( "firebase-admin/storage");
const {initializeApp} = require( "firebase-admin/app");
const {setGlobalOptions} = require("firebase-functions/v2");
const {getFirestore} = require("firebase-admin/firestore");
const {onDocumentDeleted, onDocumentWritten} =
  require("firebase-functions/v2/firestore");

// Init firebase function app
initializeApp();


setGlobalOptions({
  region: "asia-southeast2",
  cpu: "gcf_gen1",
  secrets: ["PINECONE_API_KEY", "OPENAI_API_KEY"]});

const db = getFirestore();
const storage = getStorage();
/**
 * When an image is uploaded in the Storage bucket,
 * generate a thumbnail automatically using sharp.
 */
exports.convertFileToText = onObjectFinalized(async (event) => {
  const filePath = event.data.name; // File path in the bucket.
  const [userid, folderName, collectionid, documentid] = filePath.split("/");
  if (folderName != "documents") return; // exit if not a new document

  const fileBucket = event.data.bucket; // Storage bucket containing the file.

  const contentType = event.data.contentType; // File content type.
  const acceptedType = new Set(["application/pdf"]);
  // Exit if this is triggered on a file that is not an image.
  if (!acceptedType.has(contentType)) {
    return log("This is not a supported file type.");
  }

  // Download file into memory from bucket.
  const bucket = getStorage().bucket(fileBucket);
  const downloadResponse = await bucket.file(filePath).download();
  const fileBuffer = downloadResponse[0];

  let text;
  if (contentType == "application/pdf") {
    text = await extractPDF(fileBuffer);
  }
  db.collection("users").doc(userid)
      .collection("collections").doc(collectionid)
      .collection("documents").doc(documentid)
      .update({
        content: text,
      });
});


/**
 * Cleans up after an AppDocument has been deleted
 */
const bucketName = "gs://better-notes-b6af7.appspot.com";
const firestoreDocumentPath =
  "users/{userid}/collections/{collectionid}/documents/{documentid}";
const PINECONE_ENVIRONMENT = "gcp-starter";
const PINECONE_INDEX = "betternotes";

const {PineconeClient} = require("@pinecone-database/pinecone");
const {deleteIndexes} =
  require("./pinecone/deleteIndexes");
const {uploadTextToPinecone} = require("./pinecone/uploadTextToPinecone");
const {onRequest} = require("firebase-functions/v2/https");
const {query} = require("./main/query");

exports.appDocumentCleanUp =
  onDocumentDeleted(firestoreDocumentPath, async (event) => {
    const {userid, collectionid, documentid} = event.params;
    const client = new PineconeClient();
    await client.init({
      apiKey: process.env.PINECONE_API_KEY,
      environment: PINECONE_ENVIRONMENT,
    });
    const vectorIds = event.data.data().vectorIds;
    if (vectorIds) {
      await deleteIndexes(client, PINECONE_INDEX, collectionid, vectorIds);
    }
    storage.bucket(bucketName)
        .file(`${userid}/documents/${collectionid}/${documentid}`)
        .delete();
  });


/**
 * Generate vector embeddings when a new file is uploaded
 * and after the text has been extracted into the content field
 */
exports.generateVectors =
  onDocumentWritten(firestoreDocumentPath, async (event) => {
    if ( !event.data.after.data() ||
      !("content" in event.data.after.data()) ||
        event.data.before.data().content ==
        event.data.after.data().content) return;
    log("past check");
    log(process.env.PINECONE_API_KEY);
    try {
      const documentId = event.data.after.data().id;
      const content = event.data.after.data().content;
      const source = event.data.after.data().downloadURL;
      const {userid, collectionid, documentid} = event.params;
      const client = new PineconeClient();
      await client.init({
        apiKey: process.env.PINECONE_API_KEY,
        environment: PINECONE_ENVIRONMENT,
      });
      const vectorIds = await uploadTextToPinecone(
          client, PINECONE_INDEX, collectionid, documentId, content, source);

      // update document
      db.collection("users").doc(userid)
          .collection("collections").doc(collectionid)
          .collection("documents").doc(documentid)
          .update({
            vectorIds: vectorIds,
            status: "ready",
          });
      log("Done");
    } catch (err) {
      error(err);
    }
  });

/**
 * Handle a query coming from a user,
 * get the vector embeddings in the collection
 * and pass the query and vectors to openAI
 */
exports.query = onRequest({cors: true}, async (req, res) => {
  const {question, collectionId} = req.body;
  if (question == "" || !collectionId == "") {
    res.status(400).send("Invalid Request");
  }
  log("req body", question, collectionId);
  try {
    const client = new PineconeClient();
    await client.init({
      apiKey: process.env.PINECONE_API_KEY,
      environment: PINECONE_ENVIRONMENT,
    });
    const queryResult = await query(
        client,
        PINECONE_INDEX,
        collectionId,
        question);
    log("Query Result:", {...queryResult.sources});
    res.status(200);
  } catch (err) {
    error(err);
  }
});

/**
 * Save the result from Cloud Vision OCR that is in a GS bucket to the
 * content field of AppDocument
 */
// exports.saveOCRResult = onObjectFinalized(async (event) => {
//   const filePath = event.data.name; // File path in the bucket.
//   const [userid, folderName, collectionid, documentid] = filePath.split("/");
//   if (folderName != "output") return; // exit if not a new document
//   log("OCR result triggered", event);
//   // const fileBucket = event.data.bucket;
// Storage bucket containing the file.
//   // const filePath = event.data.name; // File path in the bucket.

//   // log("userid", userid);
//   // log("collectionid", collectionid);
// });
