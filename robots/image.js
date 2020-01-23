const imageDowloader = require('image-downloader');
const google = require('googleapis').google;
const customSearch = google.customsearch('v1');
const state = require('./state.js');

const googleSearchCredentials = require('../credentials/google-search.json');

async function robot() {
  console.log('> [image-robot] Starting...');
  const content = state.load();
  // const searchTermWords = content.searchTerm.split(' ');

  await fetchImagesOfAllSentences(content);
  await dowloadAllImages(content);

  state.save(content);

  async function fetchImagesOfAllSentences(content) {
    for (
      let sentenceIndex = 0;
      sentenceIndex < content.sentences.length;
      sentenceIndex++
    ) {
      let query;

      // const separatedKeywords = content.sentences[
      //   sentenceIndex
      // ].keywords[0].split(' ');
      // const separatedKeywordsFiltered = separatedKeywords.filter(
      //   keyword => !searchTermWords.includes(keyword)
      // );

      // const keywords = separatedKeywordsFiltered.join(' ');
      const keywords = content.sentences[sentenceIndex].keywords[0];

      if (sentenceIndex === 0) {
        query = content.searchTerm;
      } else {
        query = `${content.searchTerm} ${keywords}`;
      }
      console.log(`> [image-robot] Querying Google Images with: "${query}"`);

      content.sentences[
        sentenceIndex
      ].images = await fetchGoogleAndReturnImagesLinks(query);
      content.sentences[sentenceIndex].googleSearchQuery = query;
    }
  }

  async function fetchGoogleAndReturnImagesLinks(query) {
    const response = await customSearch.cse.list({
      auth: googleSearchCredentials.apiKey,
      cx: googleSearchCredentials.searchEngineId,
      q: query,
      searchType: 'image',
      num: 2
    });

    const imagesUrl = response.data.items.map(item => {
      return item.link;
    });

    return imagesUrl;
  }

  async function dowloadAllImages(content) {
    content.downloadedImages = [];

    for (
      let sentenceIndex = 0;
      sentenceIndex < content.sentences.length;
      sentenceIndex++
    ) {
      const images = content.sentences[sentenceIndex].images;

      for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
        const imageUrl = images[imageIndex];

        try {
          if (content.downloadedImages.includes(imageUrl)) {
            throw new Error('> [image-robot] Image already downloaded');
          }

          await dowloadAndSave(imageUrl, `${sentenceIndex}-original.png`);
          content.downloadedImages.push(imageUrl);
          console.log(
            `> [image-robot]  [${sentenceIndex}][${imageIndex}] Image successfully downloaded: ${imageUrl}`
          );
          break;
        } catch (error) {
          console.log(
            `> [image-robot]  [${sentenceIndex}][${imageIndex}] Error (${imageUrl}): ${error}`
          );
        }
      }
    }
  }

  async function dowloadAndSave(url, fileName) {
    return imageDowloader.image({
      url: url,
      dest: `./content/${fileName}`
    });
  }
}

module.exports = robot;
