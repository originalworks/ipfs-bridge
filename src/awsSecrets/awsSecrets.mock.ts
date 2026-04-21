export class AwsSecretsManagerMock {
  send() {
    return {
      SecretString: JSON.stringify({
        RPC_URL: 'ELOSZKI',
        FILEBASE_ACCESS_TOKEN: 'test',
        FILEBASE_SECRET_KEY: 'test',
      }),
    };
  }
}
