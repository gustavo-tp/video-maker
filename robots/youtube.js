const express = require('express');
const google = require('googleapis').google;
const youtube = google.youtube({ version: 'v3' });
const OAuth2 = google.auth.OAuth2;
const state = require('./state.js');
const fs = require('fs');

async function robot() {
  const content = state.load();

  await authenticateWithOAuth();
  const videoInformation = await uploadVideo(content);
  await uploadThumbnail(videoInformation);

  async function authenticateWithOAuth() {
    const webserver = await startWebServer();
    const OAuthClient = await createOAuthClient();
    requestUserConsent(OAuthClient);
    const authorizationToken = await waitForGoogleCallback(webserver);
    await requestGoogleForAccessTokens(OAuthClient, authorizationToken);
    setGlobalGoogleAuthentication(OAuthClient);
    await stopWebServer(webserver);

    async function startWebServer() {
      return new Promise((resolve, reject) => {
        const port = 5000;
        const app = express();

        const server = app.listen(port, () => {
          console.log(`> Listening on http://localhost:${port}`);

          resolve({
            app,
            server
          });
        });
      });
    }

    async function createOAuthClient() {
      const credentials = require('../credentials/google-youtube.json');

      const OAuthClient = new OAuth2(
        credentials.web.client_id,
        credentials.web.client_secret,
        credentials.web.redirect_uris[0]
      );

      return OAuthClient;
    }

    function requestUserConsent(OAuthClient) {
      const consentUrl = OAuthClient.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/youtube']
      });

      console.log(`> Please give your consent: ${consentUrl}`);
    }

    async function waitForGoogleCallback(webserver) {
      return new Promise((resolve, reject) => {
        console.log('> Waiting for user consent...');

        webserver.app.get('/oauth2callback', (req, res) => {
          const authCode = req.query.code;
          console.log(`> Consent given: ${authCode}`);

          res.send('<h1>Thank you!</h1><p>Now close this tab.</p>');
          resolve(authCode);
        });
      });
    }

    async function requestGoogleForAccessTokens(
      OAuthClient,
      authorizationToken
    ) {
      console.log(OAuthClient);
      return new Promise((resolve, reject) => {
        OAuthClient.getToken(authorizationToken, (error, tokens) => {
          if (error) {
            return reject(error);
          }

          console.log('> Acess tokens received:');
          console.log(tokens);

          OAuthClient.setCredentials(tokens);
          resolve();
        });
      });
    }

    function setGlobalGoogleAuthentication(OAuthClient) {
      google.options({
        auth: OAuthClient
      });
    }

    async function stopWebServer(webserver) {
      return new Promise((resolve, reject) => {
        webserver.server.close(() => resolve());
      });
    }
  }

  async function uploadVideo(content) {
    const videoFilePath = './content/output.mp4';
    const videoFileSize = fs.statSync(videoFilePath).size;
    const videoTitle = `${content.prefix} ${content.searchTerm}`;
    const videoTags = [content.searchTerm, ...content.sentences[0].keywords];
    const videoDescription = content.sentences
      .map(sentence => sentence.text)
      .join('\n\n');

    const requestParameters = {
      part: 'snippet, status',
      requestBody: {
        snippet: {
          title: videoTitle,
          description: videoDescription,
          tags: videoTags
        },
        status: {
          privacyStatus: 'unlisted'
        }
      },
      media: {
        body: fs.createReadStream(videoFilePath)
      }
    };

    const youtubeResponse = await youtube.videos.insert(requestParameters, {
      onUploadProgress: onUploadProgress
    });

    console.log(
      `> Video available at: https://youtu.be/${youtubeResponse.data.id}`
    );
    return youtubeResponse.data;

    function onUploadProgress(event) {
      const progress = Math.round((event.bytesRead / videoFileSize) * 100);
      console.log(`> ${progress}% completed`);
    }
  }

  async function uploadThumbnail(videoInformation) {
    const videoId = videoInformation.id;
    const videoThumbnailFilePath = './content/youtube-thumbnail.jpg';

    const requestParameters = {
      videoId,
      media: {
        mimeType: 'image/jpeg',
        body: fs.createReadStream(videoThumbnailFilePath)
      }
    };

    const youtubeResponse = await youtube.thumbnails.set(requestParameters);
    console.log('> Thumbnail uploaded');
  }
}

module.exports = robot;
