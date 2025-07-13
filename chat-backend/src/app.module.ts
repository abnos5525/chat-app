import { Module } from '@nestjs/common';
import { SignalingGateway } from './services/signaling.gateway';

@Module({
  imports: [],
  controllers: [],
  providers: [SignalingGateway],
})
export class AppModule {}
