import { AutoDriveApi } from '@autonomys/auto-drive';
import { ExperienceUploadOptions } from './types.js';

// Define GenericFile interface locally since it's not exported from auto-drive
interface GenericFile {
  read(): AsyncIterable<Buffer>;
  name: string;
  mimeType?: string;
  size: number;
}

// Adapter to convert browser File to GenericFile
const fileToGenericFile = (file: File): GenericFile => {
  return {
    name: file.name,
    size: file.size,
    mimeType: file.type,
    async *read() {
      const arrayBuffer = await file.arrayBuffer();
      yield Buffer.from(arrayBuffer);
    },
  };
};

export const uploadJson = async (
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

export const uploadFile = async (autoDriveApi: AutoDriveApi, file: File) => {
  const cid = await autoDriveApi.uploadFile(fileToGenericFile(file), {
    compression: true,
    password: process.env.AUTO_DRIVE_PASSWORD || '',
  });
  return cid;
};
