import { uploadTweet } from '../utils/tweetUploader.js';
import { TwitterApi } from '../lib/twitter/types.js';
import { getProcessedTweetCid, addProcessedTweet, hasRepliedToMention, logMention } from '../lib/db/index.js';

export const mentions = async (twitterApi: TwitterApi, autoDriveApi: any) => {
  while (true) {
    const tweets = await twitterApi.getUnrepliedMentionsWithRoots(50);
    for (const tweet of tweets) {
      const hasReplied = hasRepliedToMention(tweet.mention.id || '');
      if (hasReplied) {
        console.log(`Tweet ${tweet.mention.id} already replied to, skipping`);
        continue;
      }
      const rootTweetId = tweet.rootTweet.id;

      if (!rootTweetId) {
        console.warn('Root tweet ID is undefined, skipping this mention:', JSON.stringify(tweet));
        continue;
      }

      let cid = getProcessedTweetCid(rootTweetId);
      if (cid) {
        console.log(`Tweet ${rootTweetId} already processed. Using existing CID: ${cid}`);
      } else {
        cid = await uploadTweet(tweet.rootTweet, autoDriveApi);
        const _addProcessedTweet = addProcessedTweet(rootTweetId, cid);
        const _logMention = logMention(tweet.mention.id || '', tweet.mention.username || '', String(tweet.mention.timestamp || ''));
        console.log(`Tweet ${rootTweetId} processed and stored with CID: ${cid}`);
      }

      const _likeMention = await twitterApi.likeTweet(tweet.mention.id || '');
      const sendTweet = {
        text: `@${tweet.mention.username} Here is the cid: ${cid}, and it is accessible at https://astral.autonomys.xyz/mainnet/permanent-storage/files/${cid}`,
        inReplyTo: tweet.mention.id,
      };
      const reply = await twitterApi.sendTweet(sendTweet.text, sendTweet.inReplyTo);
    }
    const _timer = await new Promise(resolve => setTimeout(resolve, parseInt(process.env.MENTIONS_SPAWN_INTERVAL || '900000')));
  }
};
