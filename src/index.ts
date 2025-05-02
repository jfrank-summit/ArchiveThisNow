import { createAuthenticatedScraper } from "./lib/auth.js";
import dotenv from 'dotenv';

dotenv.config();

const main = async () => {
  const scraper = await createAuthenticatedScraper(process.env.TWITTER_USERNAME!, process.env.TWITTER_PASSWORD!, 'cookies.json');
  const tweets = await scraper.getTweets('username');
  console.log(tweets);
};

main();