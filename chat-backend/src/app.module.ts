import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SignalingGateway } from './services/signaling.gateway';
import { ConnectionService } from './services/connection.service';
import { SpamProtectionService } from './services/spam-protection.service';
import { WebRTCService } from './services/webrtc.service';
import { ConnectionValidationService } from './services/connection-validation.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
  ],
  controllers: [],
  providers: [
    SignalingGateway,
    ConnectionService,
    SpamProtectionService,
    WebRTCService,
    ConnectionValidationService,
  ],
})
export class AppModule {}
