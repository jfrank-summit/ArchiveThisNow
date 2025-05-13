import { uploadTweet } from '../utils/tweetUploader.js';
import { TwitterApi } from '../lib/twitter/types.js';
export const mentions = async (twitterApi: TwitterApi, autoDriveApi: any) => {
  while (true) {
    const tweets = await twitterApi.getUnrepliedMentionsWithRoots(50);
    for (const tweet of tweets) {
      const cid = await uploadTweet(tweet.rootTweet, autoDriveApi);
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
