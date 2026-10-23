import { Logger, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { mkdir } from "node:fs/promises";
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
        // With MONGODB_DATA_DIR the built-in database writes to disk, so homes and linked apps survive a restart.
        const dbPath = config.get("MONGODB_DATA_DIR");
        if (dbPath) await mkdir(dbPath, { recursive: true });
        const server = await MongoMemoryServer.create({ instance: dbPath ? { dbName: "kanso", dbPath, storageEngine: "wiredTiger" } : { dbName: "kanso" } });
        logger.warn(`MONGODB_URI is not set, using the built-in MongoDB at ${server.getUri("kanso")}${dbPath ? `, saved in ${dbPath}` : ", in memory only"}`);
        return { uri: server.getUri("kanso") };
      },
    }),
  ],
})
export class DatabaseModule {}
