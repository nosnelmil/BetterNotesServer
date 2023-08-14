// import logger from "firebase-functions/logger";
// import {onObjectFinalized} from "firebase-functions/v2/storage";
// import extractPDF from "./textExtractor/extractPDF.js";
// import {getStorage} from "firebase-admin/storage";
// import {initializeApp} from "firebase-admin/app";

const {log} = require( "firebase-functions/logger");
const {onObjectFinalized} = require( "firebase-functions/v2/storage");
const {extractPDF} = require( "./textExtractor/extractPDF");
const {getStorage} = require( "firebase-admin/storage");
const {initializeApp} = require( "firebase-admin/app");
const {setGlobalOptions} = require("firebase-functions/v2");

initializeApp();
setGlobalOptions({region: "asia-southeast2", cpu: "gcf_gen1"});
/**
 * When an image is uploaded in the Storage bucket,
 * generate a thumbnail automatically using sharp.
 */
exports.convertFileToText = onObjectFinalized(async (event) => {
  const fileBucket = event.data.bucket; // Storage bucket containing the file.
  const filePath = event.data.name; // File path in the bucket.
  const fileValues = filePath.split("/");
  const userid = fileValues[0];
  const collectionid = fileValues[1];
  log("userid", userid);
  log("collectionid", collectionid);
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
  log("File downloaded!");

  let text;
  if (contentType == "application/pdf") {
    text = await extractPDF(fileBuffer);
  }
  log("Text extracted", text);
});
