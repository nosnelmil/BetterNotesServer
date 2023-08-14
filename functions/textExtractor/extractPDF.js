/* eslint-disable require-jsdoc */

module.exports.extractPDF = async function(buffer) {
  const PDFExtract = require("pdf.js-extract").PDFExtract;
  const pdfExtract = new PDFExtract();
  const options = {}; /* see below */
  const result = await pdfExtract.extractBuffer(buffer, options);
  if (result) {
    return extractTextFromPages(result.pages);
  } else {
    return "";
  }
};

function extractTextFromPages(pages) {
  let text = "";
  for (const page of pages) {
    for (const item of page.content) {
      text += item.str + " ";
    }
  }
  return text.trim();
}
