import { Module } from "@nestjs/common";
import { ShopModule } from "../shop/shop.module"; // for ShopRepository (Create/Receive use cases)
import { ScratchGameRepository } from "./repositories/scratch-game.repository";
import { ScratchPackRepository } from "./repositories/scratch-pack.repository";
import { ScratchScanEventRepository } from "./repositories/scratch-scan-event.repository";
import {
  ScratchGameController,
  ScratchPackController,
  ScratchScanController,
  ScratchSummaryController,
} from "./scratch.controller";
import { CreateScratchGameUseCase } from "./use-cases/create-scratch-game.use-case";
import { GetScratchGameByIdUseCase } from "./use-cases/get-scratch-game-by-id.use-case";
import { GetScratchGamesUseCase } from "./use-cases/get-scratch-games.use-case";
import { GetScratchPackByIdUseCase } from "./use-cases/get-scratch-pack-by-id.use-case";
import { GetScratchPacksUseCase } from "./use-cases/get-scratch-packs.use-case";
import { GetScratchSalesSummaryUseCase } from "./use-cases/get-scratch-sales-summary.use-case";
import { GetScratchScansUseCase } from "./use-cases/get-scratch-scans.use-case";
import { MoveScratchPackUseCase } from "./use-cases/move-scratch-pack.use-case";
import { ReceiveScratchPackUseCase } from "./use-cases/receive-scratch-pack.use-case";
import { RecordScratchScanUseCase } from "./use-cases/record-scratch-scan.use-case";
import { ReturnScratchPackUseCase } from "./use-cases/return-scratch-pack.use-case";
import { VoidScratchScanUseCase } from "./use-cases/void-scratch-scan.use-case";

@Module({
  imports: [ShopModule],
  controllers: [
    ScratchGameController,
    ScratchPackController,
    ScratchSummaryController,
    ScratchScanController,
  ],
  providers: [
    ScratchGameRepository,
    ScratchPackRepository,
    ScratchScanEventRepository,
    CreateScratchGameUseCase,
    GetScratchGamesUseCase,
    GetScratchGameByIdUseCase,
    ReceiveScratchPackUseCase,
    GetScratchPacksUseCase,
    GetScratchPackByIdUseCase,
    MoveScratchPackUseCase,
    ReturnScratchPackUseCase,
    RecordScratchScanUseCase,
    GetScratchSalesSummaryUseCase,
    GetScratchScansUseCase,
    VoidScratchScanUseCase,
  ],
  exports: [ScratchGameRepository, ScratchPackRepository, ScratchScanEventRepository],
})
export class ScratchModule {}
