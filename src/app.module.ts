import { HttpModule, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DigitalOceanService } from "./digital-ocean.service";
import { DiscordBotService } from "./discord-bot.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), HttpModule],
  controllers: [],
  providers: [DiscordBotService, DigitalOceanService],
})
export class AppModule {}
