export const interpretDM = (dmMessage: string): string | null => {
  if (dmMessage.includes('status')) {
    const message = dmMessage.split('/');
    const tweetId = message[message.length - 1];
    return tweetId || null;
  }
  return null;
};
