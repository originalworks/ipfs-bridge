import { IsLowercase } from 'class-validator';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'Buckets' })
export class Bucket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
    nullable: false,
  })
  walletAddress: string;

  @Column({
    nullable: true,
  })
  @IsLowercase()
  bucketName?: string;

  @Column({ nullable: false })
  dataProvider: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
