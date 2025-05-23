import { Tweet } from '../lib/twitter/types.js';
import { TweetContent } from '../lib/llm/service.js';

export const convertTweetToLLMFormat = (tweet: Tweet): TweetContent => {
  const tweetContent: TweetContent = {
    text: tweet.text || '',
    username: tweet.username || 'unknown',
    timestamp: tweet.timestamp ? new Date(tweet.timestamp).toISOString() : undefined,
  };

  // Convert media information if available
  const media = [];
  
  if (tweet.photos && tweet.photos.length > 0) {
    media.push(...tweet.photos.map((photo: any) => ({
      type: 'photo',
      url: photo.url,
      description: photo.alt_text || undefined,
    })));
  }
  
  if (tweet.videos && tweet.videos.length > 0) {
    media.push(...tweet.videos.map((video: any) => ({
      type: 'video',
      url: video.url,
      description: video.description || undefined,
    })));
  }
  
  if (media.length > 0) {
    tweetContent.media = media;
  }

  return tweetContent;
} 