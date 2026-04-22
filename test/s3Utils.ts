import {
  S3Client,
  CreateBucketCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  DeleteBucketCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';

export async function recreateBucket(s3: S3Client, bucketName: string) {
  try {
    // check if bucket exists
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));

    // bucket exists → delete all objects
    let ContinuationToken: string | undefined = undefined;

    while (true) {
      const list = await s3.send(
        new ListObjectsV2Command({ Bucket: bucketName, ContinuationToken }),
      );

      const objects = list.Contents ?? [];
      if (objects.length > 0) {
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: { Objects: objects.map((o) => ({ Key: o.Key! })) },
          }),
        );
      }

      if (!list.IsTruncated) break;
      ContinuationToken = list.NextContinuationToken;
    }

    // optionally delete bucket itself to start completely fresh
    await s3.send(new DeleteBucketCommand({ Bucket: bucketName }));
  } catch (err: any) {
    // bucket doesn't exist → we will create it below
    if (err.name !== 'NotFound' && err.$metadata?.httpStatusCode !== 404) {
      throw err;
    }
  }

  // create bucket fresh
  await s3.send(
    new CreateBucketCommand({ Bucket: bucketName, ACL: 'private' }),
  );
}

export async function existsInBucket(
  s3: S3Client,
  bucket: string,
  key: string,
) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err: any) {
    if (err.name === 'NotFound') return false;
    throw err; // unexpected errors
  }
}

export async function bucketExists(s3: S3Client, bucket: string) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch (err: any) {
    if (err.name === 'NotFound') return false;
    throw err; // unexpected errors
  }
}

export async function deleteAllBuckets(
  client: S3Client,
  keepBuckets?: string[],
) {
  const { Buckets } = await client.send(new ListBucketsCommand({}));

  if (!Buckets) return;

  for (const bucket of Buckets) {
    const name = bucket.Name;
    if (!name) continue;

    if (keepBuckets.includes(name)) {
      continue;
    }

    let continuationToken: string | undefined;

    do {
      const list = await client.send(
        new ListObjectsV2Command({
          Bucket: name,
          ContinuationToken: continuationToken,
        }),
      );

      if (list.Contents && list.Contents.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: name,
            Delete: {
              Objects: list.Contents.map((obj) => ({
                Key: obj.Key!,
              })),
            },
          }),
        );
      }

      continuationToken = list.IsTruncated
        ? list.NextContinuationToken
        : undefined;
    } while (continuationToken);

    await client.send(
      new DeleteBucketCommand({
        Bucket: name,
      }),
    );
  }
}
