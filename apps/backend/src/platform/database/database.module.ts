import { Logger, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigService } from "@/platform/config/config.service";

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const logger = new Logger("Database");
        const uri = config.get("MONGODB_URI");
        if (uri) {
          logger.log("Using MongoDB at MONGODB_URI");
          return { uri };
        }
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        const server = await MongoMemoryServer.create({ instance: { dbName: "kanso" } });
        logger.warn(`MONGODB_URI is not set, using an in-memory MongoDB at ${server.getUri("kanso")}`);
        return { uri: server.getUri("kanso") };
      },
    }),
  ],
})
export class DatabaseModule {}
