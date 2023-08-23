// Imports the Google Cloud client libraries
const vision = require("@google-cloud/vision").v1;

// Creates a client
const client = new vision.ImageAnnotatorClient();

module.exports.pdfocr = async function(
    fileBucket, filePath, userid, collectionid, documentid) {
  const gcsSourceUri = "gs://" + fileBucket + "/" + filePath;
  const inputConfig = {
    // Supported mime_types are: 'application/pdf' and 'image/tiff'
    mimeType: "application/pdf",
    gcsSource: {
      uri: gcsSourceUri,
    },
  };
  const outputConfig = {
    gcsDestination: {
      uri: `gs://${fileBucket}/${userid}/output/${collectionid}/${documentid}`,
    },
  };

  const features = [{type: "DOCUMENT_TEXT_DETECTION"}];
  const request = {
    requests: [
      {
        inputConfig: inputConfig,
        features: features,
        outputConfig: outputConfig,
      },
    ],
  };

  client.asyncBatchAnnotateFiles(request);
};

