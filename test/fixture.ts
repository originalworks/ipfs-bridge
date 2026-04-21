import { ethers, Signer, Wallet } from 'ethers';
import { Whitelist__factory } from '../src/contracts/whitelist/Whitelist__factory';
import { DdexSequencer__factory } from '../src/contracts/ddexSequencer/DdexSequencer__factory';
import { ERC1967Proxy__factory } from '../src/contracts/ERC1967Proxy/ERC1967Proxy__factory';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface AnvilConfig {
  mnemonic: string;
  rpcUrl: string;
}

const ANVIL_CONFIG: AnvilConfig = {
  mnemonic: process.env.ANVIL_MNEMONIC,
  rpcUrl: `http://${process.env.ANVIL_HOST}:${process.env.ANVIL_PORT}`,
  // rpcUrl: `http://127.0.0.1:${process.env.ANVIL_PORT}`,
};

const createNonceController = async (signer: Signer) => {
  let currentNonce = await signer.getNonce('pending');

  const setNonce = () => {
    const txSettings = {
      nonce: currentNonce,
    };
    currentNonce++;
    return txSettings;
  };

  return setNonce;
};

const createWallets = async (config: AnvilConfig) => {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);

  return Array.from({ length: 5 }, (_, i) =>
    ethers.HDNodeWallet.fromPhrase(
      config.mnemonic,
      undefined,
      `m/44'/60'/0'/0/${i}`,
    ).connect(provider),
  );
};

export const testFixture = async () => {
  const [deployer, owen1, owen2, validator, random] =
    await createWallets(ANVIL_CONFIG);

  const setNonce = await createNonceController(deployer);

  const dataProvidersWhitelist = await (
    await new Whitelist__factory(deployer).deploy(deployer.address, setNonce())
  ).waitForDeployment();

  const validatorsWhitelist = await (
    await new Whitelist__factory(deployer).deploy(deployer.address, setNonce())
  ).waitForDeployment();

  const sequencerImplementation = await (
    await new DdexSequencer__factory(deployer).deploy(setNonce())
  ).waitForDeployment();

  const sequencerInitializeArgs = (
    await sequencerImplementation.initialize.populateTransaction(
      await dataProvidersWhitelist.getAddress(),
      await validatorsWhitelist.getAddress(),
      random.address,
    )
  ).data;

  const sequencerProxy = await (
    await new ERC1967Proxy__factory(deployer).deploy(
      await sequencerImplementation.getAddress(),
      sequencerInitializeArgs,
      setNonce(),
    )
  ).waitForDeployment();

  await (
    await dataProvidersWhitelist.addToWhitelist(owen1.address, setNonce())
  ).wait();

  await (
    await dataProvidersWhitelist.addToWhitelist(owen2.address, setNonce())
  ).wait();

  await (
    await validatorsWhitelist.addToWhitelist(validator.address, setNonce())
  ).wait();

  return {
    sequencer: sequencerProxy,
    validatorsWhitelist,
    dataProvidersWhitelist,
    rpcUrl: ANVIL_CONFIG.rpcUrl,
    wallets: {
      deployer,
      owen1,
      owen2,
      validator,
      random,
    },
  };
};
