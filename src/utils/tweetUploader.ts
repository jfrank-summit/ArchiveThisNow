import { uploadFile, uploadJson } from '../lib/autoDrive/uploader.js';
import { Tweet } from 'agent-twitter-client';
export const uploadTweet = async (tweet: Tweet, autoDriveApi: any) => {
  const photoCids = [];
  if (tweet.photos) {
      for (let i = 0; i < tweet.photos.length; i++) {
        const photo = tweet.photos[i];
        if (!photo?.url) continue;
        const photoResponse = await fetch(photo.url);
        const photoBlob = await photoResponse.blob();
        const cid = await uploadFile(
          autoDriveApi,
          new File(
            [photoBlob],
            `photo-${tweet?.username}-${tweet?.id}-${i}.jpg`,
            { type: 'image/jpeg' },
          ),
        );
        photoCids.push(cid);
      }
    }
    const videoCids = [];
    if (tweet.videos) {
      for (let i = 0; i < tweet.videos.length; i++) {
        const video = tweet.videos[i];
        if (!video?.url) continue;
        const videoResponse = await fetch(video.url);
        const videoBlob = await videoResponse.blob();
        const cid = await uploadFile(
          autoDriveApi,
          new File(
            [videoBlob],
            `video-${tweet?.username}-${tweet?.id}-${i}.mp4`,
            { type: 'video/mp4' },
          ),
        );
        videoCids.push(cid);
      }
    }
    const cid = await uploadJson(
      autoDriveApi,
      tweet?.id || '',
      tweet?.username || '',
      {
        tweet: tweet,
        photosCids: photoCids,
        videosCids: videoCids,
      },
      {
        compression: true,
        password: process.env.AUTO_DRIVE_PASSWORD || '',
      },
    );
    return cid;
};
