import { HttpModule, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DigitalOceanService } from "./digital-ocean.service";
import { DiscordBotService } from "./discord-bot.service";
import { MinecraftServerService } from "./minecraft-server.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule.register({ validateStatus: () => true }),
  ],
  controllers: [],
  providers: [DiscordBotService, DigitalOceanService, MinecraftServerService],
})
export class AppModule {}
