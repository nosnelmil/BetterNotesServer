const {log, error} = require( "firebase-functions/logger");
const {onObjectFinalized} = require( "firebase-functions/v2/storage");
const {extractPDF} = require( "./textExtractor/extractPDF");
const {getStorage} = require( "firebase-admin/storage");
const {initializeApp} = require( "firebase-admin/app");
const {setGlobalOptions} = require("firebase-functions/v2");
const {getFirestore} = require("firebase-admin/firestore");
const {onDocumentDeleted, onDocumentWritten} = require("firebase-functions/v2/firestore");

// Init firebase function app
initializeApp();


setGlobalOptions({region: "asia-southeast2", cpu: "gcf_gen1"});

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

const bucketName = "gs://better-notes-b6af7.appspot.com";
const firestoreDocumentPath =
  "users/{userid}/collections/{collectionid}/documents/{documentid}";

exports.appDocumentCleanUp =
  onDocumentDeleted(firestoreDocumentPath, (event) => {
    const {userid, collectionid, documentid} = event.params;
    storage.bucket(bucketName)
        .file(`${userid}/documents/${collectionid}/${documentid}`)
        .delete();
  });


const {PineconeClient} = require("@pinecone-database/pinecone");
const {uploadTextToPinecone} = require("./pinecone/uploadTextToPinecone");
// setup pinecone
const PINECONE_ENVIRONMENT = "gcp-starter";
const PINECONE_INDEX = "betternotes";

exports.generateVectors =
  onDocumentWritten({secrets: ["PINECONE_API_KEY", "OPENAI_API_KEY"]},
      firestoreDocumentPath, async (event) => {
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
