import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DiscordBotService } from "./discord-bot.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [],
  providers: [DiscordBotService],
})
export class AppModule {}
