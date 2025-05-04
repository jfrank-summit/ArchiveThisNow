import dotenv from 'dotenv';
import { createTwitterApi } from './lib/twitter/client.js';
import { createLogger } from './utils/logger.js';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { uploadJson, uploadFile } from './lib/autoDrive/uploader.js';

dotenv.config();

const logger = createLogger('main');

const main = async () => {
  try {
    const twitterApi = await createTwitterApi(
      process.env.TWITTER_USERNAME || '',
      process.env.TWITTER_PASSWORD || '',
      'cookies.json',
    );

    const autoDriveApi = createAutoDriveApi({
      apiKey: process.env.AUTO_DRIVE_API_KEY || '',
      network: 'mainnet',
    });

    while (true) {
      const tweets = await twitterApi.getUnrepliedMentionsWithRoots(10);
      tweets.forEach(async tweet => {
        const photoCids = [];
        if (tweet.rootTweet.photos) {
          for (let i = 0; i < tweet.rootTweet.photos.length; i++) {
            const photo = tweet.rootTweet.photos[i];
            if (!photo?.url) continue;
            const photoResponse = await fetch(photo.url);
            const photoBlob = await photoResponse.blob();
            const cid = await uploadFile(
              autoDriveApi,
              new File(
                [photoBlob],
                `photo-${tweet?.rootTweet?.username}-${tweet?.rootTweet?.id}-${i}.jpg`,
                { type: 'image/jpeg' },
              ),
            );
            photoCids.push(cid);
          }
        }
        const videoCids = [];
        if (tweet.rootTweet.videos) {
          for (let i = 0; i < tweet.rootTweet.videos.length; i++) {
            const video = tweet.rootTweet.videos[i];
            if (!video?.url) continue;
            const videoResponse = await fetch(video.url);
            const videoBlob = await videoResponse.blob();
            const cid = await uploadFile(
              autoDriveApi,
              new File(
                [videoBlob],
                `video-${tweet?.rootTweet?.username}-${tweet?.rootTweet?.id}-${i}.mp4`,
                { type: 'video/mp4' },
              ),
            );
            videoCids.push(cid);
          }
        }
        const cid = await uploadJson(
          autoDriveApi,
          tweet?.rootTweet?.id || '',
          tweet?.rootTweet?.username || '',
          {
            tweet: tweet.rootTweet,
            photosCids: photoCids,
            videosCids: videoCids,
          },
          {
            compression: true,
            password: process.env.AUTO_DRIVE_PASSWORD || '',
          },
        );
        console.log(cid);
        const _likeMention = await twitterApi.likeTweet(tweet.mention.id || '');
        const sendTweet = {
          text: `@${tweet.mention.username} Here is the cid: ${cid}, and it is accessible at https://astral.autonomys.xyz/mainnet/permanent-storage/files/${cid}`,
          inReplyTo: tweet.mention.id,
        };
        const reply = await twitterApi.sendTweet(sendTweet.text, sendTweet.inReplyTo);
      });
      const _timer = await new Promise(resolve => setTimeout(resolve, 900000));
    }
  } catch (error) {
    logger.error('Error in main:', error);
  }
};

// Run the main function
main().catch(error => {
  logger.error('Unhandled error in main:', error);
});
