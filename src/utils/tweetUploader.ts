import { uploadFile, uploadJson } from '../lib/autoDrive/uploader.js';
import { Tweet } from 'agent-twitter-client';

const extractPhotoUrls = async (tweet: Tweet, autoDriveApi: any): Promise<string[]> => {
  const photoCids = [];
  if (tweet.photos) {
    for (let i = 0; i < tweet.photos.length; i++) {
      const photo = tweet.photos[i];
      if (!photo?.url) continue;
      const photoResponse = await fetch(photo.url);
      const photoBlob = await photoResponse.blob();
      const cid = await uploadFile(
        autoDriveApi,
        new File([photoBlob], `photo-${tweet?.username}-${tweet?.id}-${i}.jpg`, {
          type: 'image/jpeg',
        }),
      );
      photoCids.push(cid);
    }
  }
  return photoCids;
};

const extractVideoUrls = async (tweet: Tweet, autoDriveApi: any): Promise<string[]> => {
  const videoCids = [];
  if (tweet.videos) {
    for (let i = 0; i < tweet.videos.length; i++) {
      const video = tweet.videos[i];
      if (!video?.url) continue;
      const videoResponse = await fetch(video.url);
      const videoBlob = await videoResponse.blob();
      const cid = await uploadFile(
        autoDriveApi,
        new File([videoBlob], `video-${tweet?.username}-${tweet?.id}-${i}.mp4`, {
          type: 'video/mp4',
        }),
      );
      videoCids.push(cid);
    }
  }
  return videoCids;
};

export const uploadTweet = async (tweet: Tweet, autoDriveApi: any) => {
  let photoCids: string[] = [];
  if (tweet.photos) {
    photoCids = await extractPhotoUrls(tweet, autoDriveApi);
  }
  let videoCids: string[] = [];
  if (tweet.videos) {
    videoCids = await extractVideoUrls(tweet, autoDriveApi);
  }
  if (tweet.quotedStatus) {
    photoCids = photoCids.concat(await extractPhotoUrls(tweet.quotedStatus, autoDriveApi));
    videoCids = videoCids.concat(await extractVideoUrls(tweet.quotedStatus, autoDriveApi));
  }

  // Create a deep copy and break circular references
  const tweetCopy = JSON.parse(
    JSON.stringify(tweet, (key, value) => {
      // Break circular references by removing thread property from nested structures
      if (key === 'inReplyToStatus' && value && value.thread) {
        const { thread, ...rest } = value;
        return rest;
      }
      return value;
    }),
  );

  let serializedThread;
  if (tweet.thread) {
    // Safely serialize thread by breaking circular references
    serializedThread = JSON.stringify(tweet.thread, (key, value) => {
      if (key === 'inReplyToStatus' && value && value.thread) {
        const { thread, ...rest } = value;
        return rest;
      }
      return value;
    });
  }

  const data = {
    tweet: tweetCopy,
    photosCids: photoCids,
    videosCids: videoCids,
    serializedThread,
  };

  const cid = await uploadJson(autoDriveApi, tweet?.id || '', tweet?.username || '', data, {
    compression: true,
    password: process.env.AUTO_DRIVE_PASSWORD || '',
  });
  return cid;
};
