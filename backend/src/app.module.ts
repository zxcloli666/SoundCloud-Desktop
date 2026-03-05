import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { Session } from './auth/entities/session.entity.js';
import { CdnProxyModule } from './cdn-proxy/cdn-proxy.module.js';
import configuration from './config/configuration.js';
import { HealthController } from './health/health.controller.js';
import { LikesModule } from './likes/likes.module.js';
import { MeModule } from './me/me.module.js';
import { PlaylistsModule } from './playlists/playlists.module.js';
import { RepostsModule } from './reposts/reposts.module.js';
import { ResolveModule } from './resolve/resolve.module.js';
import { SoundcloudModule } from './soundcloud/soundcloud.module.js';
import { TracksModule } from './tracks/tracks.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        entities: [Session],
        synchronize: true,
      }),
    }),
    AuthModule,
    SoundcloudModule,
    MeModule,
    TracksModule,
    PlaylistsModule,
    UsersModule,
    LikesModule,
    RepostsModule,
    ResolveModule,
    CdnProxyModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
