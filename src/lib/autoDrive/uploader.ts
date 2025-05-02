import { AutoDriveApi } from '@autonomys/auto-drive';
import { ExperienceUploadOptions } from './types.js';

export const uploadExperience = async (
  autoDriveApi: AutoDriveApi,
  tweetId: string,
  tweetUsername: string,
  data: unknown,
  { compression, password }: ExperienceUploadOptions,
) => {
  const fileName = `${tweetUsername}-${tweetId}.json`;

  const cid = await autoDriveApi.uploadObjectAsJSON(data, fileName, {
    compression,
    password,
  });
  return cid;
};
