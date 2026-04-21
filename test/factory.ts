import factory from 'factory-girl';
import { DataSource } from 'typeorm';
import { Bucket } from '../src/filebase/filebase.entity';
import { ethers } from 'ethers';

export type Factory = typeof factory;

export let factoryCached: Factory = null;

export const randomCID = () =>
  `bafy${factory.chance('word', { length: 55 })()}`;

export const getFactory = (dataSource: DataSource) => {
  if (factoryCached === null) {
    factory.setAdapter(new CustomTypeORMAdapter(dataSource));
    factory.define('Bucket', Bucket, {
      id: factory.sequence((n) => n),
      walletAddress: () => ethers.Wallet.createRandom().address.toLowerCase(),
      dataProvider: factory.sequence((n) => `dataProvider${n}`),
      bucketName: factory.sequence(
        () =>
          `dataprovder-${Math.random()
            .toString(36)
            .slice(2, 2 + 4)}`,
      ),
      createdAt: '2021-09-01T12:46:25.241Z',
      updatedAt: '2021-09-01T12:46:25.241Z',
    });
    factoryCached = factory;
  }
  return factoryCached;
};

export class CustomTypeORMAdapter {
  dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  build(Model, props) {
    const model = new Model();
    for (const [key, value] of Object.entries(props)) {
      model[key] = value;
    }
    return model;
  }

  async save(model, _Model) {
    return this.dataSource.manager.save(model);
  }

  async destroy(model, Model) {
    const manager = this.dataSource.manager;
    const modelRepo = manager.getRepository(Model);
    const theModel = await modelRepo.findOneBy({ id: model.id });
    if (theModel) {
      return manager.transaction(async (tm) => {
        await tm.query('SET FOREIGN_KEY_CHECKS=0;');
        await tm.delete(Model, model.id);
        return tm.query('SET FOREIGN_KEY_CHECKS=1;');
      });
    }
  }

  get(model, attr, _Model) {
    return model[attr];
  }

  set(props, model, _Model) {
    Object.keys(props).forEach((key) => {
      model[key] = props[key];
    });
    return model;
  }
}
